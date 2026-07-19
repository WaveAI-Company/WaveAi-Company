"""Dependências de autenticação e autorização por papel."""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.session import get_session
from ..models.user import User, UserRole
from ..repositories.user import UserRepository
from ..security.password import PasswordHasher, get_password_hasher
from ..security.rate_limit import SlidingWindowRateLimiter
from ..security.tokens import InvalidTokenError, decode_access_token
from ..services.auth import AuthService
from ..services.care import CareService

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


def reset_login_limiter() -> None:
    """Usado pelos testes para isolar cenários."""
    global _login_limiter
    _login_limiter = None


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


def get_care_service(
    session: Session = Depends(get_session),
    hasher: PasswordHasher = Depends(get_hasher),
) -> CareService:
    return CareService(session=session, hasher=hasher)


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


def client_ip(request: Request) -> str:
    """IP do cliente para o rate limiting.

    Usa o socket; atrás de proxy reverso será preciso tratar `X-Forwarded-For`
    de forma confiável (TODO(#19) — cabeçalho é falsificável sem proxy confiável).
    """
    return request.client.host if request.client else "desconhecido"
