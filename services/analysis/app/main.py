"""Serviço de análise do WaveAI (FastAPI).

Expõe o `AnalysisEngine` por HTTP. Nesta fase (M0): health check e o demo do
Exp. B sobre dados **sintéticos**. Streaming (#14) e relatório de sessão real
(#15) entram nas issues seguintes.

Posicionamento: resultados **exploratórios, não-clínicos e não-diagnósticos**
(ver `Medical/71_Intended_Use_and_Regulatory_Positioning.md`).
"""

from __future__ import annotations

from fastapi import FastAPI

from . import __version__
from .config import get_settings
from .demo_data import synthetic_session
from .engine import get_engine

settings = get_settings()
engine = get_engine()

app = FastAPI(title=settings.app_name, version=__version__)

DISCLAIMER = (
    "Resultado exploratório de bem-estar. Não-clínico e não-diagnóstico."
)


@app.get("/health")
def health() -> dict[str, str]:
    """Health check do serviço. Não expõe dado sensível."""
    return {"status": "ok"}


@app.post("/analyze/demo")
def analyze_demo() -> dict:
    """Roda o Exp. B (alfa relativa, olhos fechados vs. abertos) em dados sintéticos.

    Não recebe entrada: os dados são gerados internamente e rotulados como
    fictícios (`data_source: "synthetic"`).
    """
    samples, labels, fs = synthetic_session(secs=settings.demo_seconds)
    report = engine.process_session(samples, fs, labels=labels)
    comparison = report.comparison

    return {
        "engine_version": report.engine_version,
        "data_source": "synthetic",
        "fs": report.fs,
        "n_samples": report.n_samples,
        "rel_alpha": {
            "eyes_closed": comparison.eyes_closed_rel_alpha,
            "eyes_open": comparison.eyes_open_rel_alpha,
        },
        "verdict": comparison.verdict,
        "comparison": {
            "ratio": comparison.ratio,
            "t_stat": comparison.t_stat,
            "p_value": comparison.p_value,
            "n_epochs_closed": comparison.n_epochs_closed,
            "n_epochs_open": comparison.n_epochs_open,
            "passed": comparison.passed,
        },
        "relative_band_powers": report.relative_band_powers,
        "quality": {
            "signal_std": report.quality.signal_std,
            "mains_power": report.quality.mains_power,
            "mains_power_ratio": report.quality.mains_power_ratio,
        },
        "disclaimer": DISCLAIMER,
    }
