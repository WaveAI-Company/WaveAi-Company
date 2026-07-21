"""care_link declined e versao do consentimento

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-20

Adiciona o estado `declined` ao CareLink (recusa do convite pelo paciente,
ADR-0024) e a versão do termo aceito ao usuário (Medical/72 §2).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `ALTER TYPE ... ADD VALUE` não pode ser usado na MESMA transação em que o
    # valor é adicionado; o autocommit_block fecha a transação da migration para
    # os novos rótulos ficarem visíveis ao recriar o índice parcial adiante.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE care_link_status ADD VALUE IF NOT EXISTS 'declined'")
        op.execute("ALTER TYPE care_link_event_type ADD VALUE IF NOT EXISTS 'declined'")

    op.add_column(
        "care_links",
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
    )

    # `declined` passa a contar como morto: recusar não pode travar um re-convite.
    op.drop_index(
        "uq_care_links_vivo",
        table_name="care_links",
        postgresql_where=sa.text("status <> 'revoked'"),
    )
    op.create_index(
        "uq_care_links_vivo",
        "care_links",
        ["doctor_user_id", "patient_user_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('revoked', 'declined')"),
    )

    op.add_column("users", sa.Column("consent_version", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "consent_version")

    op.drop_index(
        "uq_care_links_vivo",
        table_name="care_links",
        postgresql_where=sa.text("status NOT IN ('revoked', 'declined')"),
    )
    op.create_index(
        "uq_care_links_vivo",
        "care_links",
        ["doctor_user_id", "patient_user_id"],
        unique=True,
        postgresql_where=sa.text("status <> 'revoked'"),
    )
    op.drop_column("care_links", "declined_at")

    # PostgreSQL não remove um valor de enum sem recriar o tipo inteiro. Os
    # rótulos `declined` ficam (inertes) — recriá-los aqui não vale o risco num
    # rollback; um novo upgrade reusa via IF NOT EXISTS.
