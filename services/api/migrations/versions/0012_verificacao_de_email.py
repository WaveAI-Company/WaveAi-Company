"""verificação de e-mail: marca de posse no usuário e código no token

ADR-0044 + emenda. `users.email_verified_at` prova posse do endereço;
`single_use_tokens` ganha a forma **digitável** do segredo (`code_hash`, 6
dígitos) e o contador de tentativas que faz o código queimar.

**Passo que não pode faltar:** toda conta preexistente é marcada como
**verificada**. Sem isto, no dia em que o gate for ligado ninguém entraria —
inclusive as contas de seed. Uma conta que já existe antes de a verificação
existir não pode ser punida retroativamente por não ter passado por ela.

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Toda conta que já existia entra como verificada (ver docstring).
    op.execute("UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL")

    op.add_column(
        "single_use_tokens", sa.Column("code_hash", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "single_use_tokens",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_single_use_tokens_code_hash", "single_use_tokens", ["code_hash"]
    )


def downgrade() -> None:
    op.drop_index("ix_single_use_tokens_code_hash", table_name="single_use_tokens")
    op.drop_column("single_use_tokens", "attempts")
    op.drop_column("single_use_tokens", "code_hash")
    op.drop_column("users", "email_verified_at")
