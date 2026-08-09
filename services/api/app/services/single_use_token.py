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
from ..security.tokens import (
    generate_numeric_code,
    generate_opaque_token,
    hash_opaque_token,
)

#: Entropia do valor opaco (forma **link** do segredo). Mesmo tamanho do
#: refresh (ADR-0021).
SINGLE_USE_TOKEN_BYTES = 48
#: Dígitos do código digitável, como o design mostra (`criar-conta.html`).
SINGLE_USE_CODE_DIGITS = 6


@dataclass(frozen=True)
class TokenEmitido:
    """O que a fatia que envia o e-mail precisa: os valores em claro e o prazo.

    Duas formas do **mesmo** segredo, na mesma linha: `codigo` (digitável) e
    `valor` (opaco, para o link da recuperação). Consumir por um queima o
    outro. Nenhum dos dois volta a existir depois disto — não há como reexibir,
    só emitir outro (o que supersede este).
    """

    valor: str
    codigo: str
    expires_at: datetime


class SingleUseTokenService:
    def __init__(self, *, session: Session, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._repo = SingleUseTokenRepository(session)

    def em_cooldown(self, *, user: User, purpose: SingleUseTokenPurpose) -> bool:
        """Houve emissão recente demais para reenviar agora?

        O cooldown do "Reenviar código" mora no **banco** (o `created_at` do
        último token vivo), não na memória do processo: assim ele continua
        valendo com várias réplicas — o mesmo motivo do contador de tentativas.
        """
        ultimo = self._repo.ultimo_vivo(user_id=user.id, purpose=purpose)
        if ultimo is None:
            return False
        espera = timedelta(seconds=self._settings.verification_resend_cooldown_seconds)
        return datetime.now(UTC) - ultimo.created_at < espera

    def emitir(self, *, user: User, purpose: SingleUseTokenPurpose) -> TokenEmitido:
        """Emite um token novo, invalidando os que ainda valiam.

        A ordem importa: superseder **antes** de criar, senão o novo entraria no
        próprio lote de invalidação.
        """
        agora = datetime.now(UTC)
        self._repo.apagar_expirados(user_id=user.id, agora=agora)
        self._repo.superseder_vivos(user_id=user.id, purpose=purpose, quando=agora)

        valor = generate_opaque_token(SINGLE_USE_TOKEN_BYTES)
        codigo = generate_numeric_code(SINGLE_USE_CODE_DIGITS)
        expires_at = agora + timedelta(minutes=self._settings.single_use_token_ttl_minutes)
        self._repo.criar(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_opaque_token(valor),
            code_hash=hash_opaque_token(codigo),
            expires_at=expires_at,
        )
        return TokenEmitido(valor=valor, codigo=codigo, expires_at=expires_at)

    def consumir(
        self, *, valor: str, purpose: SingleUseTokenPurpose
    ) -> SingleUseToken | None:
        """Valida e **queima** o token. Devolve `None` em qualquer recusa.

        Recusa sem distinguir o motivo (inexistente, propósito errado, expirado,
        já usado, substituído): quem chama não deve poder inferir nada a partir
        do erro.
        """
        token = self._repo.get_por_hash(hash_opaque_token(valor))
        return self._queimar_se_valido(token, purpose)

    def consumir_codigo(
        self, *, user: User, purpose: SingleUseTokenPurpose, codigo: str
    ) -> SingleUseToken | None:
        """Valida o **código digitado** e queima o token. `None` em qualquer recusa.

        Diferente de `consumir`, aqui a busca é pelo par (usuário, propósito) e
        não pelo hash: com 6 dígitos, buscar só pelo hash deixaria o código de
        uma pessoa valer na conta de outra que sorteou o mesmo número.

        Cada erro **gasta uma tentativa**; esgotado o teto, o token queima. É
        esta contagem — e não a entropia do código — que segura a adivinhação
        (emenda à ADR-0044).
        """
        token = self._repo.ultimo_vivo(user_id=user.id, purpose=purpose)
        if token is None:
            return None

        if token.code_hash != hash_opaque_token(codigo):
            token.attempts += 1
            if token.attempts >= self._settings.single_use_token_max_attempts:
                # Queimado por tentativas: some da vista como um usado, e a
                # pessoa precisa pedir outro código.
                token.superseded_at = datetime.now(UTC)
            self._session.flush()
            return None

        return self._queimar_se_valido(token, purpose)

    def _queimar_se_valido(
        self, token: SingleUseToken | None, purpose: SingleUseTokenPurpose
    ) -> SingleUseToken | None:
        """Checagens comuns às duas formas do segredo, e o consumo."""
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
