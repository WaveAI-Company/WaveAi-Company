"""Apaga a trilha de leitura pseudonimizada vencida (emenda à ADR-0047).

É este comando que cumpre a promessa da Política de Privacidade 1.2: registros
de leitura que perderam o dono duram **até 12 meses**. Sem alguém executando
isto de tempos em tempos, o texto publicado afirma o que o produto não faz.

Feito para virar **job agendado** na infraestrutura de produção (ADR-0049). Roda
uma vez e sai; não é serviço, não fica em memória e não depende da API estar no
ar — só do banco.

Uso:
    cd services/api
    python -m scripts.purge_audit_trail            # apaga
    python -m scripts.purge_audit_trail --simular  # só conta, não apaga

O prazo vem de `WAVEAI_API_AUDIT_PSEUDONYM_RETENTION_DAYS` (padrão 365).
`--dias` sobrepõe, para ensaio; ele **não** deve ser usado para guardar por mais
tempo que o prometido no texto.

Sai com código 0 mesmo quando não há nada a apagar: "nada vencido" é sucesso, e
um agendador que trate isso como falha vira alarme falso diário.
"""

from __future__ import annotations

import argparse
import sys

from app.config import get_settings
from app.db.session import get_engine
from app.services.audit_retention import expurgar_trilha_pseudonimizada
from sqlalchemy.orm import Session


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--simular",
        action="store_true",
        help="conta o que sairia e não apaga nada",
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=None,
        help="sobrepõe o prazo de retenção (ensaio; o padrão vem do ambiente)",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    retencao = args.dias if args.dias is not None else settings.audit_pseudonym_retention_days

    with Session(get_engine()) as session:
        resultado = expurgar_trilha_pseudonimizada(
            session,
            retencao_dias=retencao,
            simulacao=args.simular,
        )
        if not args.simular:
            session.commit()

    verbo = "sairiam" if resultado.simulacao else "apagados"
    # O corte vai no log de propósito: o número sozinho não permite conferir se
    # o prazo foi respeitado, e é isso que alguém auditando vai querer ver.
    print(
        f"expurgo da trilha pseudonimizada: {resultado.total} registros {verbo} "
        f"(retenção {retencao} dias, corte em {resultado.corte.isoformat()})"
    )
    for tabela, quantidade in resultado.apagados.items():
        print(f"  {tabela}: {quantidade}")
    return 0


if __name__ == "__main__":  # pragma: no cover - entrada de linha de comando
    sys.exit(main())
