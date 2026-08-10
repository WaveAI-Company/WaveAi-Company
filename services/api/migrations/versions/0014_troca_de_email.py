"""troca do e-mail da conta: propósito novo e o endereço pretendido no token

3ª emenda à ADR-0044. Duas mudanças, ambas em `single_use_tokens`:

- o enum de propósito ganha `email_change` — é o `purpose` que impede um token
  de verificação de servir como troca de endereço, e vice-versa;
- `new_email` guarda o endereço pretendido **até a confirmação**. Mora aqui, e
  não num `pending_email` em `users`, porque a troca pendente tem exatamente o
  ciclo de vida do token (prazo, uso único, supersede): uma coluna no usuário
  ficaria pendurada quando o token expirasse.

Nada de retroativo: não há troca pendente para migrar.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `ALTER TYPE ... ADD VALUE` não roda dentro de bloco transacional em
    # Postgres < 12; daqui para cima roda, e o compose/CI usam o 16.
    op.execute("ALTER TYPE single_use_token_purpose ADD VALUE IF NOT EXISTS 'email_change'")
    op.add_column(
        "single_use_tokens", sa.Column("new_email", sa.String(length=320), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("single_use_tokens", "new_email")
    # O valor do enum NÃO é removido: o Postgres não sabe tirar valor de enum
    # sem recriar o tipo e reescrever todas as colunas que o usam. Deixar o
    # rótulo órfão é inofensivo — nenhuma linha o referencia depois que a
    # coluna sai —, e recriar o tipo num downgrade é risco desproporcional.
