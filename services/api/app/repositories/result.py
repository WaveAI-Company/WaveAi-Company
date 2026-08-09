"""Persistência de Result e da auditoria de acesso (ADR-0026)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models.result import Result, ResultAccessAction, ResultAccessEvent


class ResultRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def criar(
        self,
        *,
        session_id: uuid.UUID,
        patient_user_id: uuid.UUID,
        engine_version: str,
        metrics_encrypted: bytes,
        device: str | None = None,
        montage: str | None = None,
    ) -> Result:
        result = Result(
            session_id=session_id,
            patient_user_id=patient_user_id,
            engine_version=engine_version,
            metrics_encrypted=metrics_encrypted,
            device=device,
            montage=montage,
        )
        self._session.add(result)
        self._session.flush()
        return result

    def listar_do_paciente(
        self, patient_user_id: uuid.UUID, *, desde: datetime | None = None
    ) -> list[Result]:
        """Result do titular, do mais recente ao mais antigo.

        `desde` recorta a janela **no banco**: além de devolver menos, evita
        decifrar blob que ninguém vai ler. Borda inclusiva (`>=`).
        """
        stmt = select(Result).where(Result.patient_user_id == patient_user_id)
        if desde is not None:
            stmt = stmt.where(Result.created_at >= desde)
        return list(self._session.scalars(stmt.order_by(Result.created_at.desc())))

    def apagar_do_paciente(self, patient_user_id: uuid.UUID) -> int:
        """Exclusão (erasure): apaga TODOS os Result do titular. Devolve quantos."""
        resultado = self._session.execute(
            delete(Result).where(Result.patient_user_id == patient_user_id)
        )
        self._session.flush()
        return int(resultado.rowcount or 0)

    def auditar(
        self,
        *,
        patient_user_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        action: ResultAccessAction,
        count: int = 1,
    ) -> ResultAccessEvent:
        evento = ResultAccessEvent(
            patient_user_id=patient_user_id,
            actor_user_id=actor_user_id,
            action=action,
            count=count,
        )
        self._session.add(evento)
        self._session.flush()
        return evento
