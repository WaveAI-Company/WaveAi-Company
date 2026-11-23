"""Re-cifra todos os `Result` com a chave atual (emenda à ADR-0026).

Passo 3 da rotação: a chave nova já é a `WAVEAI_API_RESULT_ENCRYPTION_KEY` e a
velha está em `WAVEAI_API_RESULT_ENCRYPTION_PREVIOUS_KEYS`. Este comando passa
por todo o acervo e re-cifra cada blob com a nova; depois dele a velha pode
sair do ambiente sem deixar nada ilegível.

Uso:
    cd services/api
    python -m scripts.rotate_result_key            # re-cifra
    python -m scripts.rotate_result_key --simular  # só confere que tudo decifra

Idempotente: um blob que já está na chave nova é re-cifrado de novo, sem
efeito no conteúdo. Para no primeiro blob que nenhuma chave decifra, sem
gravar nada daquele lote — é sinal de chave faltando, e seguir esconderia isso.
"""

from __future__ import annotations

import argparse
import sys

from app.db.session import get_engine
from app.models.result import Result
from app.security.crypto import get_metrics_cipher
from sqlalchemy import select
from sqlalchemy.orm import Session

LOTE = 200


def rotacionar(session: Session, *, simular: bool = False) -> int:
    """Re-cifra (ou, simulando, só decifra) todos os Result. Devolve quantos."""
    cipher = get_metrics_cipher()
    total = 0
    ultimo_id = None
    while True:
        stmt = select(Result).order_by(Result.id).limit(LOTE)
        if ultimo_id is not None:
            stmt = stmt.where(Result.id > ultimo_id)
        lote = list(session.scalars(stmt))
        if not lote:
            break
        for result in lote:
            if simular:
                cipher.decrypt(result.metrics_encrypted)
            else:
                result.metrics_encrypted = cipher.rotate(result.metrics_encrypted)
            total += 1
        if not simular:
            session.commit()
        ultimo_id = lote[-1].id
    return total


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--simular", action="store_true", help="só confere que tudo decifra")
    args = parser.parse_args(argv)
    with Session(get_engine()) as session:
        total = rotacionar(session, simular=args.simular)
    verbo = "decifráveis" if args.simular else "re-cifrados com a chave atual"
    print(f"rotação da chave do Result: {total} registros {verbo}")
    return 0


if __name__ == "__main__":  # pragma: no cover - entrada de linha de comando
    sys.exit(main())
