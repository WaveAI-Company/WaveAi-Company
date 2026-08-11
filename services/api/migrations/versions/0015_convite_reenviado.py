"""convite por e-mail: o reenvio vira evento próprio na trilha

O `care_link_events` ganha `resent`. Não é sinônimo de `requested`: convidar
cria o vínculo, reenviar só lembra a contraparte de um convite que já existe —
e numa disputa ("me convidaram uma vez ou cinco?") quem responde é a trilha.

Nada de retroativo: eventos antigos continuam sendo o que eram.

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-10
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `autocommit_block` como na 0006: fecha a transação da migration para o
    # rótulo novo já existir para quem vier depois. Aqui nada mais usa o valor,
    # mas manter o mesmo gesto evita que a próxima migration de enum copie a
    # forma sem a proteção.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE care_link_event_type ADD VALUE IF NOT EXISTS 'resent'")


def downgrade() -> None:
    # Como na 0014: o Postgres não remove valor de enum sem recriar o tipo e
    # reescrever todas as colunas que o usam. O rótulo órfão é inofensivo, e
    # recriar o tipo num downgrade é risco desproporcional ao ganho.
    pass
