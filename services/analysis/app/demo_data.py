"""Gerador de sinal **sintético** para o demo do Exp. B.

LGPD / regra rígida: nenhum dado real de pessoa. Tudo aqui é fictício e
rotulado como tal na resposta da API (`data_source: "synthetic"`).

Espelha o `wave-eeg demo` do CLI: alfa (10 Hz) mais forte na condição de olhos
fechados, sobre ruído gaussiano.
"""

from __future__ import annotations

import numpy as np

FS = 512.0
ALPHA_HZ = 10.0


def _synth(fs: float, secs: float, alpha_amp: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = np.arange(int(fs * secs)) / fs
    return alpha_amp * np.sin(2 * np.pi * ALPHA_HZ * t) + rng.normal(0, 10, t.size)


def synthetic_session(secs: float = 30.0, fs: float = FS):
    """Sessão sintética rotulada: metade olhos fechados (OC), metade abertos (OA)."""
    closed = _synth(fs, secs, alpha_amp=20.0, seed=1)
    opened = _synth(fs, secs, alpha_amp=5.0, seed=2)
    samples = np.concatenate([closed, opened])
    labels = ["OC"] * closed.size + ["OA"] * opened.size
    return samples, labels, fs
