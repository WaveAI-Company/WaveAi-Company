"""Baseline pessoal + desvio N σ (ADR-0032) — cold-start, confiança, fonte."""
import numpy as np
import pytest

from wave_eeg.baseline import (
    DEVIATION_SIGMA,
    MIN_OBSERVATIONS,
    SOURCE_COLD_START,
    SOURCE_INSUFICIENTE,
    SOURCE_PERSONAL,
    build_baseline,
    deviation,
    deviations,
    feature_stats,
)


def test_build_baseline_media_desvio_n():
    hist = [{"rel_alpha": 0.30}, {"rel_alpha": 0.40}, {"rel_alpha": 0.50}]
    base = build_baseline(hist)
    assert base["rel_alpha"].n == 3
    assert base["rel_alpha"].mean == pytest.approx(0.40)
    assert base["rel_alpha"].std == pytest.approx(np.std([0.30, 0.40, 0.50]))


def test_feature_stats_ignora_nao_finitos():
    st = feature_stats([1.0, float("nan"), 3.0, None])
    assert st.n == 2
    assert st.mean == 2.0


def test_desvio_pessoal_marca_pico_acima_do_limiar():
    hist = [{"rel_alpha": 0.30 + 0.05 * np.sin(i)} for i in range(MIN_OBSERVATIONS + 10)]
    base = build_baseline(hist)
    st = base["rel_alpha"]
    # Um valor bem além de N σ do baseline pessoal = pico a contextualizar.
    valor = st.mean + (DEVIATION_SIGMA + 1) * st.std
    dev = deviation("rel_alpha", valor, st)
    assert dev.source == SOURCE_PERSONAL
    assert dev.is_peak is True
    assert dev.n_sigma > DEVIATION_SIGMA
    assert dev.confidence == 1.0
    # Um valor perto da média não é pico.
    assert deviation("rel_alpha", st.mean + 0.1 * st.std, st).is_peak is False


def test_cold_start_usa_prior_com_confianca_baixa():
    poucos = build_baseline([{"rel_alpha": 0.3}] * 5)  # n=5 < MIN_OBSERVATIONS
    dev = deviation("rel_alpha", 0.7, poucos["rel_alpha"], prior=(0.3, 0.1))
    assert dev.source == SOURCE_COLD_START
    assert dev.n_sigma == (0.7 - 0.3) / 0.1
    assert dev.is_peak is True
    assert dev.confidence == 5 / MIN_OBSERVATIONS  # menor até volume mínimo


def test_sem_pessoal_e_sem_prior_e_insuficiente():
    dev = deviation("rel_alpha", 0.9, None)
    assert dev.source == SOURCE_INSUFICIENTE
    assert dev.is_peak is False
    assert dev.confidence == 0.0


def test_baseline_constante_cai_no_prior():
    # std pessoal = 0 (histórico constante) → não dá para medir σ; usa o prior.
    const = build_baseline([{"rel_alpha": 0.3}] * (MIN_OBSERVATIONS + 5))
    dev = deviation("rel_alpha", 0.9, const["rel_alpha"], prior=(0.3, 0.1))
    assert dev.source == SOURCE_COLD_START


def test_deviations_mapeia_multiplas_features():
    hist = [{"rel_alpha": 0.3, "rel_beta": 0.1} for _ in range(MIN_OBSERVATIONS + 5)]
    base = build_baseline(hist)
    # rel_alpha e rel_beta constantes → std 0 → precisam de prior; sem prior,
    # insuficiente (não se inventa desvio).
    out = deviations({"rel_alpha": 0.9, "rel_beta": 0.1}, base)
    assert set(out) == {"rel_alpha", "rel_beta"}
    assert out["rel_alpha"].source == SOURCE_INSUFICIENTE
