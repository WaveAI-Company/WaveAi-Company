"""Emissão e consumo dos tokens de uso único (ADR-0044).

Duas operações e uma invariante:

- `emitir` devolve o valor **em claro** (o único momento em que ele existe fora
  do e-mail) e guarda só o hash;
- `consumir` valida hash + propósito + prazo + estado, e marca o uso.

**A invariante:** um token vale **uma vez, para um propósito, por um prazo**.
Toda recusa devolve o mesmo `None` — quem chama não distingue "não existe" de
"expirou" de "já foi usado", pela mesma razão da ADR-0024: a mensagem de erro
não pode virar oráculo.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..config import Settings
from ..models.single_use_token import SingleUseToken, SingleUseTokenPurpose
from ..models.user import User
from ..repositories.single_use_token import SingleUseTokenRepository
from ..security.tokens import generate_opaque_token, hash_opaque_token

#: Entropia do valor opaco. Mesmo tamanho do refresh (ADR-0021): não é forçável
#: nem sem rate limit, que é o ponto do item 4 da ADR-0044.
SINGLE_USE_TOKEN_BYTES = 48


@dataclass(frozen=True)
class TokenEmitido:
    """O que a fatia que envia o e-mail precisa: o valor em claro e o prazo.

    O valor **não** volta a existir depois disto — não há como reexibi-lo, só
    emitir outro (o que supersede este).
    """

    valor: str
    expires_at: datetime


class SingleUseTokenService:
    def __init__(self, *, session: Session, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._repo = SingleUseTokenRepository(session)

    def _ttl(self, purpose: SingleUseTokenPurpose) -> timedelta:
        """Prazo por propósito (ADR-0044, item 7).

        Assimetria proposital: verificação é passo de cadastro e a pessoa abre
        quando lê o e-mail; reset de senha é vetor de tomada de conta, e a
        janela curta é a defesa contra caixa comprometida ou aberta em máquina
        compartilhada.
        """
        if purpose is SingleUseTokenPurpose.PASSWORD_RESET:
            return timedelta(minutes=self._settings.password_reset_ttl_minutes)
        return timedelta(hours=self._settings.email_verification_ttl_hours)

    def emitir(self, *, user: User, purpose: SingleUseTokenPurpose) -> TokenEmitido:
        """Emite um token novo, invalidando os que ainda valiam.

        A ordem importa: superseder **antes** de criar, senão o novo entraria no
        próprio lote de invalidação.
        """
        agora = datetime.now(UTC)
        self._repo.apagar_expirados(user_id=user.id, agora=agora)
        self._repo.superseder_vivos(user_id=user.id, purpose=purpose, quando=agora)

        valor = generate_opaque_token(SINGLE_USE_TOKEN_BYTES)
        expires_at = agora + self._ttl(purpose)
        self._repo.criar(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_opaque_token(valor),
            expires_at=expires_at,
        )
        return TokenEmitido(valor=valor, expires_at=expires_at)

    def consumir(
        self, *, valor: str, purpose: SingleUseTokenPurpose
    ) -> SingleUseToken | None:
        """Valida e **queima** o token. Devolve `None` em qualquer recusa.

        Recusa sem distinguir o motivo (inexistente, propósito errado, expirado,
        já usado, substituído): quem chama não deve poder inferir nada a partir
        do erro.
        """
        token = self._repo.get_por_hash(hash_opaque_token(valor))
        if token is None:
            return None
        # O propósito é verificado aqui, e não na consulta, para que trocar de
        # fluxo com um token válido caia na mesma recusa dos demais casos.
        if token.purpose is not purpose:
            return None
        if token.used_at is not None or token.superseded_at is not None:
            return None
        if token.expires_at <= datetime.now(UTC):
            return None

        token.used_at = datetime.now(UTC)
        self._session.flush()
        return token
