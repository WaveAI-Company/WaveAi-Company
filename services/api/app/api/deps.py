"""Dependências de rota: autenticação, autorização por papel e recorte de período."""

from __future__ import annotations

import os
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.session import get_session
from ..models.user import User, UserRole
from ..repositories.user import UserRepository
from ..security.crypto import MetricsCipher
from ..security.crypto import get_metrics_cipher as get_metrics_cipher_factory
from ..security.password import PasswordHasher, get_password_hasher
from ..security.rate_limit import SlidingWindowRateLimiter
from ..security.tokens import InvalidTokenError, decode_access_token
from ..services.analysis_client import AnalysisClient, HttpAnalysisClient
from ..services.annotation import AnnotationService
from ..services.auth import AuthService
from ..services.care import CareService
from ..services.email import EmailSender, build_email_sender
from ..services.narrator import Narrator, build_narrator
from ..services.results import ResultService
from ..services.single_use_token import SingleUseTokenService

_bearer = HTTPBearer(auto_error=False)

#: Limiter do processo (ADR-0023). TODO(#19): Redis para múltiplas réplicas.
_login_limiter: SlidingWindowRateLimiter | None = None


def get_login_limiter(settings: Settings = Depends(get_settings)) -> SlidingWindowRateLimiter:
    global _login_limiter
    if _login_limiter is None:
        _login_limiter = SlidingWindowRateLimiter(
            max_attempts=settings.login_rate_limit_attempts,
            window_seconds=settings.login_rate_limit_window_seconds,
        )
    return _login_limiter


#: Limiter do cadastro (fatia P9-e). Separado do login: as janelas são de
#: ordens diferentes (tentar entrar é rotina; criar conta, não).
_register_limiter: SlidingWindowRateLimiter | None = None


def get_register_limiter(
    settings: Settings = Depends(get_settings),
) -> SlidingWindowRateLimiter:
    global _register_limiter
    if _register_limiter is None:
        _register_limiter = SlidingWindowRateLimiter(
            max_attempts=settings.register_rate_limit_attempts,
            window_seconds=settings.register_rate_limit_window_seconds,
        )
    return _register_limiter


def reset_login_limiter() -> None:
    """Usado pelos testes para isolar cenários.

    Zera **todos** os limiters do processo: o nome ficou por compatibilidade
    com as fixtures que já existiam, e um único ponto de reset evita que um
    limiter novo passe despercebido por elas.
    """
    global _login_limiter, _register_limiter
    _login_limiter = None
    _register_limiter = None


def get_hasher(settings: Settings = Depends(get_settings)) -> PasswordHasher:
    return get_password_hasher(settings)


def get_auth_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    hasher: PasswordHasher = Depends(get_hasher),
) -> Iterator[AuthService]:
    yield AuthService(session=session, settings=settings, hasher=hasher)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    hasher: PasswordHasher = Depends(get_hasher),
) -> User:
    """Exige um access token válido. Sem token ou inválido → 401."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="nao autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = decode_access_token(credentials.credentials, settings)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token invalido",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = UserRepository(session, hasher).get_by_id(claims.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token invalido")
    # Logout global, troca e redefinição de senha incrementam `token_version`.
    # Sem esta conferência, o access token já emitido sobreviveria ao gesto por
    # até 15 minutos — justamente a janela em que se quer o intruso fora.
    if claims.token_version != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token invalido")
    return user


def require_role(*roles: UserRole) -> Callable[..., User]:
    """Autorização por papel: autenticado mas com papel errado → 403."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="papel sem permissao"
            )
        return user

    return dependency


def get_analysis_client(settings: Settings = Depends(get_settings)) -> AnalysisClient:
    """Cliente do serviço de Analysis (o gateway só encaminha janelas)."""
    return HttpAnalysisClient(
        base_url=settings.analysis_url,
        timeout_seconds=settings.analysis_timeout_seconds,
    )


def get_narrator(settings: Settings = Depends(get_settings)) -> Narrator:
    """Narrador do relatório (N6-b). Nulo por padrão: só vira LLM com a flag
    ligada E `ANTHROPIC_API_KEY` no ambiente (lida pelo SDK, fora do prefixo)."""
    return build_narrator(
        enabled=settings.narrative_enabled,
        model=settings.narrative_model,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
    )


