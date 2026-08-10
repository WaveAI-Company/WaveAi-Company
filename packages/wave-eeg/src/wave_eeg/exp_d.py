"""Exp. D — caracterização de artefatos (DataScience/31 §14, TRAVADO).

Diferente de B/C: é **caracterização**, não um contraste com hipótese primária.
Cada bloco é rotulado por **um tipo de artefato** (ou CLEAN); para cada artefato
comparamos a **assinatura** contra o CLEAN de referência:

- **amplitude** (`rms_ratio` = RMS do artefato / RMS do CLEAN);
- **detectabilidade** (`detect_rate` = fração de épocas do artefato acima do
  limiar de amplitude derivado do CLEAN: média + 3σ do RMS por época);
- **contaminação por banda** (`band_delta` = potência relativa por banda menos a
  do CLEAN) — mostra quais bandas cada artefato infla.

Isso alimenta o gate de qualidade (ADR-0031) e a feature "pico → contexto":
em FP1, um "pico" cru é quase sempre artefato — precisamos separá-lo do cérebro.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field

import numpy as np
from scipy import signal as sp_signal

from .analysis import BANDS, mains_power, preprocess, relative_band_powers, total_power
from .exp_b import Block, fs_from_duration

CLEAN = "clean"
BLINK = "blink"
EOG = "eog"
JAW = "jaw"
BROW = "brow"
SPEAK = "speak"
HEAD = "head"

_LABEL_MAP = {
    "CLEAN": CLEAN, "BASELINE": CLEAN, "LIMPO": CLEAN,
    "BLINK": BLINK, "PISCADA": BLINK,
    "EOG": EOG, "OLHOS": EOG,
    "JAW": JAW, "MANDIBULA": JAW,
    "BROW": BROW, "SOBRANCELHA": BROW,
    "SPEAK": SPEAK, "FALA": SPEAK,
    "HEAD": HEAD, "CABECA": HEAD,
}


def condition_from_label(label: str) -> str:
    u = str(label).strip().upper()
    if u in _LABEL_MAP:
        return _LABEL_MAP[u]
    raise ValueError(f"artefato desconhecido no CSV: {label!r}")


@dataclass
class ArtifactSignature:
    """Assinatura de um artefato (ou CLEAN) vs o CLEAN de referência."""

    label: str
    n_epochs: int
    rms_ratio: float          # amplitude relativa ao CLEAN
    detect_rate: float        # fração de épocas acima do limiar do CLEAN
    band_delta: dict[str, float] = field(default_factory=dict)  # rel band power − CLEAN
    mains_ratio: float = float("nan")


def _epochs(x, fs, epoch_s):
    n = int(epoch_s * fs)
    x = np.asarray(x, dtype=float)
    if n <= 0 or x.size < n:
        return [x]
    return [x[s:s + n] for s in range(0, x.size - n + 1, n)]


def _epoch_rms(x) -> float:
    xd = sp_signal.detrend(np.asarray(x, dtype=float))
    return float(np.sqrt(np.mean(xd * xd)))


def _block_metrics(block, discard_s, epoch_s):
    n_discard = int(discard_s * block.fs)
    x = np.asarray(block.samples, dtype=float)[n_discard:]
    eps = _epochs(x, block.fs, epoch_s)
    rms = np.array([_epoch_rms(e) for e in eps])
    rbp, mains = [], []
    for e in eps:
        ef = preprocess(e, block.fs)  # banda 1–45 + notch: contaminação residual
        rbp.append(relative_band_powers(ef, block.fs))
        tp = total_power(e, block.fs)
        mains.append(mains_power(e, block.fs) / tp if tp else 0.0)
    return rms, rbp, np.array(mains)


def characterize(blocks, *, discard_s: float = 5.0, epoch_s: float = 4.0):
    """Caracteriza cada artefato vs o CLEAN. Retorna (signatures, info)."""
    per_label: dict[str, dict] = {}
    for block in blocks:
        label = block.condition
        if label not in _LABEL_MAP.values():
            raise ValueError(f"artefato desconhecido: {label!r}")
        rms, rbp, mains = _block_metrics(block, discard_s, epoch_s)
        acc = per_label.setdefault(label, {"rms": [], "rbp": [], "mains": []})
        acc["rms"].append(rms)
        acc["rbp"].extend(rbp)
        acc["mains"].append(mains)

    if CLEAN not in per_label:
        raise ValueError("Exp. D exige ao menos um bloco CLEAN de referência")

    clean_rms = np.concatenate(per_label[CLEAN]["rms"])
    clean_rms_mean = float(clean_rms.mean())
    threshold = clean_rms_mean + 3.0 * float(clean_rms.std())
    clean_band = {k: float(np.mean([d[k] for d in per_label[CLEAN]["rbp"]])) for k in BANDS}

    signatures = []
    for label, acc in per_label.items():
        rms_all = np.concatenate(acc["rms"])
        mains_all = np.concatenate(acc["mains"])
        band = {k: float(np.mean([d[k] for d in acc["rbp"]])) for k in BANDS}
        signatures.append(
            ArtifactSignature(
                label=label,
                n_epochs=int(rms_all.size),
                rms_ratio=(
                    float(rms_all.mean() / clean_rms_mean) if clean_rms_mean else float("inf")
                ),
                detect_rate=float(np.mean(rms_all > threshold)),
                band_delta={k: band[k] - clean_band[k] for k in BANDS},
                mains_ratio=float(mains_all.mean()),
            )
        )
    # CLEAN primeiro, resto por rms_ratio decrescente (mais "forte" no topo).
    signatures.sort(key=lambda s: (s.label != CLEAN, -s.rms_ratio))
    return signatures, {"clean_rms_mean": clean_rms_mean, "detect_threshold": threshold}


def read_capture_csv(path: str):
    """Lê um CSV de captura com rótulo de artefato (CLEAN/BLINK/…)."""
    ts, raw, labels = [], [], []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            try:
                raw.append(float(row["raw"]))
            except (KeyError, ValueError):
                continue
            ts.append(float(row.get("t") or "nan"))
            label = (row.get("condition") or "").strip()
            if label:
                labels.append(label)
    if not raw:
        raise ValueError(f"{path}: sem coluna 'raw' utilizável")
    if not labels:
        raise ValueError(f"{path}: sem coluna 'condition'")
    return np.asarray(raw, float), np.asarray(ts, float), condition_from_label(labels[0])


def load_blocks(paths):
    blocks = []
    for path in paths:
        raw, t, condition = read_capture_csv(path)
        finite_t = t[np.isfinite(t)]
        if finite_t.size < 2 or (finite_t.max() - finite_t.min()) <= 0:
            raise ValueError(f"{path}: timestamps insuficientes para estimar fs")
        fs = fs_from_duration(raw.size, float(finite_t.max() - finite_t.min()))
        blocks.append(Block(condition=condition, samples=raw, fs=fs))
    return blocks


def synth_artifacts(*, fs: float = 512.0, block_s: float = 60.0, seed: int = 0):
    """Blocos sintéticos: CLEAN + BLINK (grande, baixa freq) + JAW (EMG, alta freq).

    Para teste/reprodutibilidade — não substitui a captura real (ADR-0028).
    """
    rng = np.random.default_rng(seed)
    n = int(block_s * fs)
    t = np.arange(n) / fs

    def _clean(s):
        r = np.random.default_rng(s)
        return 10 * np.sin(2 * np.pi * 10 * t) + r.normal(0, 8, n)

    clean = _clean(seed)
    # BLINK: bumps gaussianos grandes (~0,3 s) a cada ~1,5 s -> alta amplitude, baixa freq.
    blink = _clean(seed + 1)
    for c in np.arange(1.0, block_s, 1.5):
        blink += 300 * np.exp(-0.5 * ((t - c) / 0.15) ** 2)
    # JAW/EMG: componente de alta frequência (25 Hz) contínua -> infla beta, sobe RMS.
    jaw = _clean(seed + 2) + 55 * np.sin(2 * np.pi * 25 * t) + rng.normal(0, 6, n)

    return [
        Block(condition=CLEAN, samples=clean, fs=fs),
        Block(condition=BLINK, samples=blink, fs=fs),
        Block(condition=JAW, samples=jaw, fs=fs),
    ]
