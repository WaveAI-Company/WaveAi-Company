"""Regras de vínculo médico-paciente (ADR-0024).

**Invariante que este módulo protege:** nenhum acesso aos dados de um paciente
sem um ato de autorização *desse* paciente. Um vínculo criado por um médico
nasce `PENDING` e não concede nada; só o aceite do paciente (ou o vínculo
iniciado por ele) leva a `ACTIVE`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..config import Settings
from ..models.care_link import (
    CareLink,
    CareLinkEventType,
    CareLinkParty,
    CareLinkStatus,
)
from ..models.user import User, UserRole
from ..repositories.care_link import CareLinkRepository
from ..repositories.user import UserRepository
from ..security.crypto import MetricsCipher
from ..security.password import PasswordHasher


class CareLinkError(Exception):
    """Operação inválida sobre o vínculo."""


class NotAllowedError(CareLinkError):
    """Quem pediu não participa do vínculo, ou não pode praticar este ato."""


class CooldownError(CareLinkError):
    """Lembrete pedido cedo demais depois do anterior."""


@dataclass(frozen=True)
class ResultadoConvite:
    """O que a rota precisa saber para decidir se manda e-mail.

    `criado=False` com `link` preenchido é o **reconvite**: já havia vínculo
    vivo, nada foi gravado de novo — e, principalmente, **nenhum e-mail sai**,
    senão "convidar de novo" seria um jeito de furar o cooldown do reenvio.
    """

    link: CareLink | None
    criado: bool


class CareService:
    def __init__(
        self,
        *,
        session: Session,
        hasher: PasswordHasher,
        cipher: MetricsCipher,
        settings: Settings,
    ) -> None:
        self._session = session
        self._settings = settings
        self._links = CareLinkRepository(session)
        self._users = UserRepository(session, hasher)
        self._cipher = cipher

    # -- criação ---------------------------------------------------------

    def solicitar(
        self, *, solicitante: User, email_contraparte: str, mensagem: str | None = None
    ) -> ResultadoConvite:
        """Cria (ou reaproveita) um vínculo entre o solicitante e a contraparte.

        Devolve `None` quando não há nada a fazer — conta inexistente, papel
        incompatível ou auto-vínculo. **A rota responde igual nos dois casos**:
        quem chama não pode descobrir se o e-mail tem conta (ADR-0023/0024).
        Consequência para o recado: sem conta **nada é gravado**, e a mensagem
        desaparece com o convite — não existe caixa onde ela espere.
        """
        try:
            contraparte = self._users.get_by_email(email_contraparte)
        except ValueError:
            return ResultadoConvite(link=None, criado=False)

        if contraparte is None or not contraparte.is_active:
            return ResultadoConvite(link=None, criado=False)
        if contraparte.id == solicitante.id or contraparte.role is solicitante.role:
            # Vínculo é sempre entre papéis diferentes.
            return ResultadoConvite(link=None, criado=False)

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
            # O recado do reconvite é DESCARTADO de propósito (ADR-0043): quem
            # está lendo um pedido para decidir sobre ele não pode ter o texto
            # trocado por baixo. Reescrever exige cancelar e convidar de novo.
            return ResultadoConvite(link=existente, criado=False)

        link = self._links.criar(
            doctor_id=doctor.id,
            patient_id=patient.id,
            status=status,
            initiated_by=quem,
            # Cifrado como a anotação (ADR-0037/0043): texto livre de uma pessoa
            # sobre outra não fica em claro no banco.
            invite_message_encrypted=(
                self._cipher.encrypt({"message": mensagem}) if mensagem else None
            ),
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
        return ResultadoConvite(link=link, criado=True)

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

    # -- reenvio do convite ----------------------------------------------

    def reenviar(self, *, care_link_id: uuid.UUID, ator: User) -> CareLink:
        """Lembra a contraparte de um convite ainda `pending`.

        Só **quem convidou** pode reenviar, e só enquanto o convite está de pé:
        um vínculo aceito, recusado ou revogado não tem o que lembrar. O recado
        original (ADR-0043) segue **imutável** — reenviar é cutucar, não
        reescrever.

        Levanta `CooldownError` se o último lembrete saiu há pouco: o e-mail
        cai na caixa de outra pessoa, que não pediu nada, e o botão não pode
        virar alavanca de inundação.
        """
        link = self._links.get(care_link_id)
        if link is None or not self._foi_quem_convidou(link, ator):
            raise NotAllowedError
        if link.status is not CareLinkStatus.PENDING:
            raise CareLinkError("vinculo nao esta pendente")

        espera = timedelta(seconds=self._settings.invite_resend_cooldown_seconds)
        ultimo = self._links.ultimo_evento(
            care_link_id=link.id,
            eventos=(CareLinkEventType.REQUESTED, CareLinkEventType.RESENT),
        )
        if ultimo is not None and datetime.now(UTC) - ultimo.created_at < espera:
            raise CooldownError

        self._links.registrar_evento(
            care_link=link,
            event=CareLinkEventType.RESENT,
            actor_user_id=ator.id,
            actor_role=link.initiated_by,
        )
        self._session.flush()
        return link

    @staticmethod
    def _foi_quem_convidou(link: CareLink, ator: User) -> bool:
        """Quem iniciou o vínculo é quem pode lembrar a contraparte."""
        if link.initiated_by is CareLinkParty.DOCTOR:
            return ator.id == link.doctor_user_id
        return ator.id == link.patient_user_id

    # -- consultas -------------------------------------------------------

    def listar(self, user: User) -> list[CareLink]:
        return self._links.listar_do_usuario(user.id)

    def mensagem_do_convite(self, link: CareLink) -> str | None:
        """Decifra o recado do convite (ADR-0043), ou `None` se não houve.

        Quem pode ler já foi decidido antes de chegar aqui: `listar` só devolve
        vínculos vivos em que o usuário participa, e vínculo terminal
        (recusado/revogado) some da vista levando o recado junto.
        """
        if link.invite_message_encrypted is None:
            return None
        conteudo = self._cipher.decrypt(link.invite_message_encrypted)
        mensagem = conteudo.get("message")
        return str(mensagem) if mensagem else None

    def acesso_ativo(self, *, doctor: User, patient_id: uuid.UUID) -> CareLink | None:
        """Base do RBAC: devolve o vínculo **ativo**, ou `None`."""
        return self._links.get_ativo(doctor_id=doctor.id, patient_id=patient_id)
