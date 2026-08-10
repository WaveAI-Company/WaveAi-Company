"""Persistência das anotações de contexto e da auditoria (ADR-0037)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models.annotation import (
    AnnotationAccessAction,
    AnnotationAccessEvent,
    SessionAnnotation,
)


class AnnotationRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_por_sessao(self, session_id: uuid.UUID) -> SessionAnnotation | None:
        stmt = select(SessionAnnotation).where(SessionAnnotation.session_id == session_id)
        return self._session.scalars(stmt).one_or_none()

    def upsert(
        self,
        *,
        session_id: uuid.UUID,
        patient_user_id: uuid.UUID,
        note_encrypted: bytes,
    ) -> tuple[SessionAnnotation, bool]:
        """Grava a nota da sessão; se já existir, atualiza. Devolve `(nota, criada)`."""
        existente = self.get_por_sessao(session_id)
        if existente is not None:
            existente.note_encrypted = note_encrypted
            self._session.flush()
            return existente, False

        nota = SessionAnnotation(
            session_id=session_id,
            patient_user_id=patient_user_id,
            note_encrypted=note_encrypted,
        )
        self._session.add(nota)
        self._session.flush()
        return nota, True

    def sessoes_com_nota(
        self, *, patient_user_id: uuid.UUID, session_ids: Sequence[uuid.UUID]
    ) -> set[uuid.UUID]:
        """Quais dessas sessões têm nota. **Só os ids** — nunca o conteúdo.

        Uma consulta para a lista inteira, em vez de uma por sessão: era esse
        custo que mantinha o selo de autorrelato fora da linha do tempo.

        Filtra também por titular, e não só pelos ids: um id de sessão de outra
        pessoa que entrasse na lista por engano não poderia responder "sim".
        """
        if not session_ids:
            return set()
        stmt = select(SessionAnnotation.session_id).where(
            SessionAnnotation.patient_user_id == patient_user_id,
            SessionAnnotation.session_id.in_(session_ids),
        )
        return set(self._session.scalars(stmt))

    def apagar_por_sessao(self, session_id: uuid.UUID) -> bool:
        resultado = self._session.execute(
            delete(SessionAnnotation).where(SessionAnnotation.session_id == session_id)
        )
        self._session.flush()
        return bool(resultado.rowcount)

    def listar_do_paciente(self, patient_user_id: uuid.UUID) -> list[SessionAnnotation]:
        stmt = (
            select(SessionAnnotation)
            .where(SessionAnnotation.patient_user_id == patient_user_id)
            .order_by(SessionAnnotation.created_at.desc())
        )
        return list(self._session.scalars(stmt))

    def apagar_do_paciente(self, patient_user_id: uuid.UUID) -> int:
        """Exclusão (erasure): apaga TODAS as notas do titular. Devolve quantas."""
        resultado = self._session.execute(
            delete(SessionAnnotation).where(
                SessionAnnotation.patient_user_id == patient_user_id
            )
        )
        self._session.flush()
        return int(resultado.rowcount or 0)

    def auditar(
        self,
        *,
        patient_user_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        action: AnnotationAccessAction,
        count: int = 1,
    ) -> AnnotationAccessEvent:
        evento = AnnotationAccessEvent(
            patient_user_id=patient_user_id,
            actor_user_id=actor_user_id,
            action=action,
            count=count,
        )
        self._session.add(evento)
        self._session.flush()
        return evento
