"""Auditoria de visualização ao vivo (ADR-0039).

Quando um **profissional** abre a transmissão ao vivo de um paciente (via CareLink
ativo), o acesso é registrado numa trilha **dedicada** — espelho da
`ResultAccessEvent`/`AnnotationAccessEvent`. A visualização ao vivo do próprio
titular **não** é auditada (é dado do próprio dono).

Trilha por **titular**, com o ator (profissional) e a sessão assistida no momento.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class LiveViewAccessEvent(Base):
    """Registro de que um profissional assistiu à transmissão ao vivo (ADR-0039)."""

    __tablename__ = "live_view_access_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    #: Titular dos dados assistidos.
    patient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Profissional que abriu a transmissão.
    #: **Anulável e `SET NULL`** (ADR-0047): quando o ator apaga a própria
    #: conta, o evento na trilha de OUTRA pessoa sobrevive. Com o CASCADE
    #: anterior, quem é auditado apagava a própria auditoria ao sair.
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Identificador aleatório gravado **na exclusão** da conta do ator. Mantém
    #: "foi o mesmo ator" legível na trilha sem dizer quem foi. Nulo enquanto a
    #: conta existir — aí quem responde é o `actor_user_id`.
    actor_pseudonym: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    #: Quando o pseudônimo foi gravado — é daqui que correm os 12 meses da
    #: Política (emenda à ADR-0047), e não da data do evento. Nula significa
    #: "não foi pseudonimizada", que é o que mantém a linha fora do expurgo
    #: enquanto o ator existir.
    pseudonymized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Sessão ao vivo no momento do acesso (informativo; pode não haver captação
    #: ativa quando o profissional abre a tela). Sem FK: só rastreabilidade.
    session_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        return f"<LiveViewAccessEvent patient={self.patient_user_id} actor={self.actor_user_id}>"
