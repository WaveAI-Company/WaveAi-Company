"""Leitura do CSV de captura (`t, raw, poor_signal, condition`).

O formato é definido por `wave-eeg capture`. Lido aqui como um **CSV colunar
genérico**, **sem importar o `wave_eeg`** — os pacotes ficam desacoplados
(análise no wave_eeg; storage no wave-corpus). A captação do NeuroSky é de
**canal único**, então vira um `Frame` com montagem de 1 rótulo (ADR-0033).
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from .frame import Frame

# Rótulos aceitos → condição canônica (espelha os do wave_eeg.exp_b).
_OC = {"OC", "OF", "EYES_CLOSED", "FECHADO", "FECHADOS"}
_OA = {"OA", "EYES_OPEN", "ABERTO", "ABERTOS"}


def _condition(label: str) -> str:
    u = str(label).strip().upper()
    if u in _OC:
        return "eyes_closed"
    if u in _OA:
        return "eyes_open"
    raise ValueError(f"condição desconhecida no CSV: {label!r}")


@dataclass
class CaptureFrame:
    """Um `Frame` de captura + os metadados extraídos do CSV."""

    frame: Frame
    condition: Optional[str]
    poor_signal: Optional[float]


def read_capture_frame(path: str, *, montage: Sequence[str], kind: str = "raw") -> CaptureFrame:
    """Lê um CSV de captura → `Frame` (canal único) + condição + poor_signal médio.

    `fs` é calculado pelos **timestamps reais** do arquivo (nunca juntando blocos).
    """
    montage = tuple(montage)
    if len(montage) != 1:
        raise ValueError("captura do NeuroSky é canal único: montagem deve ter 1 rótulo")

    ts, raw, poor, labels = [], [], [], []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            try:
                raw.append(float(row["raw"]))
            except (KeyError, ValueError):
                continue
            ts.append(float(row.get("t") or "nan"))
            ps = (row.get("poor_signal") or "").strip()
            poor.append(float(ps) if ps else np.nan)
            label = (row.get("condition") or "").strip()
            if label:
                labels.append(label)

    if not raw:
        raise ValueError(f"{path}: sem coluna 'raw' utilizável")
    raw_arr = np.asarray(raw, dtype=float)

    t = np.asarray(ts, dtype=float)
    finite_t = t[np.isfinite(t)]
    if finite_t.size < 2 or (finite_t.max() - finite_t.min()) <= 0:
        raise ValueError(f"{path}: timestamps insuficientes para estimar fs")
    fs = raw_arr.size / float(finite_t.max() - finite_t.min())

    p = np.asarray(poor, dtype=float)
    finite_p = p[np.isfinite(p)]
    poor_mean = float(finite_p.mean()) if finite_p.size else None
    condition = _condition(labels[0]) if labels else None

    frame = Frame(channels=raw_arr[None, :], fs=fs, montage=montage, kind=kind)
    return CaptureFrame(frame=frame, condition=condition, poor_signal=poor_mean)
