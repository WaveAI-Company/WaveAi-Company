"""Sessão de captação (`Architecture/22`, §6).

Guarda os **metadados** da sessão: quem, quando, com qual dispositivo, quantas
amostras chegaram.

O **sinal bruto não é persistido** — e isso é decisão, não omissão. Pelo fluxo
da ADR-0017 o que se persiste é o `Result` (features + `engine_version`); guardar
raw fica **fora do escopo do MVP** até haver necessidade concreta, quando entra
com issue e ADR próprios. Q-TEC-04 / ADR-0005 (banco de série temporal) seguem
**abertos** de propósito.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class SessionStatus(str, enum.Enum):
    #: Stream aberto, recebendo amostras.
    ACTIVE = "active"
    #: Encerrada normalmente pelo cliente.
    COMPLETED = "completed"
    #: Conexão caiu ou foi interrompida sem encerramento explícito.
    ABORTED = "aborted"


class CaptureSession(Base):
    """Uma sessão de captação de um paciente."""

    __tablename__ = "capture_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Identificação do aparelho informada pelo cliente (ex.: mindwave-mobile-2).
    device: Mapped[str] = mapped_column(String(64), nullable=False)
    #: Taxa de amostragem declarada (Hz).
    sample_rate: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="capture_session_status",
             values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=SessionStatus.ACTIVE,
    )
    #: Quantas amostras o gateway recebeu (não implica persistência do sinal).
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped["User"] = relationship()  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        return f"<CaptureSession id={self.id} status={self.status.value}>"
