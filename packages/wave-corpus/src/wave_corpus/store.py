"""`ContentAddressedStore` — Parquet endereçado por conteúdo.

O nome do arquivo **é** o hash do conteúdo do `Frame` (ver `frame.py`), então:
- conteúdo idêntico **deduplica** (mesmo caminho — write vira no-op);
- a escrita é **idempotente** e atômica (grava num `.tmp` e renomeia).

Regra rígida (ADR-0025/0030): o **raw** só vive aqui, no corpus de pesquisa —
nunca em produção. Este diretório é gitignored e descartável (ADR-0028).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from .frame import Frame

#: Separador de rótulos na metadata (rótulos de EEG não contêm NUL).
_SEP = "\x00"


class ContentAddressedStore:
    """Store de `Frame`s em Parquet, indexado pelo hash do conteúdo."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    def path_for(self, content_hash: str) -> Path:
        """Caminho content-addressed (sharding git-like pelos 2 primeiros dígitos)."""
        return self.root / "frames" / content_hash[:2] / f"{content_hash}.parquet"

    def exists(self, content_hash: str) -> bool:
        return self.path_for(content_hash).exists()

    def write(self, frame: Frame) -> str:
        """Grava o frame e retorna o `content_hash`. Deduplica por conteúdo."""
        content_hash = frame.content_hash()
        path = self.path_for(content_hash)
        if path.exists():
            return content_hash  # dedup: conteúdo idêntico já está no corpus

        path.parent.mkdir(parents=True, exist_ok=True)
        columns = {label: frame.channels[i] for i, label in enumerate(frame.montage)}
        table = pa.table(
            columns,
            metadata={
                # repr(float) round-trip exato; kind/montagem/hash como bytes.
                b"fs": repr(float(frame.fs)).encode("utf-8"),
                b"kind": frame.kind.encode("utf-8"),
                b"montage": _SEP.join(frame.montage).encode("utf-8"),
                b"content_hash": content_hash.encode("utf-8"),
            },
        )
        tmp = path.with_name(path.name + ".tmp")
        pq.write_table(table, tmp)
        tmp.replace(path)  # rename atômico
        return content_hash

    def read(self, content_hash: str) -> Frame:
        """Lê um frame pelo hash. Levanta `KeyError` se não existir."""
        path = self.path_for(content_hash)
        if not path.exists():
            raise KeyError(content_hash)
        table = pq.read_table(path)
        meta = table.schema.metadata or {}
        fs = float(meta[b"fs"].decode("utf-8"))
        kind = meta[b"kind"].decode("utf-8")
        montage = tuple(meta[b"montage"].decode("utf-8").split(_SEP))
        channels = np.stack(
            [table.column(label).to_numpy(zero_copy_only=False) for label in montage]
        )
        return Frame(channels=channels, fs=fs, montage=montage, kind=kind)
