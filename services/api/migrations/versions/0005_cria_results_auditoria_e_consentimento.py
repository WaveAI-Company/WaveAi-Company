"""cria results, auditoria e consentimento

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-20
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Criado/derrubado explicitamente: no PostgreSQL, derrubar a tabela não remove
# o tipo enum, e um novo upgrade falharia com "type already exists".
result_access_action = sa.Enum(
    "created", "read", "exported", "deleted", name="result_access_action"
)


def upgrade() -> None:
    result_access_action.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "result_access_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_user_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "action",
            postgresql.ENUM(name="result_access_action", create_type=False),
            nullable=False,
        ),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_result_access_events_patient_user_id"),
        "result_access_events",
        ["patient_user_id"],
        unique=False,
    )

    op.create_table(
        "results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("patient_user_id", sa.Uuid(), nullable=False),
        sa.Column("engine_version", sa.String(length=128), nullable=False),
        sa.Column("metrics_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["patient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["capture_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index(
        op.f("ix_results_patient_user_id"), "results", ["patient_user_id"], unique=False
    )

    op.add_column(
        "users", sa.Column("consent_given_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "consent_given_at")
    op.drop_index(op.f("ix_results_patient_user_id"), table_name="results")
    op.drop_table("results")
    op.drop_index(
        op.f("ix_result_access_events_patient_user_id"), table_name="result_access_events"
    )
    op.drop_table("result_access_events")
    result_access_action.drop(op.get_bind(), checkfirst=True)
