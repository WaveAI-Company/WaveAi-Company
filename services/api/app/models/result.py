"""Resultado persistido de uma sessão e a auditoria de acesso (ADR-0026).

**O que é gravado:** apenas o `Result` — features derivadas (bandas, `rel_alpha`,
qualidade, verdict) + `engine_version` + metadados. O sinal **raw não** (ADR-0025).

**Como é gravado:** as métricas ficam **cifradas em repouso** (coluna binária);
só `engine_version` fica em claro, para rastreabilidade (regra rígida). Apagar
o `Result` apaga o dado — base do direito de exclusão.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, LargeBinary, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class Result(Base):
    __tablename__ = "results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("capture_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    #: Redundante com a sessão, mas mantido para o direito de exclusão poder
    #: apagar TODOS os Result de um titular sem varrer sessões.
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Em claro: rastreabilidade (que versão produziu o resultado).
    engine_version: Mapped[str] = mapped_column(String(128), nullable=False)
    #: Métricas cifradas (ver security/crypto.py). Nunca em claro no banco.
    metrics_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        # Nunca inclui as métricas.
        return f"<Result id={self.id} engine={self.engine_version}>"


class ResultAccessAction(str, enum.Enum):
    CREATED = "created"
    READ = "read"
    EXPORTED = "exported"
    DELETED = "deleted"


class ResultAccessEvent(Base):
    """Trilha de auditoria: quem acessou dados de qual titular, e como.

    Estende a auditoria de consentimento do CareLink (ADR-0024) para o acesso
    a `Result`. Registra por **titular**, não por linha de Result — assim a
    exclusão dos Result não apaga o rastro de que houve acesso.
    """

    __tablename__ = "result_access_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    #: Titular dos dados acessados.
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Quem praticou o acesso (o próprio titular ou um médico vinculado).
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[ResultAccessAction] = mapped_column(
        Enum(ResultAccessAction, name="result_access_action",
             values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    #: Quantos Result foram tocados (leitura em lote, exclusão em massa).
    count: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
