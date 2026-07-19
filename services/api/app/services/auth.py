"""Regras de autenticação: registro, login, rotação de refresh e logout.

Concentra as decisões dos ADR-0020/0021/0023 fora da camada HTTP, para poderem
ser testadas sem passar por rotas.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..config import Settings
from ..models.refresh_token import RefreshToken
from ..models.user import User, UserRole
from ..repositories.refresh_token import RefreshTokenRepository
from ..repositories.user import UserRepository
from ..security.password import PasswordHasher
from ..security.tokens import create_access_token, generate_refresh_token

#: Hash descartável usado para gastar o mesmo tempo de CPU quando o e-mail não
#: existe. Sem isso, "usuário inexistente" responderia mais rápido que "senha
#: errada" e permitiria enumerar contas pelo tempo de resposta (ADR-0023).
_DUMMY_PASSWORD = "senha-inexistente-para-tempo-uniforme"


class AuthError(Exception):
    """Falha de autenticação. Mensagem sempre genérica para o cliente."""


class EmailAlreadyRegisteredError(Exception):
    """E-mail já cadastrado."""


class RefreshReuseError(AuthError):
    """Refresh já utilizado reapareceu: a família foi revogada."""


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(
        self,
        *,
        session: Session,
        settings: Settings,
        hasher: PasswordHasher,
    ) -> None:
        self._session = session
        self._settings = settings
        self._hasher = hasher
        self._users = UserRepository(session, hasher)
        self._refresh = RefreshTokenRepository(session)
        self._dummy_hash = hasher.hash(_DUMMY_PASSWORD)

    # -- registro --------------------------------------------------------

    def register(
        self, *, email: str, password: str, role: UserRole, display_name: str
    ) -> User:
        if self._users.get_by_email(email) is not None:
            raise EmailAlreadyRegisteredError
        return self._users.create(
            email=email, password=password, role=role, display_name=display_name
        )

    # -- login -----------------------------------------------------------

    def login(self, *, email: str, password: str) -> TokenPair:
        """Autentica e emite o par de tokens.

        Erros são sempre genéricos e o custo de CPU é o mesmo para e-mail
        inexistente, senha errada e conta inativa (anti-enumeração).
        """
        try:
            user = self._users.get_by_email(email)
        except ValueError:
            # E-mail malformado: mesma resposta genérica, mesmo custo.
            self._hasher.verify(self._dummy_hash, password)
            raise AuthError from None

        if user is None:
            self._hasher.verify(self._dummy_hash, password)
            raise AuthError

        senha_ok = self._users.verify_password(user, password)
        if not senha_ok or not user.is_active:
            raise AuthError

        return self._emitir(user)

    # -- rotação ---------------------------------------------------------

    def refresh(self, raw_token: str) -> TokenPair:
        """Rotaciona o refresh. Reuso revoga a família inteira (ADR-0021)."""
        registro = self._refresh.get_by_raw(raw_token)
        if registro is None:
            raise AuthError

        agora = datetime.now(UTC)

        if registro.used_at is not None:
            # Token já rotacionado reapareceu: assume-se roubo.
            self._refresh.revoke_family(registro.family_id, now=agora)
            raise RefreshReuseError

        if registro.revoked_at is not None or _expirado(registro, agora):
            raise AuthError

        user = self._users.get_by_id(registro.user_id)
        if user is None or not user.is_active:
            raise AuthError
        if registro.token_version != user.token_version:
            # Logout global posterior à emissão.
            raise AuthError

        self._refresh.mark_used(registro, now=agora)
        return self._emitir(user, family_id=registro.family_id, now=agora)

    # -- logout ----------------------------------------------------------

    def logout(self, raw_token: str) -> None:
        """Revoga a família do refresh apresentado (logout deste dispositivo)."""
        registro = self._refresh.get_by_raw(raw_token)
        if registro is not None:
            self._refresh.revoke_family(registro.family_id)

    def logout_all(self, user: User) -> None:
        """Logout global: invalida tudo o que já foi emitido."""
        self._users.revoke_tokens(user)
        self._refresh.revoke_all_for_user(user)

    # -- interno ---------------------------------------------------------

    def _emitir(
        self,
        user: User,
        *,
        family_id: uuid.UUID | None = None,
        now: datetime | None = None,
    ) -> TokenPair:
        access = create_access_token(
            user_id=user.id, role=user.role.value, settings=self._settings, now=now
        )
        raw_refresh = generate_refresh_token()
        self._refresh.issue(
            user=user,
            raw_token=raw_refresh,
            ttl_days=self._settings.refresh_token_ttl_days,
            family_id=family_id,
            now=now,
        )
        return TokenPair(
            access_token=access,
            refresh_token=raw_refresh,
            expires_in=self._settings.access_token_ttl_minutes * 60,
        )


def _expirado(registro: RefreshToken, agora: datetime) -> bool:
    expires_at = registro.expires_at
    if expires_at.tzinfo is None:  # pragma: no cover - depende do driver
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= agora
