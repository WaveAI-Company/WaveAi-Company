"""Trilha do compartilhamento ao vivo (ADR-0045).

Registra **cada** vez que o titular liga ou desliga o compartilhamento de uma
sessão — não só onde a chave parou. A coluna `live_sharing_enabled` da sessão
guarda o estado atual; se um dia houver disputa ("desliguei às 9h14"), quem
responde é este histórico.

Diferente da `LiveViewAccessEvent`: lá se registra **um profissional acessando**
o dado de alguém; aqui, o **titular decidindo** sobre o próprio. São atos de
naturezas distintas e ficam em trilhas distintas.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class LiveShareEvent(Base):
    """Um liga/desliga do compartilhamento ao vivo, pelo titular (ADR-0045)."""

    __tablename__ = "live_share_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    #: Titular que decidiu. Só ele pode — não há ator externo neste evento.
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Sessão alvo do gesto.
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("capture_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Para onde a chave foi.
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        return f"<LiveShareEvent session={self.session_id} enabled={self.enabled}>"
