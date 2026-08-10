"""Tendências longitudinais por feature — relatórios ao longo das sessões (N5).

Agregação **determinística** sobre o histórico de sessões do próprio usuário: por
feature, resume o nível (média/desvio), os extremos (primeiro/último/mín/máx) e a
**tendência** (variação e inclinação por sessão), mais um resumo de qualidade.

**[RÍGIDO — honestidade]** Isto é **estatística descritiva**, não interpretação
clínica: "subiu/desceu" é a **direção numérica** de uma feature, sem significado
diagnóstico (Medical/71). Nenhum modelo/caixa-preta aqui — a substância do
relatório é auditável; a narrativa em linguagem (se houver) é camada separada e
sempre aterrada nestes números. Limiares de direção são **provisórios**,
versionados via `engine_version`.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

import numpy as np

#: Variação **relativa** (|total| / |média|) abaixo da qual a tendência é "flat".
#: Provisória: evita chamar de tendência o que é ruído de sessão a sessão.
TREND_FLAT_REL = 0.05

DIRECTION_UP = "subindo"
DIRECTION_DOWN = "descendo"
DIRECTION_FLAT = "estável"


@dataclass(frozen=True)
class FeatureTrend:
    """Tendência longitudinal de uma feature ao longo das sessões."""

    n: int
    mean: float
    std: float
    first: float
    last: float
    minimum: float
    maximum: float
    delta_abs: float   # último − primeiro
    delta_pct: float   # variação relativa à média (%), 0 se média ~0
    slope: float       # inclinação por sessão (ajuste linear); 0 se n < 2
    direction: str     # subindo | descendo | estável (limiar provisório)


def _direction(slope: float, n: int, mean: float) -> str:
    if n < 2:
        return DIRECTION_FLAT
    total = slope * (n - 1)                       # variação total ao longo da série
    rel = abs(total) / abs(mean) if mean else 0.0
    if rel < TREND_FLAT_REL:
        return DIRECTION_FLAT
    return DIRECTION_UP if slope > 0 else DIRECTION_DOWN


def feature_trend(values: Sequence[float]) -> FeatureTrend | None:
    """Tendência de uma feature a partir de seus valores **em ordem cronológica**.

    Ignora valores não-finitos. Devolve `None` se não sobrar nenhum valor."""
    arr = np.asarray([v for v in values if v is not None and np.isfinite(v)], dtype=float)
    if arr.size == 0:
        return None
    mean = float(arr.mean())
    if arr.size >= 2:
        idx = np.arange(arr.size, dtype=float)
        slope = float(np.polyfit(idx, arr, 1)[0])
    else:
        slope = 0.0
    first, last = float(arr[0]), float(arr[-1])
    delta_abs = last - first
    return FeatureTrend(
        n=int(arr.size),
        mean=mean,
        std=float(arr.std()),
        first=first,
        last=last,
        minimum=float(arr.min()),
        maximum=float(arr.max()),
        delta_abs=float(delta_abs),
        delta_pct=float(100.0 * delta_abs / abs(mean)) if mean else 0.0,
        slope=slope,
        direction=_direction(slope, int(arr.size), mean),
    )


def longitudinal_report(
    sessions: Sequence[Mapping[str, float]],
    *,
    features: Iterable[str] | None = None,
    quality_scores: Sequence[float] | None = None,
) -> dict:
    """Relatório longitudinal a partir das features de sessões **cronológicas**.

    `sessions` é a lista (mais antiga → mais recente) de dicts feature→valor de
    cada sessão passada do titular. `features` restringe as features avaliadas
    (padrão: a união das presentes). `quality_scores` (opcional, paralelo a
    `sessions`) resume a qualidade ao longo do tempo — contexto de confiança.
    """
    names: list[str]
    if features is not None:
        names = list(features)
    else:
        seen: dict[str, None] = {}
        for row in sessions:
            for name in row:
                seen.setdefault(name, None)
        names = list(seen)

    trends: dict[str, dict] = {}
    for name in names:
        values = [row[name] for row in sessions if name in row and row[name] is not None]
        trend = feature_trend(values)
        if trend is not None:
            trends[name] = {
                "n": trend.n, "mean": trend.mean, "std": trend.std,
                "first": trend.first, "last": trend.last,
                "minimum": trend.minimum, "maximum": trend.maximum,
                "delta_abs": trend.delta_abs, "delta_pct": trend.delta_pct,
                "slope": trend.slope, "direction": trend.direction,
            }

    report: dict = {"n_sessions": len(sessions), "features": trends}

    if quality_scores is not None:
        finite = [float(q) for q in quality_scores if q is not None and np.isfinite(q)]
        if finite:
            report["quality"] = {
                "n": len(finite),
                "mean": float(np.mean(finite)),
                "min": float(np.min(finite)),
                "last": float(finite[-1]),
            }

    return report
