"""Testes do contrato `AnalysisEngine` e da implementação `WaveEegEngine`."""

import numpy as np
import pytest

from app.demo_data import synthetic_session
from app.engine import AnalysisEngine, WaveEegEngine, get_engine


@pytest.fixture
def engine() -> WaveEegEngine:
    return WaveEegEngine()


def test_get_engine_respeita_o_contrato():
    assert isinstance(get_engine(), AnalysisEngine)


def test_engine_version_rastreavel(engine):
    # Regra rígida: todo resultado carrega a versão do engine.
    assert "wave_eeg/" in engine.engine_version
    assert "WaveEegEngine/" in engine.engine_version


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


def test_process_window_reporta_qualidade_sem_veredito(engine):
    samples, _, fs = synthetic_session(secs=4.0)
    res = engine.process_window(samples[: int(fs * 4)], fs)

    assert res.quality.signal_std > 0
    assert 0.0 <= res.quality.mains_power_ratio <= 1.0
    # Qualidade é objetiva: nao ha limiar/aprovacao embutidos (Q-TEC-06).
    assert not hasattr(res.quality, "passed")


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
