"""exclusão de conta: a trilha de leitura de terceiros sobrevive ao ator (ADR-0047)

Nas três trilhas de **leitura** — `result_access_events`,
`annotation_access_events` e `live_view_access_events` — o `actor_user_id`
passa a ser anulável, com `ON DELETE SET NULL` no lugar do `CASCADE`, e cada
tabela ganha `actor_pseudonym`.

Por quê: com o `CASCADE`, apagar a conta de um profissional apagava todo evento
em que ele foi o ator — **inclusive na trilha de outras pessoas**. Quem é
auditado apagava a própria auditoria ao sair, e o titular perdia a evidência de
que houve leitura. Agora o evento fica, sem apontar para ninguém, e o
pseudônimo (gravado na exclusão) mantém legível que "foi o mesmo ator".

`care_link_events` **não** entra: ele já cascateia de `care_links`, e vínculo
com uma parte a menos não é vínculo. `live_share_events` não entra porque não
tem ator — só o titular liga e desliga.

Nada de retroativo: linhas existentes seguem com o ator preenchido e o
pseudônimo nulo, que é exatamente o que elas significam.

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-23
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: As três trilhas de leitura, com o nome da constraint que o Postgres gerou.
TRILHAS = (
    ("result_access_events", "result_access_events_actor_user_id_fkey"),
    ("annotation_access_events", "annotation_access_events_actor_user_id_fkey"),
    ("live_view_access_events", "live_view_access_events_actor_user_id_fkey"),
)


def upgrade() -> None:
    for tabela, constraint in TRILHAS:
        op.add_column(
            tabela,
            sa.Column("actor_pseudonym", sa.Uuid(), nullable=True),
        )
        op.alter_column(tabela, "actor_user_id", existing_type=sa.Uuid(), nullable=True)
        op.drop_constraint(constraint, tabela, type_="foreignkey")
        op.create_foreign_key(
            constraint, tabela, "users", ["actor_user_id"], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    """Volta ao `CASCADE`, reabrindo o buraco que a ADR-0047 fechou.

    **Linhas com ator nulo impedem o downgrade**, e isso é de propósito: elas
    são exatamente as trilhas de contas encerradas, e torná-las `NOT NULL` de
    novo exigiria inventar um ator ou apagá-las. Quem precisar descer de
    verdade tem de decidir o que fazer com elas primeiro, conscientemente.
    """
    for tabela, constraint in TRILHAS:
        op.drop_constraint(constraint, tabela, type_="foreignkey")
        op.create_foreign_key(
            constraint, tabela, "users", ["actor_user_id"], ["id"], ondelete="CASCADE"
        )
        op.alter_column(tabela, "actor_user_id", existing_type=sa.Uuid(), nullable=False)
        op.drop_column(tabela, "actor_pseudonym")
