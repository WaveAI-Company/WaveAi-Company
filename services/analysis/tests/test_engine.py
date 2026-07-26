"""Testes do contrato `AnalysisEngine` e da implementação `WaveEegEngine`."""

import numpy as np
import pytest
from wave_eeg import FEATURE_CATALOG

from app.demo_data import synthetic_session
from app.engine import AnalysisEngine, WaveEegEngine, get_engine

#: Nomes esperados no resultado — a fonte de verdade é o Catálogo N2.
CATALOG_NAMES = {spec.name for spec in FEATURE_CATALOG}


@pytest.fixture
def engine() -> WaveEegEngine:
    return WaveEegEngine()


def test_get_engine_respeita_o_contrato():
    assert isinstance(get_engine(), AnalysisEngine)


def test_engine_version_rastreavel(engine):
    # Regra rígida: todo resultado carrega a versão do engine.
    assert "wave_eeg/" in engine.engine_version
    assert "WaveEegEngine/" in engine.engine_version


def test_engine_version_bump(engine):
    # N3-c.2: o wrapper subiu para 0.4.0 ao trazer desvios de baseline (ADR-0032).
    assert "WaveEegEngine/0.4.0" in engine.engine_version


def test_feature_catalog_expoe_specs_com_reliability(engine):
    catalogo = engine.feature_catalog
    assert {spec["name"] for spec in catalogo} == CATALOG_NAMES
    # A honestidade científica vive na reliability (defensável/cautela).
    reliabilities = {spec["reliability"] for spec in catalogo}
    assert reliabilities <= {"defensável", "cautela"}
    # rms e total_power são sensíveis a escala/contato — devem ser "cautela".
    por_nome = {spec["name"]: spec for spec in catalogo}
    assert por_nome["rms"]["reliability"] == "cautela"
    assert por_nome["total_power"]["reliability"] == "cautela"


def test_esense_catalog_e_separado_e_rotulado(engine):
    """ADR-0034: eSense exposto à parte do Catálogo N2, sempre rotulado."""
    esense = engine.esense_catalog
    assert {spec["name"] for spec in esense} == {"attention", "meditation"}
    # Nunca se mistura às features transparentes.
    n2 = {spec["name"] for spec in engine.feature_catalog}
    assert n2.isdisjoint({"attention", "meditation"})
    # Rótulo proprietário/não-validado em cada métrica.
    for spec in esense:
        assert "propriet" in spec["reliability"].lower()


