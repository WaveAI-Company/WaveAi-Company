"""Persistência das sessões de captação."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.session import CaptureSession, SessionStatus
from ..models.user import User


class CaptureSessionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, session_id: uuid.UUID) -> CaptureSession | None:
        return self._session.get(CaptureSession, session_id)

    def listar_do_paciente(self, patient_id: uuid.UUID) -> list[CaptureSession]:
        stmt = (
            select(CaptureSession)
            .where(CaptureSession.patient_user_id == patient_id)
            .order_by(CaptureSession.started_at.desc())
        )
        return list(self._session.scalars(stmt))

    def ativa_do_paciente(
        self,
        patient_id: uuid.UUID,
        *,
        orfa_apos: timedelta | None = None,
        now: datetime | None = None,
    ) -> CaptureSession | None:
        """Sessão de captação em andamento do paciente (para o espectador ao vivo).

        Com `orfa_apos`, uma sessão `active` mais velha que isso **não conta**
        (ADR-0058): é a captação cujo processo morreu sem encerrá-la, e dizer
        "ao vivo" por ela seria a tela afirmando o que não é verdade.
        """
        condicoes = [
            CaptureSession.patient_user_id == patient_id,
            CaptureSession.status == SessionStatus.ACTIVE,
        ]
        if orfa_apos is not None:
            condicoes.append(
                CaptureSession.started_at >= (now or datetime.now(UTC)) - orfa_apos
            )
        stmt = (
            select(CaptureSession)
            .where(*condicoes)
            .order_by(CaptureSession.started_at.desc())
        )
        return self._session.scalars(stmt).first()

    def encerrar_orfas(self, *, orfa_apos: timedelta, now: datetime | None = None) -> int:
        """Marca como `ABORTED` as sessões `active` mais velhas que `orfa_apos`.

        Sem Result (ADR-0058, Decisão 3): o raw de uma captação só vive na
        memória do processo que a recebia, e esse processo não existe mais.
        Devolve quantas foram encerradas.
        """
        agora = now or datetime.now(UTC)
        stmt = select(CaptureSession).where(
            CaptureSession.status == SessionStatus.ACTIVE,
            CaptureSession.started_at < agora - orfa_apos,
        )
        orfas = list(self._session.scalars(stmt))
        for sessao in orfas:
            self.encerrar(sessao, status=SessionStatus.ABORTED, now=agora)
        return len(orfas)

    def abrir(self, *, patient: User, device: str, sample_rate: int) -> CaptureSession:
        sessao = CaptureSession(
            patient_user_id=patient.id,
            device=device,
            sample_rate=sample_rate,
            status=SessionStatus.ACTIVE,
        )
        self._session.add(sessao)
        self._session.flush()
        return sessao

    def somar_amostras(self, sessao: CaptureSession, quantidade: int) -> None:
        sessao.sample_count += quantidade
        self._session.flush()

    def encerrar(
        self,
        sessao: CaptureSession,
        *,
        status: SessionStatus,
        now: datetime | None = None,
    ) -> None:
        """Fecha a sessão. `ABORTED` quando a conexão caiu sem `stop`."""
        if sessao.status is not SessionStatus.ACTIVE:
            return
        sessao.status = status
        sessao.ended_at = now or datetime.now(UTC)
        self._session.flush()
