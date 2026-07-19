"""Hashing de senha (ADR-0020: Argon2id).

A senha **nunca** é armazenada — guardamos só o hash Argon2, que já embute salt
e parâmetros. A interface `PasswordHasher` existe para permitir trocar de
algoritmo e para suportar `needs_rehash` (upgrade de parâmetros ao longo do
tempo, sem exigir que o usuário troque a senha).
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from ..config import Settings, get_settings


@runtime_checkable
class PasswordHasher(Protocol):
    """Contrato de hashing. Implementação atual: `Argon2PasswordHasher`."""

    def hash(self, password: str) -> str:
        """Devolve o hash da senha (com salt e parâmetros embutidos)."""

    def verify(self, password_hash: str, password: str) -> bool:
        """Confere a senha contra o hash. Não levanta em senha errada."""

    def needs_rehash(self, password_hash: str) -> bool:
        """Indica se o hash foi gerado com parâmetros mais fracos que os atuais."""


class Argon2PasswordHasher:
    """Argon2id com os parâmetros mínimos recomendados pelo OWASP.

    Padrão: m=19 MiB, t=2, p=1 — ajustável por ambiente (ver `Settings`).
    """

    def __init__(
        self,
        *,
        memory_cost: int,
        time_cost: int,
        parallelism: int,
    ) -> None:
        self._hasher = Argon2Hasher(
            memory_cost=memory_cost,
            time_cost=time_cost,
            parallelism=parallelism,
        )

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            # Senha errada ou hash corrompido/desconhecido: nunca propagar como erro.
            return False

    def needs_rehash(self, password_hash: str) -> bool:
        try:
            return self._hasher.check_needs_rehash(password_hash)
        except InvalidHashError:
            # Hash ilegível (ex.: algoritmo antigo) deve ser regravado.
            return True


def get_password_hasher(settings: Settings | None = None) -> PasswordHasher:
    """Hasher configurado pelo ambiente. Ponto único de troca de algoritmo."""
    settings = settings or get_settings()
    return Argon2PasswordHasher(
        memory_cost=settings.argon2_memory_cost,
        time_cost=settings.argon2_time_cost,
        parallelism=settings.argon2_parallelism,
    )
