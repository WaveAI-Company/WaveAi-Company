"""Persistência dos vínculos médico-paciente."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models.care_link import (
    CareLink,
    CareLinkEvent,
    CareLinkEventType,
    CareLinkParty,
    CareLinkStatus,
)


class CareLinkRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, care_link_id: uuid.UUID) -> CareLink | None:
        return self._session.get(CareLink, care_link_id)

    def get_vivo(self, *, doctor_id: uuid.UUID, patient_id: uuid.UUID) -> CareLink | None:
        """Vínculo não revogado entre o par (no máximo um, por índice parcial)."""
        stmt = select(CareLink).where(
            CareLink.doctor_user_id == doctor_id,
            CareLink.patient_user_id == patient_id,
            CareLink.status != CareLinkStatus.REVOKED,
        )
        return self._session.scalars(stmt).one_or_none()

    def get_ativo(self, *, doctor_id: uuid.UUID, patient_id: uuid.UUID) -> CareLink | None:
        """Somente vínculos que **concedem acesso**. Base do RBAC (ADR-0024)."""
        stmt = select(CareLink).where(
            CareLink.doctor_user_id == doctor_id,
            CareLink.patient_user_id == patient_id,
            CareLink.status == CareLinkStatus.ACTIVE,
        )
        return self._session.scalars(stmt).one_or_none()

    def listar_do_usuario(self, user_id: uuid.UUID) -> list[CareLink]:
        """Vínculos vivos em que o usuário participa (como médico ou paciente)."""
        stmt = (
            select(CareLink)
            .where(
                or_(
                    CareLink.doctor_user_id == user_id,
                    CareLink.patient_user_id == user_id,
                ),
                CareLink.status != CareLinkStatus.REVOKED,
            )
            .order_by(CareLink.created_at.desc())
        )
        return list(self._session.scalars(stmt))

    def criar(
        self,
        *,
        doctor_id: uuid.UUID,
        patient_id: uuid.UUID,
        status: CareLinkStatus,
        initiated_by: CareLinkParty,
    ) -> CareLink:
        link = CareLink(
            doctor_user_id=doctor_id,
            patient_user_id=patient_id,
            status=status,
            initiated_by=initiated_by,
        )
        self._session.add(link)
        self._session.flush()
        return link

    def registrar_evento(
        self,
        *,
        care_link: CareLink,
        event: CareLinkEventType,
        actor_user_id: uuid.UUID,
        actor_role: CareLinkParty,
    ) -> CareLinkEvent:
        """Grava a trilha de auditoria (quem fez o quê, quando)."""
        registro = CareLinkEvent(
            care_link_id=care_link.id,
            event=event,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
        )
        self._session.add(registro)
        self._session.flush()
        return registro

    def listar_eventos(self, care_link_id: uuid.UUID) -> list[CareLinkEvent]:
        stmt = (
            select(CareLinkEvent)
            .where(CareLinkEvent.care_link_id == care_link_id)
            .order_by(CareLinkEvent.created_at)
        )
        return list(self._session.scalars(stmt))
