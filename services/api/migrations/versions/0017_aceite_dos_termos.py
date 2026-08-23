"""aceite dos Termos no cadastro: versão e data no usuário (ADR-0048)

Espelha o que o consentimento já guarda (`consent_version` +
`consent_given_at`): registrar **o que** a pessoa aceitou, não só quando.

Ambas anuláveis, e **sem backfill**. Nulo significa "não temos registro" — que
é a verdade para as contas anteriores a esta coluna — e nunca "recusou".
Preencher por suposição seria fabricar consentimento.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-23
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("accepted_terms_version", sa.String(32), nullable=True))
    op.add_column(
        "users",
        sa.Column("accepted_terms_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Descer **apaga o registro de aceite**, sem cópia.

    Não é reversível de fato: a informação de que alguém aceitou, e de qual
    versão, deixa de existir. Quem descer precisa saber disso.
    """
    op.drop_column("users", "accepted_terms_at")
    op.drop_column("users", "accepted_terms_version")
