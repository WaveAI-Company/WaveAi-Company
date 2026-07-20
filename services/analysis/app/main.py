"""Serviço de análise do WaveAI (FastAPI).

Expõe o `AnalysisEngine` por HTTP. Nesta fase (M0): health check e o demo do
Exp. B sobre dados **sintéticos**. Streaming (#14) e relatório de sessão real
(#15) entram nas issues seguintes.

Posicionamento: resultados **exploratórios, não-clínicos e não-diagnósticos**
(ver `Medical/71_Intended_Use_and_Regulatory_Positioning.md`).
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

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


class WindowRequest(BaseModel):
    """Uma janela de sinal bruto para análise ao vivo (#14)."""

    #: Amostras da janela. O teto evita que uma requisição sozinha consuma
    #: CPU/memória demais — o gateway já limita o bloco, isto é a segunda rede.
    samples: list[float] = Field(min_length=16, max_length=32_768)
    fs: float = Field(gt=0, le=20_000)


class SessionRequest(BaseModel):
    """Sessão inteira para o relatório em batch (#15)."""

    samples: list[float] = Field(min_length=16, max_length=8_000_000)
    fs: float = Field(gt=0, le=20_000)
    #: Rótulos paralelos a `samples` (ex.: OC/OA). Habilita a comparação do
    #: Exp. B quando presentes; ausentes, o relatório traz só bandas/qualidade.
    labels: list[str] | None = None


@app.get("/health")
def health() -> dict[str, str]:
    """Health check do serviço. Não expõe dado sensível."""
    return {"status": "ok"}


@app.post("/analyze/window")
def analyze_window(payload: WindowRequest) -> dict:
    """Analisa uma janela e devolve as features ao vivo.

    Toda a decisão de DSP (filtragem, PSD, épocas) vive no `AnalysisEngine` —
    aqui só se adapta a entrada e se serializa a saída. Quem chama não escolhe
    parâmetro de análise, apenas envia o sinal.
    """
    resultado = engine.process_window(payload.samples, payload.fs)
    return {
        "engine_version": resultado.engine_version,
        "fs": resultado.fs,
        "n_samples": resultado.n_samples,
        "rel_alpha": resultado.rel_alpha,
        "relative_band_powers": resultado.relative_band_powers,
        "quality": {
            "signal_std": resultado.quality.signal_std,
            "mains_power": resultado.quality.mains_power,
            "mains_power_ratio": resultado.quality.mains_power_ratio,
        },
        "disclaimer": DISCLAIMER,
    }


@app.post("/analyze/session")
def analyze_session(payload: SessionRequest) -> dict:
    """Gera o relatório de uma sessão inteira (batch, ADR-0017).

    Todo o DSP vive no `AnalysisEngine.process_session`; aqui só se adapta a
    entrada e se serializa a saída para persistência (#15).
    """
    if payload.labels is not None and len(payload.labels) != len(payload.samples):
        raise HTTPException(status_code=422, detail="labels e samples com tamanhos diferentes")

    report = engine.process_session(payload.samples, payload.fs, labels=payload.labels)
    comparison = report.comparison

    corpo: dict = {
        "engine_version": report.engine_version,
        "fs": report.fs,
        "n_samples": report.n_samples,
        "rel_alpha": report.rel_alpha,
        "relative_band_powers": report.relative_band_powers,
        "band_powers": report.band_powers,
        "quality": {
            "signal_std": report.quality.signal_std,
            "mains_power": report.quality.mains_power,
            "mains_power_ratio": report.quality.mains_power_ratio,
        },
        "disclaimer": DISCLAIMER,
    }
    if comparison is not None:
        corpo["comparison"] = {
            "eyes_closed_rel_alpha": comparison.eyes_closed_rel_alpha,
            "eyes_open_rel_alpha": comparison.eyes_open_rel_alpha,
            "ratio": comparison.ratio,
            "p_value": comparison.p_value,
            "verdict": comparison.verdict,
            "passed": comparison.passed,
        }
    return corpo


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
