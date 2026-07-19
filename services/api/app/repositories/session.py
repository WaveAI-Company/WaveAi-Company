"""Persistência das sessões de captação."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

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
