"""CLI `research` do corpus de pesquisa (ADR-0030).

`research ingest` move um dataset **sintético** ou de **autocaptação do dev**
(ADR-0028) para o corpus: grava o `Frame` no store content-addressed, registra a
sessão/artefato no índice e, opcionalmente, um `ResearchResult` com a tétrade de
proveniência.
"""
from __future__ import annotations

import argparse
import json
from typing import Optional, Sequence

import numpy as np

from .frame import Frame
from .gitref import current_commit
from .index import CorpusIndex
from .ingest import ingest_frame
from .provenance import Provenance


def _load_array(path: str) -> np.ndarray:
    if path.endswith(".npy"):
        arr = np.load(path)
    elif path.endswith(".csv"):
        arr = np.loadtxt(path, delimiter=",")
    else:
        raise SystemExit(f"formato não suportado: {path} (use .npy ou .csv)")
    arr = np.asarray(arr, dtype=float)
    if arr.ndim == 1:  # 1D = canal único
        arr = arr[None, :]
    return arr


def _cmd_ingest(args: argparse.Namespace) -> int:
    montage = tuple(m.strip() for m in args.montage.split(",") if m.strip())
    arr = _load_array(args.input)
    if arr.shape[0] != len(montage):
        raise SystemExit(
            f"montagem ({len(montage)} rótulos) não bate com os canais ({arr.shape[0]})"
        )
    frame = Frame(channels=arr, fs=args.fs, montage=montage, kind=args.kind)

    index = CorpusIndex(database_url=args.database_url, root=args.root)
    index.create_all()
    session_id, dataset_version = ingest_frame(
        index,
        frame,
        device=args.device,
        condition=args.condition,
        poor_signal=args.poor_signal,
    )
    print(f"session_id={session_id}")
    print(f"dataset_version={dataset_version}")

    if args.engine_version:
        prov = Provenance(
            git_commit=args.commit or current_commit(),
            dataset_version=dataset_version,
            engine_version=args.engine_version,
            hyperparameters=json.loads(args.hyperparams),
        )
        result_id = index.add_result(session_id, dataset_version, prov)
        print(f"result_id={result_id}")
        print(f"computation_id={prov.computation_id()}")
    return 0


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="research", description="Corpus de pesquisa do WaveAI (ADR-0030)"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    ing = sub.add_parser("ingest", help="ingere um dataset sintético/autocaptação no corpus")
    ing.add_argument("--input", required=True, help=".npy/.csv (1D=canal único ou canais×amostras)")
    ing.add_argument("--device", required=True)
    ing.add_argument("--montage", required=True, help="rótulos por canal, separados por vírgula (ex.: FP1)")
    ing.add_argument("--fs", type=float, required=True)
    ing.add_argument("--condition", default=None)
    ing.add_argument("--poor-signal", type=float, default=None, dest="poor_signal")
    ing.add_argument("--kind", default="raw")
    ing.add_argument("--root", default="_corpus")
    ing.add_argument("--database-url", default="sqlite:///_corpus/index.db", dest="database_url")
    # ResearchResult opcional (com a tétrade de proveniência)
    ing.add_argument("--engine-version", default=None, dest="engine_version",
                     help="se dado, grava um ResearchResult com a tétrade de proveniência")
    ing.add_argument("--hyperparams", default="{}", help="JSON dos hiperparâmetros")
    ing.add_argument("--commit", default=None, help="commit do código; default = git HEAD")
    ing.set_defaults(func=_cmd_ingest)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
