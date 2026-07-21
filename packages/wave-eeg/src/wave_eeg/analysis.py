"""
Análise de sinal EEG — pré-processamento, PSD, potências de banda e o teste
canônico do alfa (olhos fechados vs. abertos), conforme o Exp. B de
DataScience/31_Signal_Fidelity_Study_Protocol.

IMPORTANTE (lição da 1ª coleta, 2026-07-18): sem filtragem + notch de 60 Hz +
detrend + potência RELATIVA, a análise dá falso-negativo. O veredito usa alfa
relativa em sinal pré-processado.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal as sp_signal
from scipy import stats

# Bandas (Hz). Alinhar com o Glossário (02) e a estratégia de DSP (30).
BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}

# numpy >= 2.0 renomeou trapz -> trapezoid; fallback preguiçoso p/ numpy < 2.0.
_trapz = getattr(np, "trapezoid", None)
if _trapz is None:  # pragma: no cover - depende da versao do numpy
    _trapz = np.trapz


def psd(x, fs, nperseg=None):
    """Densidade espectral de potência via Welch."""
    x = np.asarray(x, dtype=float)
    if nperseg is None:
        nperseg = int(min(len(x), fs * 2))
    nperseg = max(16, nperseg)
    f, pxx = sp_signal.welch(x, fs=fs, nperseg=nperseg)
    return f, pxx


def _integrate(f, pxx, lo, hi):
    m = (f >= lo) & (f < hi)
    return float(_trapz(pxx[m], f[m])) if np.any(m) else 0.0


def band_power(x, fs, band):
    """Potência absoluta integrada em uma banda (área sob a PSD)."""
    f, pxx = psd(x, fs)
    return _integrate(f, pxx, band[0], band[1])


def band_powers(x, fs, bands=BANDS):
    """Potências absolutas por banda (dict)."""
    f, pxx = psd(x, fs)
    return {name: _integrate(f, pxx, lo, hi) for name, (lo, hi) in bands.items()}


def relative_band_powers(x, fs, bands=BANDS):
    """Potências relativas (fração do total) — robustas a ganho/escala/contato."""
    bp = band_powers(x, fs, bands)
    total = sum(bp.values()) or 1.0
    return {k: v / total for k, v in bp.items()}


def total_power(x, fs):
    """Potência do espectro **inteiro** (0 até Nyquist).

    Existe para dar um denominador honesto a razões como a da rede elétrica.
    Somar as `BANDS` não serve: elas param em 45 Hz, então uma componente em
    60 Hz ficaria **fora** do total e a "fração" poderia passar de 1 — foi
    exatamente o que uma captação real expôs (razão de 153%).
    """
    f, pxx = psd(x, fs)
    return float(_trapz(pxx, f)) if f.size else 0.0


def mains_power(x, fs, f0=60.0, bw=2.0):
    """Potência ao redor da rede elétrica (proxy de contaminação de 60 Hz)."""
    if f0 >= 0.5 * fs:
        return 0.0
    f, pxx = psd(x, fs)
    return _integrate(f, pxx, f0 - bw, f0 + bw)


def preprocess(x, fs, lo=1.0, hi=45.0, notch_freq=60.0, q=30.0, order=4):
    """Detrend + passa-banda (fase zero) + notch na rede elétrica."""
    x = sp_signal.detrend(np.asarray(x, dtype=float))
    nyq = 0.5 * fs
    b, a = sp_signal.butter(order, [lo / nyq, hi / nyq], btype="band")
    x = sp_signal.filtfilt(b, a, x)
    if notch_freq and notch_freq < nyq:
        bn, an = sp_signal.iirnotch(notch_freq / nyq, q)
        x = sp_signal.filtfilt(bn, an, x)
    return x


def _rel_alpha_from_segment(seg, fs, bands):
    # PSD de Welch com janelas de 1 s (média interna) -> estimativa estável por época
    f, pxx = psd(seg, fs, nperseg=int(min(len(seg), fs)))
    powers = {name: _integrate(f, pxx, lo, hi) for name, (lo, hi) in bands.items()}
    tot = sum(powers.values()) or 1.0
    return powers["alpha"] / tot


def epoch_relative_alpha(x, fs, epoch_s=4.0, bands=BANDS):
    """Vetor de alfa RELATIVA por época (4 s, com PSD de Welch médio de 1 s dentro de cada)."""
    x = np.asarray(x, dtype=float)
    n = int(epoch_s * fs)
    if n <= 0 or len(x) < n:
        return np.array([_rel_alpha_from_segment(x, fs, bands)])
    return np.array([_rel_alpha_from_segment(x[s:s + n], fs, bands)
                     for s in range(0, len(x) - n + 1, n)])


@dataclass
class AlphaComparison:
    oc_alpha: float          # alfa RELATIVA média — olhos fechados (fração 0..1)
    oa_alpha: float          # alfa RELATIVA média — olhos abertos
    ratio: float             # oc / oa
    t_stat: float
    p_value: float
    n_oc: int
    n_oa: int
    passed: bool             # OF > OA de forma estatisticamente detectável

    @property
    def verdict(self) -> str:
        if self.oc_alpha <= self.oa_alpha:
            return "NAO passou (direcao invertida)"
        if not np.isnan(self.p_value) and self.p_value < 0.05:
            return "PASSOU (OF > OA, significativo)"
        return "INCONCLUSIVO (direcao OF>OA correta, ainda sem significancia)"


def compare_eyes_closed_open(
    oc, oa, fs,
    epoch_s=4.0,
    preprocess_signal=True,
    notch_freq=60.0,
    alpha_level=0.05,
):
    """
    Exp. B: compara alfa RELATIVA entre olhos fechados (oc) e abertos (oa).
    Por padrão, PRÉ-PROCESSA (detrend + passa-banda + notch 60 Hz) — essencial
    para não ser enganado por 60 Hz/drift/amplitude.
    """
    if preprocess_signal:
        oc = preprocess(oc, fs, notch_freq=notch_freq)
        oa = preprocess(oa, fs, notch_freq=notch_freq)
    oc_ep = epoch_relative_alpha(oc, fs, epoch_s)
    oa_ep = epoch_relative_alpha(oa, fs, epoch_s)
    oc_m, oa_m = float(np.mean(oc_ep)), float(np.mean(oa_ep))
    ratio = oc_m / oa_m if oa_m else float("inf")
    if len(oc_ep) > 1 and len(oa_ep) > 1:
        t, p = stats.ttest_ind(oc_ep, oa_ep, equal_var=False)
        t, p = float(t), float(p)
    else:
        t, p = float("nan"), float("nan")
    passed = bool(oc_m > oa_m and (np.isnan(p) or p < alpha_level))
    return AlphaComparison(oc_m, oa_m, ratio, t, p, len(oc_ep), len(oa_ep), passed)
