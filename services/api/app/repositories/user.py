"""Repositório de usuários.

Recebe o `PasswordHasher` por injeção: assim a invariante "a senha em claro
nunca chega ao banco" fica concentrada num único lugar, e trocar o algoritmo
(ADR-0020) não espalha mudanças pelo código.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.user import DoctorProfile, PatientProfile, User, UserRole, normalize_email
from ..security.password import PasswordHasher


class UserRepository:
    """Persistência de `User` e perfis."""

    def __init__(self, session: Session, hasher: PasswordHasher) -> None:
        self._session = session
        self._hasher = hasher

    # -- leitura ---------------------------------------------------------

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self._session.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == normalize_email(email))
        return self._session.scalars(stmt).one_or_none()

    # -- escrita ---------------------------------------------------------

    def create(
        self,
        *,
        email: str,
        password: str,
        role: UserRole,
        display_name: str,
    ) -> User:
        """Cria usuário + perfil do papel. A senha é hasheada aqui, nunca armazenada."""
        user = User(
            email=normalize_email(email),
            password_hash=self._hasher.hash(password),
            role=role,
        )
        if role is UserRole.PATIENT:
            user.patient_profile = PatientProfile(display_name=display_name)
        else:
            user.doctor_profile = DoctorProfile(display_name=display_name)

        self._session.add(user)
        self._session.flush()
        return user

    def set_password(self, user: User, password: str) -> None:
        user.password_hash = self._hasher.hash(password)
        self._session.flush()

    def verify_password(self, user: User, password: str) -> bool:
        """Confere a senha e, se os parâmetros evoluíram, regrava o hash.

        O rehash transparente (ADR-0020) permite endurecer os parâmetros do
        Argon2 sem pedir que ninguém troque a senha.
        """
        if not self._hasher.verify(user.password_hash, password):
            return False
        if self._hasher.needs_rehash(user.password_hash):
            self.set_password(user, password)
        return True

    def revoke_tokens(self, user: User) -> None:
        """Invalida refresh tokens já emitidos (logout global — ADR-0021)."""
        user.token_version += 1
        self._session.flush()

    def delete(self, user: User) -> None:
        self._session.delete(user)
        self._session.flush()
