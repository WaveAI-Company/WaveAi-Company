"""adiciona device e montagem (em claro) ao Result

ADR-0033 (proveniência device-agnóstica): grava o aparelho e a montagem que
produziram o sinal, ao lado de `engine_version`, para comparabilidade entre
aparelhos. São metadados de origem (não sinal), por isso ficam em claro e não
no blob cifrado. Nulos em Result anteriores — proveniência desconhecida, não
inventada.

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("results", sa.Column("device", sa.String(length=64), nullable=True))
    op.add_column("results", sa.Column("montage", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("results", "montage")
    op.drop_column("results", "device")
