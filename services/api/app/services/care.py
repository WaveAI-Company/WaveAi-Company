"""Regras de vínculo médico-paciente (ADR-0024).

**Invariante que este módulo protege:** nenhum acesso aos dados de um paciente
sem um ato de autorização *desse* paciente. Um vínculo criado por um médico
nasce `PENDING` e não concede nada; só o aceite do paciente (ou o vínculo
iniciado por ele) leva a `ACTIVE`.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.care_link import (
    CareLink,
    CareLinkEventType,
    CareLinkParty,
    CareLinkStatus,
)
from ..models.user import User, UserRole
from ..repositories.care_link import CareLinkRepository
from ..repositories.user import UserRepository
from ..security.password import PasswordHasher


class CareLinkError(Exception):
    """Operação inválida sobre o vínculo."""


class NotAllowedError(CareLinkError):
    """Quem pediu não participa do vínculo, ou não pode praticar este ato."""


class CareService:
    def __init__(self, *, session: Session, hasher: PasswordHasher) -> None:
        self._session = session
        self._links = CareLinkRepository(session)
        self._users = UserRepository(session, hasher)

    # -- criação ---------------------------------------------------------

    def solicitar(self, *, solicitante: User, email_contraparte: str) -> CareLink | None:
        """Cria (ou reaproveita) um vínculo entre o solicitante e a contraparte.

        Devolve `None` quando não há nada a fazer — conta inexistente, papel
        incompatível ou auto-vínculo. **A rota responde igual nos dois casos**:
        quem chama não pode descobrir se o e-mail tem conta (ADR-0023/0024).
        """
        try:
            contraparte = self._users.get_by_email(email_contraparte)
        except ValueError:
            return None

        if contraparte is None or not contraparte.is_active:
            return None
        if contraparte.id == solicitante.id or contraparte.role is solicitante.role:
            # Vínculo é sempre entre papéis diferentes.
            return None

        if solicitante.role is UserRole.DOCTOR:
            doctor, patient = solicitante, contraparte
            quem = CareLinkParty.DOCTOR
            # Convite do médico NÃO concede acesso: espera o paciente.
            status = CareLinkStatus.PENDING
        else:
            doctor, patient = contraparte, solicitante
            quem = CareLinkParty.PATIENT
            # O paciente iniciando já é o ato explícito de autorização.
            status = CareLinkStatus.ACTIVE

        existente = self._links.get_vivo(doctor_id=doctor.id, patient_id=patient.id)
        if existente is not None:
            # Já há vínculo vivo: não duplica nem "reativa" nada silenciosamente.
            return existente

        link = self._links.criar(
            doctor_id=doctor.id,
            patient_id=patient.id,
            status=status,
            initiated_by=quem,
        )
        self._links.registrar_evento(
            care_link=link,
            event=CareLinkEventType.REQUESTED,
            actor_user_id=solicitante.id,
            actor_role=quem,
        )
        if status is CareLinkStatus.ACTIVE:
            link.consented_at = datetime.now(UTC)
            self._links.registrar_evento(
                care_link=link,
                event=CareLinkEventType.ACCEPTED,
                actor_user_id=patient.id,
                actor_role=CareLinkParty.PATIENT,
            )
            self._session.flush()
        return link

    # -- consentimento ---------------------------------------------------

    def aceitar(self, *, care_link_id: uuid.UUID, ator: User) -> CareLink:
        """Só o **paciente** do vínculo pode aceitar (é o dono dos dados)."""
        link = self._links.get(care_link_id)
        if link is None or link.patient_user_id != ator.id:
            raise NotAllowedError
        if link.status is not CareLinkStatus.PENDING:
            raise CareLinkError("vinculo nao esta pendente")

        link.status = CareLinkStatus.ACTIVE
        link.consented_at = datetime.now(UTC)
        self._links.registrar_evento(
            care_link=link,
            event=CareLinkEventType.ACCEPTED,
            actor_user_id=ator.id,
            actor_role=CareLinkParty.PATIENT,
        )
        self._session.flush()
        return link

    def recusar(self, *, care_link_id: uuid.UUID, ator: User) -> CareLink:
        """Só o **paciente** recusa, e só um convite ainda `PENDING`.

        Recusar é terminal: o vínculo vai para `DECLINED` e não volta. Um novo
        convite do médico cria uma linha nova (novo ciclo de consentimento).
        """
        link = self._links.get(care_link_id)
        if link is None or link.patient_user_id != ator.id:
            raise NotAllowedError
        if link.status is not CareLinkStatus.PENDING:
            raise CareLinkError("vinculo nao esta pendente")

        link.status = CareLinkStatus.DECLINED
        link.declined_at = datetime.now(UTC)
        self._links.registrar_evento(
            care_link=link,
            event=CareLinkEventType.DECLINED,
            actor_user_id=ator.id,
            actor_role=CareLinkParty.PATIENT,
        )
        self._session.flush()
        return link

    # -- revogação -------------------------------------------------------

    def revogar(self, *, care_link_id: uuid.UUID, ator: User) -> CareLink:
        """Qualquer uma das partes revoga, a qualquer momento, com efeito imediato."""
        link = self._links.get(care_link_id)
        if link is None or ator.id not in {link.doctor_user_id, link.patient_user_id}:
            raise NotAllowedError
        if link.status is CareLinkStatus.REVOKED:
            return link

        link.status = CareLinkStatus.REVOKED
        link.revoked_at = datetime.now(UTC)
        self._links.registrar_evento(
            care_link=link,
            event=CareLinkEventType.REVOKED,
            actor_user_id=ator.id,
            actor_role=(
                CareLinkParty.PATIENT
                if ator.id == link.patient_user_id
                else CareLinkParty.DOCTOR
            ),
        )
        self._session.flush()
        return link

    # -- consultas -------------------------------------------------------

    def listar(self, user: User) -> list[CareLink]:
        return self._links.listar_do_usuario(user.id)

    def acesso_ativo(self, *, doctor: User, patient_id: uuid.UUID) -> CareLink | None:
        """Base do RBAC: devolve o vínculo **ativo**, ou `None`."""
        return self._links.get_ativo(doctor_id=doctor.id, patient_id=patient_id)
