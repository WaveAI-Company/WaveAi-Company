"""Refresh tokens persistidos (ADR-0021).

Cada login inicia uma **família** (`family_id`). Cada rotação cria um novo
token na mesma família e marca o anterior como usado. Se um token **já usado**
reaparecer, isso indica roubo: revogamos a **família inteira** — o atacante e a
vítima perdem acesso, e o dono refaz login.

Guardamos só o `token_hash`; o valor em claro existe apenas com o cliente.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Agrupa a cadeia de rotações originada de um mesmo login.
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    #: Cópia do `User.token_version` no momento da emissão: permite o logout
    #: global invalidar tokens antigos sem varrer a tabela.
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Marcado na rotação. Reaparecer com isto preenchido = reuso.
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        # Nunca inclui o hash do token.
        return f"<RefreshToken id={self.id} family={self.family_id}>"
