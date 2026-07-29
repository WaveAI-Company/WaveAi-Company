"""Auditoria da visualização ao vivo pelo profissional (ADR-0039)."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.live_view import LiveViewAccessEvent


class LiveViewService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def registrar_acesso(
        self,
        *,
        patient_id: uuid.UUID,
        actor_id: uuid.UUID,
        session_id: uuid.UUID | None,
    ) -> None:
        """Registra que o profissional abriu a transmissão ao vivo do paciente."""
        self._session.add(
            LiveViewAccessEvent(
                patient_user_id=patient_id,
                actor_user_id=actor_id,
                session_id=session_id,
            )
        )
        self._session.flush()
