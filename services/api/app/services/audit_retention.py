"""Expurgo da trilha de leitura **pseudonimizada** (emenda à ADR-0047).

A Política de Privacidade 1.2 promete que os registros de leitura que perderam
o dono são mantidos **por até 12 meses**. Este módulo é quem cumpre a promessa —
sem ele, o texto publicado afirmaria o que o produto não faz (ADR-0027).

**O que é apagado:** linha das três trilhas de leitura cujo ator já foi
pseudonimizado (`pseudonymized_at` preenchida) há mais tempo que o prazo.

**O que nunca é tocado:** linha com ator vivo. `pseudonymized_at` nula significa
"não foi pseudonimizada", e é exatamente esse teste que mantém a trilha em pé
enquanto a conta do ator existir — por mais antigo que o evento seja. A trilha
de leitura completa é a garantia da ADR-0037, e o prazo só existe para o
registro **órfão**, que já não identifica ninguém.

**Por que a linha inteira, e não só o pseudônimo:** "mantidos por até 12 meses" é
o que a Política diz. Manter a linha sem identificador seria continuar mantendo
o registro, e o texto passaria a não descrever o produto.

**Por que um comando, e não um gatilho:** pendurar o expurgo numa exclusão de
conta ou numa leitura de trilha faria o cumprimento do prazo depender de alguém
aparecer. Se ninguém excluísse conta por dois anos, nada seria apagado e o
documento estaria mentindo em silêncio. Aqui a rotina é explícita e feita para
ser agendada.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models.annotation import AnnotationAccessEvent
from ..models.live_view import LiveViewAccessEvent
from ..models.result import ResultAccessEvent

#: As três trilhas de **leitura** da ADR-0047, na mesma ordem da migration 0016.
#: `care_link_events` não entra (cascateia do vínculo) e `live_share_events`
#: também não (não tem ator: só o titular liga e desliga).
TRILHAS = (ResultAccessEvent, AnnotationAccessEvent, LiveViewAccessEvent)


@dataclass(frozen=True)
class ResultadoDoExpurgo:
    """Quantas linhas saíram de cada trilha, e o corte usado.

    `corte` viaja junto de propósito: quem lê o log precisa saber **até quando**
    a rodada apagou, senão o número sozinho não diz se o prazo foi respeitado.
    """

    apagados: dict[str, int]
    corte: datetime
    simulacao: bool

    @property
    def total(self) -> int:
        return sum(self.apagados.values())


def expurgar_trilha_pseudonimizada(
    session: Session,
    *,
    retencao_dias: int,
    agora: datetime | None = None,
    simulacao: bool = False,
) -> ResultadoDoExpurgo:
    """Apaga registros pseudonimizados mais velhos que `retencao_dias`.

    `agora` é injetável para o teste poder provar o limite dos dois lados sem
    esperar um ano. `simulacao` conta o que sairia sem apagar nada — é o que
    permite rodar em produção antes de confiar na rotina.

    Não faz commit: quem chama decide a transação. O comando de linha faz.
    """
    if retencao_dias < 0:
        raise ValueError("retencao_dias não pode ser negativo")

    referencia = agora or datetime.now(UTC)
    corte = referencia - timedelta(days=retencao_dias)

    apagados: dict[str, int] = {}
    for modelo in TRILHAS:
        # O `is not None` é REDUNDANTE em SQL e está aqui de propósito, com o
        # rótulo à vista: `NULL < corte` é desconhecido, então a linha de ator
        # vivo já não seria apagada só pela comparação. Medido em 2026-08-23 —
        # removê-lo não faz nenhum teste falhar.
        #
        # Fica porque a regra que ele expressa ("só expira quem perdeu o dono")
        # é a garantia da ADR-0037, e depender de trivialidade de SQL de três
        # valores para sustentá-la é frágil: uma troca de dialeto, um `COALESCE`
        # bem-intencionado ou uma reescrita da consulta a desfazem em silêncio.
        # Quem discrimina de verdade é o teste que troca o critério para a data
        # do evento — esse derruba cinco testes.
        criterio = (
            modelo.pseudonymized_at.is_not(None),
            modelo.pseudonymized_at < corte,
        )
        if simulacao:
            apagados[modelo.__tablename__] = (
                session.query(modelo).filter(*criterio).count()
            )
            continue
        resultado = session.execute(delete(modelo).where(*criterio))
        apagados[modelo.__tablename__] = resultado.rowcount or 0

    return ResultadoDoExpurgo(apagados=apagados, corte=corte, simulacao=simulacao)
