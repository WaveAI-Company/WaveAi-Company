"""cria care_links e auditoria

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-18
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Os tipos enum são criados/derrubados explicitamente: no PostgreSQL derrubar a
# tabela NÃO remove o tipo, e `care_link_party` é usado por DUAS tabelas (criar
# junto com cada uma tentaria criar o mesmo tipo duas vezes).
care_link_status = sa.Enum("pending", "active", "revoked", name="care_link_status")
care_link_party = sa.Enum("doctor", "patient", name="care_link_party")
care_link_event_type = sa.Enum("requested", "accepted", "revoked", name="care_link_event_type")

_TIPOS = (care_link_status, care_link_party, care_link_event_type)


def _coluna_enum(nome: str) -> postgresql.ENUM:
    """Referencia um tipo já existente, sem tentar recriá-lo."""
    return postgresql.ENUM(name=nome, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    for tipo in _TIPOS:
        tipo.create(bind, checkfirst=True)

    op.create_table(
        "care_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("doctor_user_id", sa.Uuid(), nullable=False),
        sa.Column("patient_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", _coluna_enum("care_link_status"), nullable=False),
        sa.Column("initiated_by", _coluna_enum("care_link_party"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["doctor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_care_links_doctor_user_id"), "care_links", ["doctor_user_id"], unique=False
    )
    op.create_index(
        op.f("ix_care_links_patient_user_id"), "care_links", ["patient_user_id"], unique=False
    )
    # Índice parcial: no máximo um vínculo VIVO por par, preservando o
    # histórico dos revogados (re-vínculo cria linha nova, com novo consentimento).
    op.create_index(
        "uq_care_links_vivo",
        "care_links",
        ["doctor_user_id", "patient_user_id"],
        unique=True,
        postgresql_where=sa.text("status <> 'revoked'"),
    )

    op.create_table(
        "care_link_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("care_link_id", sa.Uuid(), nullable=False),
        sa.Column("event", _coluna_enum("care_link_event_type"), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("actor_role", _coluna_enum("care_link_party"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["care_link_id"], ["care_links.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_care_link_events_care_link_id"),
        "care_link_events",
        ["care_link_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_care_link_events_care_link_id"), table_name="care_link_events")
    op.drop_table("care_link_events")
    op.drop_index(
        "uq_care_links_vivo",
        table_name="care_links",
        postgresql_where=sa.text("status <> 'revoked'"),
    )
    op.drop_index(op.f("ix_care_links_patient_user_id"), table_name="care_links")
    op.drop_index(op.f("ix_care_links_doctor_user_id"), table_name="care_links")
    op.drop_table("care_links")

    # Sem isto, um novo upgrade falharia: "type already exists".
    bind = op.get_bind()
    for tipo in reversed(_TIPOS):
        tipo.drop(bind, checkfirst=True)
