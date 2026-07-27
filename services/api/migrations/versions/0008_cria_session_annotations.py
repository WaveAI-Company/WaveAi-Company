"""cria session_annotations e a auditoria dedicada (ADR-0037)

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Criado/derrubado explicitamente: no PostgreSQL, derrubar a tabela não remove
# o tipo enum, e um novo upgrade falharia com "type already exists".
annotation_access_action = sa.Enum(
    "created", "updated", "read", "exported", "deleted", name="annotation_access_action"
)


def upgrade() -> None:
    annotation_access_action.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "annotation_access_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_user_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "action",
            postgresql.ENUM(name="annotation_access_action", create_type=False),
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
        op.f("ix_annotation_access_events_patient_user_id"),
        "annotation_access_events",
        ["patient_user_id"],
        unique=False,
    )

    op.create_table(
        "session_annotations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("patient_user_id", sa.Uuid(), nullable=False),
        sa.Column("note_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["patient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["session_id"], ["capture_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index(
        op.f("ix_session_annotations_patient_user_id"),
        "session_annotations",
        ["patient_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_session_annotations_patient_user_id"), table_name="session_annotations"
    )
    op.drop_table("session_annotations")
    op.drop_index(
        op.f("ix_annotation_access_events_patient_user_id"),
        table_name="annotation_access_events",
    )
    op.drop_table("annotation_access_events")
    annotation_access_action.drop(op.get_bind(), checkfirst=True)
