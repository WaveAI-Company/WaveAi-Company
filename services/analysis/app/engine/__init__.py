"""Análise plugável: contrato + implementação atual."""

from .base import (
    AlphaComparison,
    AnalysisEngine,
    QualityMetrics,
    SessionReport,
    WindowResult,
)
from .wave_eeg_engine import WaveEegEngine

__all__ = [
    "AnalysisEngine",
    "WindowResult",
    "SessionReport",
    "AlphaComparison",
    "QualityMetrics",
    "WaveEegEngine",
]


def get_engine() -> AnalysisEngine:
    """Engine ativo do serviço. Ponto único de troca de implementação."""
    return WaveEegEngine()
