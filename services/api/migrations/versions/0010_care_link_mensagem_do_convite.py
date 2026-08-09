"""adiciona a mensagem opcional (cifrada) ao convite de vínculo

ADR-0043: recado que o solicitante escreve junto do convite. Texto livre de uma
pessoa sobre outra, então vai **cifrado** em repouso, como a anotação do titular
(ADR-0037) — a coluna guarda o blob Fernet, nunca o texto.

Nula em todo vínculo anterior: convite sem recado é a ausência do campo, não
string vazia. Nada a migrar — nenhum dado antigo passa a existir.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "care_links",
        sa.Column("invite_message_encrypted", sa.LargeBinary(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("care_links", "invite_message_encrypted")
