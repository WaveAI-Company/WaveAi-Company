"""data da pseudonimização nas três trilhas de leitura (emenda à ADR-0047)

A Política de Privacidade 1.2 promete que a trilha pseudonimizada dura **até 12
meses**. Faltava dizer de quando o prazo conta, e a emenda de 2026-08-23 decidiu:
**da pseudonimização**, não do evento.

Por quê: contar da data do evento faria a evidência sumir no instante da
exclusão para toda leitura com mais de um ano — quem acompanhou alguém em 2026
encerraria a conta em 2028 e levaria a trilha inteira ao sair, que é o buraco
que a ADR-0047 existe para fechar.

As tabelas só guardavam a data do **evento**. Esta coluna é o que torna o prazo
exequível.

Linhas já pseudonimizadas (se houver) recebem a data desta migration. É
conservador — o relógio passa a correr a partir daqui, nunca antes — e é falso
se alguém as ler como data real de pseudonimização. Fora de teste não existe
nenhuma.

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-23
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: As mesmas três trilhas de leitura da 0016. `care_link_events` e
#: `live_share_events` seguem de fora, pelos motivos registrados lá.
TRILHAS = (
    "result_access_events",
    "annotation_access_events",
    "live_view_access_events",
)


def upgrade() -> None:
    for tabela in TRILHAS:
        op.add_column(
            tabela,
            sa.Column("pseudonymized_at", sa.DateTime(timezone=True), nullable=True),
        )
        # Só as linhas que JÁ perderam o dono. Linha com ator vivo tem de
        # continuar com a data nula: nula aqui significa "não foi pseudonimizada",
        # e é o que impede o expurgo de tocá-la.
        op.execute(
            f"UPDATE {tabela} SET pseudonymized_at = now() "
            "WHERE actor_pseudonym IS NOT NULL AND pseudonymized_at IS NULL"
        )


def downgrade() -> None:
    """Remove a coluna e, com ela, a capacidade de cumprir o prazo.

    O dado pseudonimizado continua lá; o que se perde é saber desde quando —
    ou seja, o expurgo passa a não ter critério. Voltar aqui exige voltar
    também a Política ao texto sem prazo.
    """
    for tabela in TRILHAS:
        op.drop_column(tabela, "pseudonymized_at")
