"""Regras de negócio (acima dos repositórios, abaixo do HTTP)."""

from .auth import (
    AuthError,
    AuthService,
    EmailAlreadyRegisteredError,
    RefreshReuseError,
    TokenPair,
)

__all__ = [
    "AuthService",
    "AuthError",
    "EmailAlreadyRegisteredError",
    "RefreshReuseError",
    "TokenPair",
]
