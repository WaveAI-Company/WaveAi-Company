"""Foto de perfil (ADR-0050): imagem opcional do usuário.

Tabela **separada** do perfil de propósito: o blob não deve ser arrastado a cada
leitura de `display_name`. Um usuário tem no máximo uma foto (`user_id` é a PK).

A imagem guardada aqui já passou pela re-codificação do servidor
(`services/profile_photo.py`): é sempre um JPEG normalizado, sem EXIF. Nada de
bytes crus do cliente chega a esta tabela.

A FK é **ON DELETE CASCADE**: a exclusão da conta (ADR-0047) apaga a foto junto,
sem varredura manual — é o que dispensa guardar a imagem fora do banco.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class ProfilePhoto(Base):
    __tablename__ = "profile_photos"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    #: Sempre "image/jpeg" nesta fase (o servidor re-codifica). Guardado para não
    #: presumir o tipo na hora de servir.
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    image: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
