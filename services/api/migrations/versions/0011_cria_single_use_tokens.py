"""cria a tabela de tokens de uso único dos fluxos por e-mail

ADR-0044: base das fatias 5 (verificação de e-mail) e 6 (recuperação de senha).
Guarda **só o hash** do valor opaco, como `refresh_tokens` (ADR-0021), mais o
propósito — que impede um token de verificação de valer como reset de senha.

Tabela nova e vazia: nada a migrar.

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PURPOSE = sa.Enum(
    "email_verification",
    "password_reset",
    name="single_use_token_purpose",
)


def upgrade() -> None:
    op.create_table(
        "single_use_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", PURPOSE, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_single_use_tokens_user_id", "single_use_tokens", ["user_id"])
    op.create_index(
        "ix_single_use_tokens_token_hash", "single_use_tokens", ["token_hash"], unique=True
    )
    op.create_index(
        "ix_single_use_tokens_user_purpose", "single_use_tokens", ["user_id", "purpose"]
    )


def downgrade() -> None:
    op.drop_index("ix_single_use_tokens_user_purpose", table_name="single_use_tokens")
    op.drop_index("ix_single_use_tokens_token_hash", table_name="single_use_tokens")
    op.drop_index("ix_single_use_tokens_user_id", table_name="single_use_tokens")
    op.drop_table("single_use_tokens")
    # O enum nomeado sobrevive ao DROP TABLE no Postgres — sem isto, um
    # `upgrade` seguinte falharia com "type already exists".
    PURPOSE.drop(op.get_bind(), checkfirst=True)
