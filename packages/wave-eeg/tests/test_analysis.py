"""Testes da análise de sinal — validam o Exp. B com sinais sintéticos de alfa conhecido."""
import numpy as np

from wave_eeg.analysis import (
    band_powers,
    compare_eyes_closed_open,
    mains_power,
    total_power,
)


def _sig(fs, secs, freq, amp, noise=5.0, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(fs * secs)) / fs
    return amp * np.sin(2 * np.pi * freq * t) + rng.normal(0, noise, t.size)


def test_potencia_pico_na_banda_alfa():
    fs = 512
    x = _sig(fs, 10, freq=10.0, amp=30.0)  # 10 Hz -> banda alfa
    bp = band_powers(x, fs)
    assert bp["alpha"] == max(bp.values())


def test_total_power_engloba_as_bandas_e_a_rede():
    """O total do espectro precisa conter o que as BANDS (0,5–45 Hz) deixam de fora.

    Sem isso, `mains_power / total` não é fração: numa captação real com 60 Hz
    forte, a razão chegou a 153%.
    """
    fs = 512
    t = np.arange(fs * 8) / fs
    x = 10 * np.sin(2 * np.pi * 10 * t) + 400 * np.sin(2 * np.pi * 60 * t)

    total = total_power(x, fs)
    soma_bandas = sum(band_powers(x, fs).values())

    # A rede vive fora das bandas, então o total é estritamente maior.
    assert total > soma_bandas
    assert 0.0 <= mains_power(x, fs) / total <= 1.0


def test_alfa_maior_de_olhos_fechados():
    fs = 512
    oc = _sig(fs, 24, freq=10.0, amp=30.0, seed=1)  # alfa forte
    oa = _sig(fs, 24, freq=10.0, amp=8.0, seed=2)   # alfa fraco
    res = compare_eyes_closed_open(oc, oa, fs)
    assert res.oc_alpha > res.oa_alpha
    assert res.ratio > 1.0
    assert res.passed


def test_sem_diferenca_nao_passa():
    fs = 512
    a = _sig(fs, 24, freq=10.0, amp=10.0, seed=3)
    b = _sig(fs, 24, freq=10.0, amp=10.0, seed=4)  # mesma amplitude -> sem diferença real
    res = compare_eyes_closed_open(a, b, fs)
    assert not res.passed


def test_pipeline_robusto_a_60hz_e_drift():
    """Mesmo com 60 Hz forte e drift, alfa relativa deve detectar OF>OA (lição da 1ª coleta)."""
    fs = 512
    t = np.arange(fs * 12) / fs
    rng = np.random.default_rng(7)
    mains = 300 * np.sin(2 * np.pi * 60 * t)
    drift = 50 * np.sin(2 * np.pi * 0.3 * t)
    oc = 25 * np.sin(2 * np.pi * 10 * t) + mains + drift + rng.normal(0, 8, t.size)
    oa = 8 * np.sin(2 * np.pi * 10 * t) + 1.4 * mains + drift + rng.normal(0, 8, t.size)
    res = compare_eyes_closed_open(oc, oa, fs)  # preprocess default (notch+bandpass)
    assert res.oc_alpha > res.oa_alpha   # direção correta apesar do 60 Hz/drift
    assert res.ratio > 1.0