def get_metrics_cipher(settings: Settings = Depends(get_settings)) -> MetricsCipher:
    return get_metrics_cipher_factory(settings)


def get_result_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    cipher: MetricsCipher = Depends(get_metrics_cipher),
) -> ResultService:
    return ResultService(session=session, settings=settings, cipher=cipher)


def get_annotation_service(
    session: Session = Depends(get_session),
    cipher: MetricsCipher = Depends(get_metrics_cipher),
) -> AnnotationService:
    return AnnotationService(session=session, cipher=cipher)


def get_email_sender(settings: Settings = Depends(get_settings)) -> EmailSender:
    """Adapter de envio de e-mail (ADR-0044).

    Fora de `development` sem provedor, `build_email_sender` levanta — e é para
    levantar: a alternativa seria engolir a mensagem em silêncio num fluxo em
    que a pessoa fica do lado de fora sem ela.
    """
    return build_email_sender(settings)


def get_single_use_token_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> SingleUseTokenService:
    return SingleUseTokenService(session=session, settings=settings)


def get_care_service(
    session: Session = Depends(get_session),
    hasher: PasswordHasher = Depends(get_hasher),
    cipher: MetricsCipher = Depends(get_metrics_cipher),
    settings: Settings = Depends(get_settings),
) -> CareService:
    return CareService(session=session, hasher=hasher, cipher=cipher, settings=settings)


def require_active_care_link(
    patient_id: uuid.UUID,
    doctor: User = Depends(require_role(UserRole.DOCTOR)),
    care: CareService = Depends(get_care_service),
) -> User:
    """Autorização de acesso aos dados de um paciente (ADR-0024).

    A invariante vive **aqui**, na camada de autorização — e não na UI: sem um
    vínculo `ACTIVE` (isto é, sem um ato de consentimento do próprio paciente),
    o médico recebe 403. Vínculo `PENDING` ou `REVOKED` não concede nada.

    Devolve o **paciente**, para a rota não precisar buscá-lo de novo.
    """
    link = care.acesso_ativo(doctor=doctor, patient_id=patient_id)
    if link is None:
        # Mensagem única: não distingue "não existe" de "não autorizado", para
        # não virar oráculo de quem é paciente de quem.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="sem vinculo ativo com este paciente"
        )
    return link.patient


# -- recorte de período --------------------------------------------------

#: Teto do `?days=`: ~10 anos. Não é limite de produto — é sanidade de entrada.
#: Acima disso o pedido é indistinguível de "tudo", e recusar é mais honesto do
#: que fingir que a janela recortou alguma coisa.
PERIODO_MAX_DIAS = 3650


@dataclass(frozen=True)
class Janela:
    """Recorte temporal pedido pelo cliente (`?days=N`) já traduzido em corte."""

    days: int
    desde: datetime


def janela_periodo(
    days: int | None = Query(
        None,
        ge=1,
        le=PERIODO_MAX_DIAS,
        description=(
            "Recorta a resposta às últimas N dias (janela rolante de N×24h). "
            "Ausente = histórico inteiro."
        ),
    ),
) -> Janela | None:
    """Traduz `?days=N` numa data de corte — janela **rolante**, em UTC.

    Rolante e não mês-calendário: "últimos 30 dias" no design é o que a pessoa
    captou nas últimas 720 horas, e assim o corte independe do fuso de quem lê.

    Ausente devolve `None` e a rota se comporta como antes desta fatia. O
    parâmetro só **estreita** o que sai do servidor, nunca alarga — por isso não
    é uma nova via de acesso: os gates (token, papel, CareLink ativo) rodam
    antes e continuam iguais.
    """
    if days is None:
        return None
    return Janela(days=days, desde=datetime.now(UTC) - timedelta(days=days))


def client_ip(request: Request) -> str:
    """IP do cliente para o rate limiting.

    Usa o socket; atrás de proxy reverso será preciso tratar `X-Forwarded-For`
    de forma confiável (TODO(#19) — cabeçalho é falsificável sem proxy confiável).
    """
    return request.client.host if request.client else "desconhecido"
