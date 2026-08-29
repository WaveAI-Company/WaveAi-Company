"""foto de perfil (ADR-0050)

Tabela `profile_photos`: imagem opcional do usuário, uma por conta. Guardada no
Postgres — e não num serviço de blob — para não trazer fornecedor novo (emenda à
ADR-0049) e para que a exclusão da conta a apague pela **FK ON DELETE CASCADE**
(ADR-0047), sem varredura manual.

O que entra aqui já foi re-codificado pelo servidor (JPEG normalizado, sem EXIF):
o banco nunca vê os bytes crus do cliente.

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-29
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profile_photos",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("content_type", sa.String(length=64), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("profile_photos")
