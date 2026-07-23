"""`Frame` — quadro de sinal do corpus de pesquisa.

Modelo de dado **multicanal desde já** (ADR-0033): `canais × amostras` + `fs` +
`montagem` (rótulos por canal) + `kind`. O NeuroSky preenche **N=1**
(`montagem=("FP1",)`); o mesmo tipo aceita N>1 (ex.: um aparelho de 4 canais)
**sem mudar o código** — mas nenhum driver novo entra aqui.

O `content_hash` é derivado do **conteúdo do frame**, não da serialização
Parquet: assim a deduplicação é determinística (dois writes do mesmo sinal dão o
mesmo hash), independente de metadados de arquivo.
"""
from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass

import numpy as np

#: Versão do esquema de hashing. Muda se a canonicalização mudar (rastreabilidade).
HASH_SCHEMA = b"wave_corpus.frame.v1"


@dataclass(frozen=True)
class Frame:
    """Sinal `canais × amostras` com metadados de captação.

    `channels` é normalizado para `float64` C-contíguo em 2D. `montage` tem um
    rótulo por canal, na ordem das linhas de `channels`.
    """

    channels: np.ndarray
    fs: float
    montage: tuple[str, ...]
    kind: str = "raw"

    def __post_init__(self) -> None:
        arr = np.ascontiguousarray(self.channels, dtype=np.float64)
        if arr.ndim != 2:
            raise ValueError("channels deve ser 2D (canais × amostras)")
        montage = tuple(self.montage)
        if arr.shape[0] != len(montage):
            raise ValueError(
                f"montage precisa de um rótulo por canal: {len(montage)} rótulos "
                f"para {arr.shape[0]} canais"
            )
        # dataclass frozen: contorna a imutabilidade para gravar os valores normalizados.
        object.__setattr__(self, "channels", arr)
        object.__setattr__(self, "montage", montage)

    @property
    def n_channels(self) -> int:
        return int(self.channels.shape[0])

    @property
    def n_samples(self) -> int:
        return int(self.channels.shape[1])

    def content_hash(self) -> str:
        """SHA-256 do conteúdo canônico (kind + montagem + fs + forma + amostras)."""
        h = hashlib.sha256()
        h.update(HASH_SCHEMA)
        h.update(self.kind.encode("utf-8"))
        h.update(b"\x00")
        h.update("\x00".join(self.montage).encode("utf-8"))
        h.update(b"\x00")
        h.update(struct.pack("<d", float(self.fs)))
        h.update(struct.pack("<qq", *self.channels.shape))
        h.update(self.channels.tobytes(order="C"))
        return h.hexdigest()
