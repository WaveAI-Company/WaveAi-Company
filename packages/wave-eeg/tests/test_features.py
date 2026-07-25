"""Catálogo de features (N2) — valores conhecidos em sinais sintéticos."""
import numpy as np
import pytest

from wave_eeg.features import (
    FEATURE_CATALOG,
    compute_features,
    rms,
    spectral_entropy,
)


def _sine(fs, secs, freq, amp=1.0):
    t = np.arange(int(fs * secs)) / fs
    return amp * np.sin(2 * np.pi * freq * t)


def test_catalogo_bate_com_compute_features():
    """Contrato: as chaves de compute_features == os nomes do catálogo."""
    keys = set(compute_features(_sine(256, 4, 10.0), 256).keys())
    names = {spec.name for spec in FEATURE_CATALOG}
    assert keys == names


def test_seno_10hz_domina_alfa_e_pico():
    fs = 256
    f = compute_features(_sine(fs, 8, 10.0), fs)
    rel = {k: v for k, v in f.items() if k.startswith("rel_")}
    assert max(rel, key=rel.get) == "rel_alpha"
    assert abs(f["peak_alpha_frequency"] - 10.0) < 1.5
    assert abs(f["median_frequency"] - 10.0) < 2.0
    assert f["spectral_entropy"] < 0.6            # espectro concentrado
    assert abs(sum(rel.values()) - 1.0) < 1e-6    # relativas somam 1


def test_ruido_branco_tem_entropia_alta():
    fs = 256
    x = np.random.default_rng(0).normal(0, 1, fs * 8)
    f = compute_features(x, fs)
    assert f["spectral_entropy"] > 0.7            # espectro achatado
    assert 12.0 < f["median_frequency"] < 38.0    # mediana no miolo da banda


def test_relativas_somam_1_e_nao_negativas():
    fs = 256
    x = _sine(fs, 8, 10.0, amp=20.0) + _sine(fs, 8, 20.0, amp=8.0)
    f = compute_features(x, fs)
    rel = [v for k, v in f.items() if k.startswith("rel_")]
    assert abs(sum(rel) - 1.0) < 1e-6
    assert all(v >= 0 for v in rel)
    assert f["total_power"] >= 0 and f["rms"] >= 0


def test_rms_escala_linear():
    a = _sine(256, 4, 10.0, amp=1.0)
    assert rms(2 * a) == pytest.approx(2 * rms(a))


def test_sinal_nulo_nao_quebra():
    fs = 256
    # sinal nulo (sem pré-processar) exercita os guards de divisão por zero.
    f = compute_features(np.zeros(fs * 4), fs, preprocess_signal=False)
    assert f["rel_alpha"] == 0.0                # sem potência em banda nenhuma
    assert f["rms"] == 0.0
    assert np.isnan(f["spectral_entropy"])      # definido como NaN, sem crash
    assert f["total_power"] == 0.0


def test_entropia_normalizada_entre_0_e_1():
    fs = 256
    for x in (_sine(fs, 4, 10.0), np.random.default_rng(1).normal(0, 1, fs * 4)):
        h = spectral_entropy(x, fs)
        assert 0.0 <= h <= 1.0
