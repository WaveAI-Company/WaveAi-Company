"""Modelo de identidade: usuário e perfis por papel.

Segue o núcleo do modelo de dados (`Architecture/22`, §6). Perfis são
deliberadamente mínimos (só `display_name`) por **minimização de dados**
(ADR-0022 / LGPD): campos pessoais ou clínicos só entram quando houver
finalidade especificada.

Princípio: **identidade separada de dados de sinal** — nada de EEG aqui.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class UserRole(str, enum.Enum):
    """Papéis do MVP. RBAC por papel é aplicado na camada de API (#7/#9)."""

    PATIENT = "patient"
    DOCTOR = "doctor"


def normalize_email(email: str) -> str:
    """Valida o formato e normaliza o e-mail (minúsculas, sem espaços).

    A normalização acontece na borda da persistência para que o índice único
    valha sobre o valor canônico. Levanta `ValueError` se o formato for
    inválido. `check_deliverability=False`: validar formato não deve depender
    de DNS (testes e CI rodam offline).
    """
    try:
        resultado = validate_email(email.strip(), check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError(f"e-mail invalido: {exc}") from exc
    return resultado.normalized.lower()


class User(Base):
    """Credencial e papel. Nunca guarda a senha em claro (ADR-0020)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    #: Invalida refresh tokens emitidos antes do incremento (ADR-0021).
    #: O logout global aumenta esta versão; a rotação por token vem na #7.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    patient_profile: Mapped["PatientProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    doctor_profile: Mapped["DoctorProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        # Nunca inclui o hash nem dados sensíveis.
        return f"<User id={self.id} role={self.role.value}>"


class PatientProfile(Base):
    """Perfil do paciente (mínimo nesta fase)."""

    __tablename__ = "patient_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="patient_profile")


class DoctorProfile(Base):
    """Perfil do médico (mínimo nesta fase)."""

    __tablename__ = "doctor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="doctor_profile")