def test_process_window_extrai_features(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    res = engine.process_window(samples[: int(fs * 4)], fs)

    assert res.engine_version == engine.engine_version
    assert res.n_samples == int(fs * 4)
    assert set(res.relative_band_powers) == {"delta", "theta", "alpha", "beta", "gamma"}
    # Potências relativas somam ~1 e alfa é uma fração válida.
    assert sum(res.relative_band_powers.values()) == pytest.approx(1.0, abs=1e-6)
    assert 0.0 <= res.rel_alpha <= 1.0
    assert res.rel_alpha == res.relative_band_powers["alpha"]


def test_process_window_expoe_o_catalogo_completo(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    res = engine.process_window(samples[: int(fs * 4)], fs)

    # Todas as features do Catálogo N2 estão presentes.
    assert set(res.features) == CATALOG_NAMES
    # Retrocompat: os campos legados são derivados da MESMA fonte (o catálogo).
    assert res.rel_alpha == res.features["rel_alpha"]
    for banda in ("delta", "theta", "alpha", "beta", "gamma"):
        assert res.relative_band_powers[banda] == res.features[f"rel_{banda}"]


def test_process_session_expoe_o_catalogo_completo(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    report = engine.process_session(samples, fs)
    assert set(report.features) == CATALOG_NAMES
    assert report.rel_alpha == report.features["rel_alpha"]


def test_process_carimba_proveniencia_do_device(engine):
    """ADR-0033: device conhecido → montagem resolvida no resultado."""
    samples, _, fs = synthetic_session(secs=4.0)
    janela = samples[: int(fs * 4)]

    win = engine.process_window(janela, fs, device="mindwave-mobile-2")
    assert win.device == "mindwave-mobile-2"
    assert win.montage == ("FP1",)

    rep = engine.process_session(samples, fs, device="mindwave-mobile-2")
    assert rep.device == "mindwave-mobile-2"
    assert rep.montage == ("FP1",)


def test_process_session_sem_historico_nao_tem_desvios(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    report = engine.process_session(samples, fs)
    # Sem histórico do titular, não se inventa desvio (ADR-0032).
    assert report.deviations == {}


def test_process_session_com_historico_calcula_desvio_pessoal(engine):
    from wave_eeg.baseline import MIN_OBSERVATIONS

    samples, _, fs = synthetic_session(secs=4.0)
    atual = engine.process_session(samples, fs)
    base_alpha = atual.features["rel_alpha"]
    # Histórico do titular (>= volume mínimo) concentrado longe do valor atual,
    # com pequena dispersão → o rel_alpha atual vira um pico.
    history = [
        {"rel_alpha": base_alpha + 0.20 + 0.001 * ((i % 3) - 1)}
        for i in range(MIN_OBSERVATIONS + 5)
    ]
    report = engine.process_session(samples, fs, history=history)

    dev = report.deviations["rel_alpha"]
    assert dev["source"] == "personal"
    assert dev["confidence"] == 1.0
    assert dev["is_peak"] is True
    assert abs(dev["n_sigma"]) > 3.0


def test_process_sem_device_fica_unknown(engine):
    """Sem device declarado, a proveniência é 'unknown' — não inventada."""
    samples, _, fs = synthetic_session(secs=4.0)
    win = engine.process_window(samples[: int(fs * 4)], fs)
    assert win.device == "unknown"
    # Um canal, posição não declarada (rótulo genérico).
    assert win.montage == ("CH1",)


def test_process_window_reporta_qualidade_com_score(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    res = engine.process_window(samples[: int(fs * 4)], fs)

    # Métricas cruas seguem cruas (honestidade visual, ADR-0027).
    assert res.quality.signal_std > 0
    assert 0.0 <= res.quality.mains_power_ratio <= 1.0
    # ADR-0031: score 0..1 + rejeição grossa. Sinal sintético limpo = bom score.
    assert 0.0 <= res.quality.score <= 1.0
    assert res.quality.score > 0.8
    assert res.quality.rejected is False
    assert res.quality.reason == ""


def test_qualidade_com_rede_dominante_continua_sendo_fracao(engine):
    """Regressão de captação REAL (#17): razão da rede passava de 100%.

    Numa sessão real com eletrodo seco, os 60 Hz superaram a soma das bandas
    (que param em 45 Hz) e `mains_power_ratio` deu **153%** — impossível para
    algo declarado como fração. O denominador passou a ser o espectro inteiro.

    O sinal aqui é dominado pela rede de propósito: é o cenário que o
    simulador nunca produz e que quebrava a invariante.
    """
    fs = 512.0
    t = np.arange(int(fs * 8)) / fs
    rede = 400 * np.sin(2 * np.pi * 60 * t)
    cerebro = 10 * np.sin(2 * np.pi * 10 * t)
    samples = (cerebro + rede).tolist()

    res = engine.process_window(samples, fs)

    assert 0.0 <= res.quality.mains_power_ratio <= 1.0
    # E deve acusar contaminação alta — a métrica ainda precisa ser informativa.
    assert res.quality.mains_power_ratio > 0.5
    # ADR-0031: rede pesada derruba o score. Se for praticamente todo o
    # espectro (sinal afogado), a rejeição grossa dispara.
    assert res.quality.score < 0.3
    if res.quality.mains_power_ratio >= 0.98:
        assert res.quality.rejected is True
        assert "rede" in res.quality.reason.lower()


def test_process_session_sem_labels_nao_compara(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    report = engine.process_session(samples, fs)
    assert report.comparison is None


def test_process_session_detecta_alfa_maior_de_olhos_fechados(engine):
    samples, labels, fs = synthetic_session(secs=30.0)
    report = engine.process_session(samples, fs, labels=labels)

    comp = report.comparison
    assert comp is not None
    # Exp. B em dados sinteticos: alfa relativa maior de olhos fechados.
    assert comp.eyes_closed_rel_alpha > comp.eyes_open_rel_alpha
    assert comp.ratio > 1.0
    assert comp.passed is True
    assert "PASSOU" in comp.verdict


def test_process_session_rejeita_labels_de_tamanho_errado(engine):
    samples, labels, fs = synthetic_session(secs=4.0)
    with pytest.raises(ValueError):
        engine.process_session(samples, fs, labels=labels[:10])


def test_process_session_aceita_rotulos_alternativos(engine):
    samples, _, fs = synthetic_session(secs=10.0)
    metade = len(samples) // 2
    labels = ["FECHADOS"] * metade + ["ABERTOS"] * (len(samples) - metade)
    report = engine.process_session(samples, fs, labels=labels)
    assert report.comparison is not None
