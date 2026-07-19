"""cria capture_sessions

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Criado/derrubado explicitamente: no PostgreSQL, derrubar a tabela não remove
# o tipo enum — e o upgrade seguinte falharia com "type already exists".
capture_session_status = sa.Enum(
    "active", "completed", "aborted", name="capture_session_status"
)


def upgrade() -> None:
    capture_session_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "capture_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_user_id", sa.Uuid(), nullable=False),
        sa.Column("device", sa.String(length=64), nullable=False),
        sa.Column("sample_rate", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(name="capture_session_status", create_type=False),
            nullable=False,
        ),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["patient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_capture_sessions_patient_user_id"),
        "capture_sessions",
        ["patient_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_capture_sessions_patient_user_id"), table_name="capture_sessions"
    )
    op.drop_table("capture_sessions")
    capture_session_status.drop(op.get_bind(), checkfirst=True)
