"""Tokens de uso único dos fluxos por e-mail (ADR-0044).

Uma tabela para os dois propósitos (verificar endereço, recuperar senha): a
mecânica é a mesma — valor opaco, **só o hash no banco**, prazo curto e uma
única utilização. O `purpose` não é rótulo: é ele que impede um token de
verificação de servir como reset de senha.

Ciclo de vida: nasce válido; `used_at` marca o consumo (irreversível);
`superseded_at` marca o que foi substituído por uma emissão nova (é o que faz
"reenviar" não deixar N tokens vivos). Nenhum dos três estados volta atrás —
reemitir cria linha nova, como o re-vínculo da ADR-0024.

**Não** reaproveita `refresh_tokens` de propósito: lá o ciclo é família +
rotação; aqui é uso único. Misturar estragaria a leitura de segurança dos dois.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class SingleUseTokenPurpose(str, enum.Enum):
    """Para que o token serve. Um propósito **não** vale pelo outro."""

    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


class SingleUseToken(Base):
    __tablename__ = "single_use_tokens"
    __table_args__ = (
        # Busca do fluxo: "os tokens vivos deste usuário para este propósito"
        # — usada na emissão (para superseder) e na limpeza oportunista.
        Index("ix_single_use_tokens_user_purpose", "user_id", "purpose"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    purpose: Mapped[SingleUseTokenPurpose] = mapped_column(
        Enum(
            SingleUseTokenPurpose,
            name="single_use_token_purpose",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    #: SHA-256 hex do valor opaco. O valor em claro só existe no e-mail e na
    #: memória de quem o gerou — vazar o banco não entrega token utilizável.
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Consumo. Preenchido = já usado, e usado não volta a valer.
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Substituído por uma emissão posterior do mesmo par (usuário, propósito).
    superseded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship()  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover - conveniência de debug
        # Nunca inclui o hash, muito menos o valor em claro.
        return f"<SingleUseToken id={self.id} purpose={self.purpose.value}>"
