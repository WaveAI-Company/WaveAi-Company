"""Score de qualidade 0..1 + rejeição grossa (ADR-0031)."""
import numpy as np
from wave_eeg.quality import (
    REJECT_ARTIFACT_FRACTION,
    amplitude_artifact_ratio,
    assess_quality,
)


def _clean(fs=256, secs=8.0, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(fs * secs)) / fs
    return 10 * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 8, t.size)


def test_sinal_limpo_tem_score_alto_e_nao_rejeita():
    x = _clean()
    q = assess_quality(x, 256, mains_power_ratio=0.05, signal_std=float(np.std(x)))
    assert q.score > 0.8
    assert q.rejected is False
    assert q.reason == ""
    assert q.artifact_ratio < 0.2


def test_sinal_chapado_e_rejeitado_com_score_zero():
    x = np.zeros(2048)
    q = assess_quality(x, 256, mains_power_ratio=0.0, signal_std=0.0)
    assert q.score == 0.0
    assert q.rejected is True
    assert "chapado" in q.reason


def test_rede_quase_total_rejeita_mas_0_88_nao():
    x = _clean()
    std = float(np.std(x))
    # 88% de 60 Hz foi UTILIZÁVEL no estudo (DataScience/33): não rejeita.
    utilizavel = assess_quality(x, 256, mains_power_ratio=0.88, signal_std=std)
    assert utilizavel.rejected is False
    assert utilizavel.score > 0.0  # penaliza pouco abaixo de 0,90
    # Rede praticamente total (sinal afogado): rejeita.
    afogado = assess_quality(x, 256, mains_power_ratio=0.99, signal_std=std)
    assert afogado.rejected is True
    assert "rede" in afogado.reason.lower()


def test_score_cai_com_a_rede_perto_do_total():
    x = _clean()
    std = float(np.std(x))
    baixo = assess_quality(x, 256, mains_power_ratio=0.30, signal_std=std).score
    alto_ruido = assess_quality(x, 256, mains_power_ratio=0.95, signal_std=std).score
    assert baixo > alto_ruido  # mais rede -> score menor


def test_amplitude_pega_transientes_de_artefato():
    """Exp. D: épocas com RMS muito acima da mediana = transiente (piscada/etc.)."""
    fs = 64
    rng = np.random.default_rng(1)
    epocas = [rng.normal(0, 5, fs) for _ in range(20)]
    # 3 de 20 épocas com amplitude MUITO maior (blink/jaw = alto RMS, não offset:
    # o detrend removeria um offset DC, mas não a variância do transiente).
    for i in (4, 11, 17):
        epocas[i] = rng.normal(0, 120, fs)
    x = np.concatenate(epocas)
    ratio = amplitude_artifact_ratio(x, fs, epoch_s=1.0)
    assert 0.0 < ratio < REJECT_ARTIFACT_FRACTION  # detecta, mas não rejeita a janela


def test_janela_curta_nao_inventa_veredito_de_transiente():
    # Poucas épocas -> não há base para dizer o que é transiente.
    x = _clean(fs=64, secs=2.0)
    assert amplitude_artifact_ratio(x, 64, epoch_s=1.0) == 0.0
