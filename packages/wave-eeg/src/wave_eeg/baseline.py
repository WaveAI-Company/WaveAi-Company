"""Baseline pessoal + desvio em N σ — "pico → contexto" (ADR-0032).

Define **evento** de forma reproduzível e defensável, sem o rótulo clínico-sonante
que a ADR-0032 abandonou (vocabulário defensável: contraste de estado ou desvio de
baseline pessoal N σ — há guard de CI). Um evento é:
1. um **contraste de estado** medível (ex.: alfa olhos-fechados vs abertos — já
   instanciado por `analysis.compare_eyes_closed_open`, Exp. B); ou
2. um **desvio do baseline pessoal**, em **N desvios-padrão** de uma feature.

Este módulo cobre (2), **stateless**: recebe o histórico de features do próprio
usuário e devolve o baseline + o desvio de um valor novo. **De onde vem o
histórico** (persistência) é outra camada.

**[RÍGIDO — ADR-0032]**
- **Cold-start:** sem histórico suficiente, usa-se um **prior populacional
  provisório** (injetável — este módulo **não inventa norma**; o prior vem de
  treino+literatura quando existir, Q-AI-01) e a **confiança é menor** até um
  volume mínimo de observações do próprio usuário.
- **Transparência:** todo desvio carrega a **fonte** (`personal` vs `cold-start
  (populacional)`) — o usuário/médico vê o que é dele e o que é da população.
- Sem claim clínica; um "pico" é um desvio a **contextualizar**, não um laudo.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

import numpy as np

#: Volume mínimo de observações do usuário para o baseline ser considerado
#: **pessoal** (provisório, ADR-0032; iterado com dados). Abaixo disso é
#: cold-start com prior populacional e confiança reduzida.
MIN_OBSERVATIONS = 20

#: Limiar de desvio (em desvios-padrão) para marcar um "pico" a contextualizar.
#: Provisório e versionado (via `engine_version`); iterado com a Exp. A/dados.
DEVIATION_SIGMA = 3.0

#: Rótulos de fonte do baseline (transparência pessoal vs populacional).
SOURCE_PERSONAL = "personal"
SOURCE_COLD_START = "cold-start (populacional)"
SOURCE_INSUFICIENTE = "insuficiente (sem baseline)"


@dataclass(frozen=True)
class FeatureStats:
    """Estatística de uma feature: média, desvio-padrão e nº de observações."""

    mean: float
    std: float
    n: int


@dataclass(frozen=True)
class Deviation:
    """Desvio de um valor face ao baseline (o "pico → contexto")."""

    feature: str
    value: float
    n_sigma: float        # (valor − média) / desvio; 0 se indefinido
    is_peak: bool         # |n_sigma| >= limiar → pico a contextualizar
    confidence: float     # 0..1, cresce com o volume pessoal
    source: str           # personal | cold-start (populacional) | insuficiente


def feature_stats(values: Sequence[float]) -> FeatureStats:
    """Média/desvio (populacional, ddof=0) de uma feature a partir de valores."""
    arr = np.asarray([v for v in values if v is not None and np.isfinite(v)], dtype=float)
    if arr.size == 0:
        return FeatureStats(mean=float("nan"), std=float("nan"), n=0)
    return FeatureStats(mean=float(arr.mean()), std=float(arr.std()), n=int(arr.size))


def build_baseline(history: Iterable[Mapping[str, float]]) -> dict[str, FeatureStats]:
    """Baseline pessoal por feature a partir do histórico do usuário.

    `history` é uma sequência de dicts feature→valor (ex.: as features do
    Catálogo N2 de cada sessão passada do próprio usuário)."""
    columns: dict[str, list[float]] = {}
    for row in history:
        for name, value in row.items():
            columns.setdefault(name, []).append(value)
    return {name: feature_stats(vals) for name, vals in columns.items()}


def _confidence(n: int, min_obs: int) -> float:
    return float(min(1.0, max(0.0, n / min_obs))) if min_obs > 0 else 1.0


def deviation(
    feature: str,
    value: float,
    personal: FeatureStats | None,
    *,
    prior: tuple[float, float] | None = None,
    sigma: float = DEVIATION_SIGMA,
    min_obs: int = MIN_OBSERVATIONS,
) -> Deviation:
    """Desvio de `value` face ao baseline **pessoal**, caindo no `prior`
    populacional no cold-start.

    - baseline pessoal com `n >= min_obs` **e** desvio > 0 → fonte `personal`,
      confiança cresce com n;
    - senão, se houver `prior` (mean, std) → fonte `cold-start`, confiança baixa;
    - sem nenhum dos dois utilizável → `insuficiente`, sem veredito de pico.
    """
    have_personal = (
        personal is not None
        and personal.n >= min_obs
        and np.isfinite(personal.std)
        and personal.std > 0
    )
    if have_personal:
        mean, std = personal.mean, personal.std  # type: ignore[union-attr]
        source = SOURCE_PERSONAL
        confidence = _confidence(personal.n, min_obs)  # type: ignore[union-attr]
    elif prior is not None and np.isfinite(prior[1]) and prior[1] > 0:
        mean, std = float(prior[0]), float(prior[1])
        source = SOURCE_COLD_START
        # Confiança do cold-start reflete o pouco dado pessoal acumulado.
        n = personal.n if personal is not None else 0
        confidence = _confidence(n, min_obs)
    else:
        return Deviation(feature, float(value), 0.0, False, 0.0, SOURCE_INSUFICIENTE)

    n_sigma = float((value - mean) / std)
    return Deviation(
        feature=feature,
        value=float(value),
        n_sigma=n_sigma,
        is_peak=bool(abs(n_sigma) >= sigma),
        confidence=confidence,
        source=source,
    )


def deviations(
    features: Mapping[str, float],
    baseline: Mapping[str, FeatureStats],
    *,
    prior: Mapping[str, tuple[float, float]] | None = None,
    sigma: float = DEVIATION_SIGMA,
    min_obs: int = MIN_OBSERVATIONS,
) -> dict[str, Deviation]:
    """Desvio de cada feature de `features` face ao `baseline` pessoal.

    `prior` (opcional) mapeia feature→(média, desvio) populacional para o
    cold-start. Retorna um `Deviation` por feature."""
    out: dict[str, Deviation] = {}
    for name, value in features.items():
        out[name] = deviation(
            name, value, baseline.get(name),
            prior=(prior or {}).get(name), sigma=sigma, min_obs=min_obs,
        )
    return out
