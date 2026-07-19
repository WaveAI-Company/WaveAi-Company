"""Vínculo médico-paciente e sua trilha de auditoria (ADR-0024).

**Invariante do modelo:** um vínculo só concede acesso quando está `ACTIVE`, e
só chega a `ACTIVE` por um **ato explícito do paciente** — aceitar o convite de
um médico, ou ele próprio iniciar o vínculo. `PENDING` não dá acesso a nada.

Revogação é imediata e definitiva: o vínculo vai para `REVOKED` e **não**
volta. Re-vincular exige um novo consentimento (linha nova), nunca reativação
silenciosa de uma autorização antiga.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class CareLinkStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"


class CareLinkParty(str, enum.Enum):
    """Quem praticou o ato (para auditoria)."""

    DOCTOR = "doctor"
    PATIENT = "patient"


class CareLinkEventType(str, enum.Enum):
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    REVOKED = "revoked"


def _enum(tipo: type[enum.Enum], nome: str) -> Enum:
    return Enum(tipo, name=nome, values_callable=lambda e: [m.value for m in e])


class CareLink(Base):
    __tablename__ = "care_links"
    __table_args__ = (
        # Impede dois vínculos vivos entre o mesmo par, mas **preserva** os
        # revogados como histórico (índice parcial).
        Index(
            "uq_care_links_vivo",
            "doctor_user_id",
            "patient_user_id",
            unique=True,
            postgresql_where=text("status <> 'revoked'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    doctor_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    status: Mapped[CareLinkStatus] = mapped_column(
        _enum(CareLinkStatus, "care_link_status"),
        nullable=False,
        default=CareLinkStatus.PENDING,
    )
    initiated_by: Mapped[CareLinkParty] = mapped_column(
        _enum(CareLinkParty, "care_link_party"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    #: Momento do consentimento do paciente (aceite ou início por ele).
    consented_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Duas FKs para `users` exigem desambiguar qual coluna cada relação usa.
    doctor: Mapped["User"] = relationship(foreign_keys=[doctor_user_id])  # noqa: F821
    patient: Mapped["User"] = relationship(foreign_keys=[patient_user_id])  # noqa: F821

    events: Mapped[list["CareLinkEvent"]] = relationship(
        back_populates="care_link", cascade="all, delete-orphan"
    )

    @property
    def grants_access(self) -> bool:
        """Única fonte de verdade sobre "este vínculo dá acesso?"."""
        return self.status is CareLinkStatus.ACTIVE

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        return f"<CareLink id={self.id} status={self.status.value}>"


class CareLinkEvent(Base):
    """Trilha de auditoria de consentimento e revogação (quem, quando)."""

    __tablename__ = "care_link_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    care_link_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("care_links.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event: Mapped[CareLinkEventType] = mapped_column(
        _enum(CareLinkEventType, "care_link_event_type"), nullable=False
    )
    #: Quem praticou o ato. Mantido mesmo se o vínculo mudar de estado depois.
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    actor_role: Mapped[CareLinkParty] = mapped_column(
        _enum(CareLinkParty, "care_link_party"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    care_link: Mapped[CareLink] = relationship(back_populates="events")
