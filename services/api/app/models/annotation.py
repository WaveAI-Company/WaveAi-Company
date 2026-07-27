"""Anotação de contexto de uma sessão e a auditoria de acesso (ADR-0037).

O paciente adiciona **contexto autorrelatado** a uma sessão ("o que eu estava
fazendo/sentindo") — a v1 do "pop-up de contexto" da Visão. É **dado pessoal**,
então segue o mesmo cuidado do `Result`:

- **cifrada em repouso** (coluna binária; ver `security/crypto.py`) — só ids e
  timestamps ficam em claro;
- **uma nota por sessão** (editável); apagar a nota apaga o dado (erasure);
- leitura pelo profissional só com **CareLink ativo** (ADR-0024) e **auditada**
  numa trilha **dedicada** (`annotation_access_events`), distinta da do `Result`
  para a auditoria LGPD não confundir "leu suas notas" com "leu seus resultados".
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, LargeBinary, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class SessionAnnotation(Base):
    """Nota de contexto de uma sessão, escrita pelo titular (ADR-0037)."""

    __tablename__ = "session_annotations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    #: Uma nota por sessão (editável = upsert). `CASCADE`: apagar a sessão apaga a nota.
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("capture_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    #: Redundante com a sessão, mas mantido para exclusão/portabilidade em massa
    #: do titular sem varrer sessões (como no `Result`).
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Texto da nota cifrado (ver security/crypto.py). Nunca em claro no banco.
    note_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Editável: a data de atualização move a cada upsert.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        # Nunca inclui a nota.
        return f"<SessionAnnotation id={self.id} session={self.session_id}>"


class AnnotationAccessAction(str, enum.Enum):
    CREATED = "created"
    UPDATED = "updated"
    READ = "read"
    EXPORTED = "exported"
    DELETED = "deleted"


class AnnotationAccessEvent(Base):
    """Trilha de auditoria das anotações — dedicada, espelhando a do `Result`.

    Registra por **titular** (não por linha), para a exclusão das notas não
    apagar o rastro de que houve acesso. Separada da `ResultAccessEvent` de
    propósito: "leu suas notas" não é a mesma coisa que "leu seus resultados".
    """

    __tablename__ = "annotation_access_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    #: Titular dos dados acessados.
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Quem praticou o acesso (o próprio titular ou um profissional vinculado).
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[AnnotationAccessAction] = mapped_column(
        Enum(AnnotationAccessAction, name="annotation_access_action",
             values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    count: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
