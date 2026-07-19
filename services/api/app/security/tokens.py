"""Tokens de acesso e de renovação (ADR-0021).

- **Access token:** JWT curto (15 min), HS256, claims mínimas. Não é consultado
  no banco — por isso é curto.
- **Refresh token:** valor **opaco** aleatório (não JWT). Guardamos apenas o
  **hash** — vazar o banco não entrega tokens utilizáveis.

Nada de dado sensível no payload: um JWT é apenas base64, legível por qualquer um.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from ..config import Settings

#: Bytes de entropia do refresh token opaco.
REFRESH_TOKEN_BYTES = 48


class InvalidTokenError(Exception):
    """Token ausente, malformado, expirado ou com assinatura inválida."""


@dataclass(frozen=True)
class AccessClaims:
    """Claims úteis extraídas de um access token válido."""

    user_id: uuid.UUID
    role: str
    jti: str


def create_access_token(
    *, user_id: uuid.UUID, role: str, settings: Settings, now: datetime | None = None
) -> str:
    """Emite um access token assinado (claims: sub, role, exp, iat, jti, typ)."""
    now = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "typ": "access",
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_ttl_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> AccessClaims:
    """Valida assinatura, expiração e tipo. Levanta `InvalidTokenError`."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    if payload.get("typ") != "access":
        # Impede usar um token de outro tipo como se fosse de acesso.
        raise InvalidTokenError("tipo de token invalido")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidTokenError("subject invalido") from exc

    role = payload.get("role")
    if not isinstance(role, str):
        raise InvalidTokenError("role ausente")

    return AccessClaims(user_id=user_id, role=role, jti=payload.get("jti", ""))


def generate_refresh_token() -> str:
    """Gera o valor opaco entregue ao cliente (nunca é armazenado como está)."""
    return secrets.token_urlsafe(REFRESH_TOKEN_BYTES)


def hash_refresh_token(token: str) -> str:
    """Hash determinístico para busca/armazenamento do refresh.

    SHA-256 (e não Argon2) porque o token já é aleatório de alta entropia: não
    há o que forçar por dicionário, e a busca precisa ser determinística.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
