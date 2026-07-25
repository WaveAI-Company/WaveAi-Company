"""Catálogo de features do WaveAI (N2 — DataScience/32).

Features **transparentes e interpretáveis** extraídas do sinal pré-processado
(detrend + passa-banda 1–45 + notch 60). Nada de caixa-preta (eSense fica de
fora — [DataScience/30](../../DataScience/30_EEG_Signal_Processing_Strategy.md) §2).

Cada feature tem um `FeatureSpec` (nome, unidade, faixa, interpretação,
confiabilidade, dependência de montagem). **Confiabilidade** reflete o que o
estudo de fidelidade sustenta:
- **defensável:** invariante a escala/ganho (potências **relativas**, forma do
  espectro, frequências);
- **cautela:** sensível a contato/escala (potências **absolutas**, RMS) — usar
  como qualidade/contexto, não como medida fisiológica direta.

**[RÍGIDO — ADR-0032]** Este módulo **só extrai features**. Definições de evento
(contraste de estado, desvio de baseline pessoal N σ) vêm **depois**, sobre este
catálogo — não aqui. O termo "anomalia" não é usado.

Nota de estado: features de **alfa** são fortemente sensíveis ao **estado**
(vigilância/emoção) — ver o achado Dia 1 vs Dia 2 em DataScience/33. É sinal
real, mas exige controle de estado para comparações limpas.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import numpy as np

from .analysis import (
    BANDS,
    band_powers,
    preprocess,
    psd,
    relative_band_powers,
    total_power,
)

#: Teto da banda de análise (Hz). Acima disso é rede/ruído — fora das features.
FMAX = 45.0


@dataclass(frozen=True)
class FeatureSpec:
    """Metadados de uma feature do catálogo (dirige DataScience/32 e os testes)."""

    name: str
    unit: str
    range: str
    interpretation: str
    reliability: str  # "defensável" | "cautela"
    montage_note: str


def _band_psd(x, fs, fmax=FMAX):
    """PSD limitada à banda de análise (exclui a rede em 60 Hz)."""
    f, pxx = psd(x, fs)
    m = (f > 0) & (f <= fmax)
    return f[m], pxx[m]


def spectral_edge_frequency(x, fs, edge: float = 0.95, fmax: float = FMAX) -> float:
    """Frequência abaixo da qual está `edge` (ex.: 95%) da potência (0..fmax Hz)."""
    f, pxx = _band_psd(x, fs, fmax)
    if f.size == 0:
        return float("nan")
    cumulative = np.cumsum(pxx)
    if cumulative[-1] <= 0:
        return float("nan")
    cumulative = cumulative / cumulative[-1]
    idx = int(np.searchsorted(cumulative, edge))
    return float(f[min(idx, f.size - 1)])


def median_frequency(x, fs, fmax: float = FMAX) -> float:
    """Frequência mediana do espectro (SEF 50%)."""
    return spectral_edge_frequency(x, fs, edge=0.5, fmax=fmax)


def spectral_entropy(x, fs, fmax: float = FMAX) -> float:
    """Entropia espectral **normalizada** (0..1): 0=espectro concentrado, 1=plano."""
    f, pxx = _band_psd(x, fs, fmax)
    total = pxx.sum()
    if f.size < 2 or total <= 0:
        return float("nan")
    p = pxx / total
    p = p[p > 0]
    h = -np.sum(p * np.log2(p))
    return float(h / np.log2(p.size)) if p.size > 1 else 0.0


def peak_alpha_frequency(x, fs, band=(8.0, 13.0)) -> float:
    """Frequência de pico dentro da banda alfa (Hz)."""
    f, pxx = psd(x, fs)
    m = (f >= band[0]) & (f < band[1])
    if not np.any(m):
        return float("nan")
    fa, pa = f[m], pxx[m]
    return float(fa[int(np.argmax(pa))])


def band_ratio(x, fs, num: str, den: str, bands=BANDS) -> float:
    """Razão de potências absolutas entre duas bandas (adimensional)."""
    bp = band_powers(x, fs, bands)
    d = bp[den]
    return float(bp[num] / d) if d else float("inf")


def rms(x) -> float:
    """Amplitude RMS do sinal (sensível a escala/contato)."""
    x = np.asarray(x, dtype=float)
    return float(np.sqrt(np.mean(x * x))) if x.size else float("nan")


#: Catálogo formal. A ordem/os nomes espelham as chaves de `compute_features`.
FEATURE_CATALOG = (
    FeatureSpec("rel_delta", "fração 0..1", "0..1",
                "Proporção de potência em delta (0,5–4 Hz).", "defensável",
                "FP1: baixas freq. sofrem drift/EOG — interpretar com cautela."),
    FeatureSpec("rel_theta", "fração 0..1", "0..1",
                "Proporção em teta (4–8 Hz).", "defensável", "device-agnóstico"),
    FeatureSpec("rel_alpha", "fração 0..1", "0..1",
                "Proporção em alfa (8–13 Hz); sobe em repouso/olhos fechados (Berger).",
                "defensável", "sensível ao ESTADO (ver DataScience/33)."),
    FeatureSpec("rel_beta", "fração 0..1", "0..1",
                "Proporção em beta (13–30 Hz); sobe com engajamento/EMG.", "defensável",
                "FP1: contaminação por EMG frontal."),
    FeatureSpec("rel_gamma", "fração 0..1", "0..1",
                "Proporção em gama (30–45 Hz); em canal seco, muito EMG.", "cautela",
                "FP1: dominada por EMG; não fisiológica direta."),
    FeatureSpec("ratio_theta_beta", "adimensional", ">0",
                "Teta/Beta; usada em literatura de atenção (exploratória).", "defensável",
                "device-agnóstico"),
    FeatureSpec("ratio_alpha_beta", "adimensional", ">0",
                "Alfa/Beta; proxy de relaxamento vs engajamento.", "defensável",
                "sensível ao estado"),
    FeatureSpec("spectral_edge_95", "Hz", "0..45",
                "Freq. abaixo da qual há 95% da potência; proxy de conteúdo alto.",
                "defensável", "invariante a escala"),
    FeatureSpec("median_frequency", "Hz", "0..45",
                "Freq. mediana do espectro.", "defensável", "invariante a escala"),
    FeatureSpec("spectral_entropy", "adimensional", "0..1",
                "Achatamento do espectro; 0=tonal, 1=plano/ruidoso.", "defensável",
                "invariante a escala"),
    FeatureSpec("peak_alpha_frequency", "Hz", "8..13",
                "Freq. de pico na banda alfa.", "defensável",
                "válida só quando há pico alfa real."),
    FeatureSpec("rms", "amplitude", ">=0",
                "Amplitude RMS; proxy de energia/contato.", "cautela",
                "sensível a escala/contato — usar como qualidade."),
    FeatureSpec("total_power", "potência", ">=0",
                "Potência integrada do espectro.", "cautela",
                "sensível a escala/contato."),
)


def compute_features(x, fs, bands=BANDS, preprocess_signal: bool = True) -> Dict[str, float]:
    """Extrai **todas** as features do catálogo de uma janela/segmento.

    Por padrão pré-processa (detrend + passa-banda + notch) — as features assumem
    sinal na banda de análise. As chaves batem com `FEATURE_CATALOG`.
    """
    x = np.asarray(x, dtype=float)
    if preprocess_signal:
        x = preprocess(x, fs)

    rel = relative_band_powers(x, fs, bands)
    feats: Dict[str, float] = {f"rel_{name}": rel[name] for name in bands}
    feats["ratio_theta_beta"] = band_ratio(x, fs, "theta", "beta", bands)
    feats["ratio_alpha_beta"] = band_ratio(x, fs, "alpha", "beta", bands)
    feats["spectral_edge_95"] = spectral_edge_frequency(x, fs, 0.95)
    feats["median_frequency"] = median_frequency(x, fs)
    feats["spectral_entropy"] = spectral_entropy(x, fs)
    feats["peak_alpha_frequency"] = peak_alpha_frequency(x, fs)
    feats["rms"] = rms(x)
    feats["total_power"] = total_power(x, fs)
    return feats
