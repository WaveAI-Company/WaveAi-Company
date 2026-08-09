"""compartilhamento ao vivo por sessao, decidido pelo titular

ADR-0045. `capture_sessions.live_sharing_enabled` e a fonte da verdade sobre
"esta sessao esta sendo compartilhada"; `live_share_events` guarda cada
liga/desliga, nao so o estado final.

**Nasce desligado, inclusive nas sessoes antigas.** Compartilhamento e ato do
titular: ligar retroativamente uma sessao que ninguem autorizou seria inventar
consentimento. Sessoes ja encerradas nao sao afetadas na pratica (nao ha o que
transmitir), mas o default correto e o mesmo.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "capture_sessions",
        sa.Column(
            "live_sharing_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_table(
        "live_share_events",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column(
            "patient_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("capture_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_live_share_events_patient_user_id", "live_share_events", ["patient_user_id"]
    )
    op.create_index("ix_live_share_events_session_id", "live_share_events", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_live_share_events_session_id", table_name="live_share_events")
    op.drop_index("ix_live_share_events_patient_user_id", table_name="live_share_events")
    op.drop_table("live_share_events")
    op.drop_column("capture_sessions", "live_sharing_enabled")
