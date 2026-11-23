"""índice parcial em `pseudonymized_at` nas três trilhas de leitura

O expurgo diário (emenda à ADR-0047) procura, em `result_access_events`,
`annotation_access_events` e `live_view_access_events`, as linhas com
`pseudonymized_at` preenchida e mais velha que o prazo. Sem índice, cada
execução varre a tabela inteira. Irrelevante no volume de hoje — e por isso
estava registrado como dívida, não como defeito (`Documentation/17` §5) —, mas
as trilhas só crescem: uma linha por leitura de Result, anotação ou transmissão.

**Parcial** (`WHERE pseudonymized_at IS NOT NULL`): quase todas as linhas têm o
campo nulo (ator vivo) e nunca entram no expurgo. O índice guarda só as que
podem entrar, e fica do tamanho do que interessa.

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-23
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABELAS = (
    "result_access_events",
    "annotation_access_events",
    "live_view_access_events",
)


def upgrade() -> None:
    for tabela in _TABELAS:
        op.create_index(
            f"ix_{tabela}_pseudonymized_at",
            tabela,
            ["pseudonymized_at"],
            postgresql_where=sa.text("pseudonymized_at IS NOT NULL"),
        )


def downgrade() -> None:
    for tabela in _TABELAS:
        op.drop_index(f"ix_{tabela}_pseudonymized_at", table_name=tabela)
