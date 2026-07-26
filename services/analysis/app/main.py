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


def _quality_dict(q) -> dict:
    """Serializa a qualidade: métricas cruas + veredito (score/rejeição, ADR-0031)."""
    return {
        "signal_std": q.signal_std,
        "mains_power": q.mains_power,
        "mains_power_ratio": q.mains_power_ratio,
        "score": q.score,
        "rejected": q.rejected,
        "reason": q.reason,
        "artifact_ratio": q.artifact_ratio,
    }


class WindowRequest(BaseModel):
    """Uma janela de sinal bruto para análise ao vivo (#14)."""

    #: Amostras da janela. O teto evita que uma requisição sozinha consuma
    #: CPU/memória demais — o gateway já limita o bloco, isto é a segunda rede.
    samples: list[float] = Field(min_length=16, max_length=32_768)
    fs: float = Field(gt=0, le=20_000)
    #: Aparelho de origem (ADR-0033): carimba proveniência (device + montagem)
    #: no resultado. Opcional — ausente vira "unknown".
    device: str | None = Field(default=None, max_length=64)


class SessionRequest(BaseModel):
    """Sessão inteira para o relatório em batch (#15)."""

    samples: list[float] = Field(min_length=16, max_length=8_000_000)
    fs: float = Field(gt=0, le=20_000)
    #: Rótulos paralelos a `samples` (ex.: OC/OA). Habilita a comparação do
    #: Exp. B quando presentes; ausentes, o relatório traz só bandas/qualidade.
    labels: list[str] | None = None
    #: Aparelho de origem (ADR-0033); ver `WindowRequest.device`.
    device: str | None = Field(default=None, max_length=64)
    #: Features das sessões passadas do próprio titular (ADR-0032): habilita os
    #: desvios do baseline pessoal. O gateway monta a partir dos `Result` já
    #: persistidos; a Analysis não guarda estado.
    history: list[dict[str, float]] | None = Field(default=None, max_length=100_000)
    #: Prior populacional para o cold-start (feature → [média, desvio]). Opcional
    #: — ausente, o cold-start fica "insuficiente" até haver baseline pessoal.
    population_prior: dict[str, list[float]] | None = None


class LongitudinalRequest(BaseModel):
    """Série cronológica de features das sessões do titular para o relatório N5."""

    #: Features por sessão, da mais antiga à mais recente. O gateway monta a
    #: partir dos `Result` já persistidos; a Analysis não guarda estado.
    sessions: list[dict[str, float]] = Field(min_length=1, max_length=100_000)
    #: Score de qualidade paralelo às sessões (opcional) — contexto de confiança.
    quality_scores: list[float] | None = None


@app.get("/health")
def health() -> dict[str, str]:
    """Health check do serviço. Não expõe dado sensível."""
    return {"status": "ok"}


@app.get("/features/catalog")
def features_catalog() -> dict:
    """Catálogo de Features N2 (DataScience/32): metadados **estáticos** de cada
    feature (unidade, faixa, interpretação, `reliability`, montagem).

    Servido à parte dos resultados por ser metadado de catálogo (não muda por
    sessão). A `reliability` sustenta a honestidade científica na UI/relatórios.
    """
    return {
        "engine_version": engine.engine_version,
        "features": list(engine.feature_catalog),
        #: eSense à parte e rotulado (ADR-0034): proprietário/não-validado, nunca
        #: confundido com as features transparentes acima.
        "esense": list(engine.esense_catalog),
        "disclaimer": DISCLAIMER,
    }


@app.post("/analyze/window")
def analyze_window(payload: WindowRequest) -> dict:
    """Analisa uma janela e devolve as features ao vivo.

    Toda a decisão de DSP (filtragem, PSD, épocas) vive no `AnalysisEngine` —
    aqui só se adapta a entrada e se serializa a saída. Quem chama não escolhe
    parâmetro de análise, apenas envia o sinal.
    """
    resultado = engine.process_window(payload.samples, payload.fs, device=payload.device)
    return {
        "engine_version": resultado.engine_version,
        "device": resultado.device,
        "montage": list(resultado.montage),
        "fs": resultado.fs,
        "n_samples": resultado.n_samples,
        "rel_alpha": resultado.rel_alpha,
        "relative_band_powers": resultado.relative_band_powers,
        "features": resultado.features,
        "quality": _quality_dict(resultado.quality),
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

    report = engine.process_session(
        payload.samples, payload.fs, labels=payload.labels, device=payload.device,
        history=payload.history, population_prior=payload.population_prior,
    )
    comparison = report.comparison

    corpo: dict = {
        "engine_version": report.engine_version,
        "device": report.device,
        "montage": list(report.montage),
        "deviations": report.deviations,
        "fs": report.fs,
        "n_samples": report.n_samples,
        "rel_alpha": report.rel_alpha,
        "relative_band_powers": report.relative_band_powers,
        "band_powers": report.band_powers,
        "features": report.features,
        "quality": _quality_dict(report.quality),
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


@app.post("/report/longitudinal")
def report_longitudinal(payload: LongitudinalRequest) -> dict:
    """Relatório longitudinal (N5): tendências por feature ao longo das sessões.

    Estatística **descritiva** (níveis, extremos, direção) — sem interpretação
    clínica (Medical/71). Toda a matemática vive no `AnalysisEngine`/`wave_eeg`;
    aqui só se adapta a entrada e se serializa a saída.
    """
    report = engine.longitudinal_report(payload.sessions, quality_scores=payload.quality_scores)
    return {
        "engine_version": engine.engine_version,
        "report": report,
        "disclaimer": DISCLAIMER,
    }


@app.post("/analyze/demo")
def analyze_demo() -> dict:
    """Roda o Exp. B (alfa relativa, olhos fechados vs. abertos) em dados sintéticos.

    Não recebe entrada: os dados são gerados internamente e rotulados como
    fictícios (`data_source: "synthetic"`).
    """
    samples, labels, fs = synthetic_session(secs=settings.demo_seconds)
    report = engine.process_session(samples, fs, labels=labels, device="simulador")
    comparison = report.comparison

    return {
        "engine_version": report.engine_version,
        "data_source": "synthetic",
        "device": report.device,
        "montage": list(report.montage),
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
        "features": report.features,
        "quality": _quality_dict(report.quality),
        "disclaimer": DISCLAIMER,
    }
