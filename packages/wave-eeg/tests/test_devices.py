"""Modelo de sinal multicanal e registro de montagem (ADR-0033)."""
import numpy as np
import pytest

from wave_eeg.devices import (
    UNKNOWN_CHANNEL,
    SignalFrame,
    montage_for,
    profile_for,
)


def test_montage_for_neurosky_e_fp1():
    # O device real do produto é canal único em FP1.
    assert montage_for("mindwave-mobile-2") == ("FP1",)
    # Normalização: espaços/caixa não atrapalham.
    assert montage_for("  MindWave-Mobile-2 ") == ("FP1",)


def test_montage_for_desconhecido_e_vazio():
    # Device desconhecido: não inventamos a posição — montagem vazia.
    assert montage_for("aparelho-novo") == ()
    assert montage_for(None) == ()
    assert profile_for("aparelho-novo") is None


def test_single_channel_resolve_montagem_pelo_device():
    frame = SignalFrame.single_channel([1.0, 2.0, 3.0, 4.0], fs=512, device="mindwave-mobile-2")
    assert frame.n_channels == 1
    assert frame.n_samples == 4
    assert frame.montage == ("FP1",)
    assert frame.device == "mindwave-mobile-2"
    # samples é 2D (canais × amostras), com N=1.
    assert frame.samples.shape == (1, 4)


def test_single_channel_device_desconhecido_usa_rotulo_generico():
    frame = SignalFrame.single_channel([0.0, 1.0], fs=256, device="xpto")
    # Um canal, posição não declarada — mais honesto que assumir FP1.
    assert frame.montage == (UNKNOWN_CHANNEL,)


def test_mono_devolve_o_unico_canal():
    frame = SignalFrame.single_channel([5.0, 6.0, 7.0], fs=128, device="simulador")
    assert np.array_equal(frame.mono(), np.array([5.0, 6.0, 7.0]))
    assert frame.channel(0).tolist() == [5.0, 6.0, 7.0]


def test_montagem_explicita_tem_precedencia():
    frame = SignalFrame.single_channel([1.0, 2.0], fs=256, device="mindwave", montage=["Fpz"])
    assert frame.montage == ("Fpz",)


def test_invariante_um_rotulo_por_canal():
    # Quadro 2 canais com só 1 rótulo é inválido (protege o forward-proofing).
    with pytest.raises(ValueError):
        SignalFrame(samples=np.zeros((2, 10)), fs=256.0, device="x", montage=("FP1",))


def test_mono_rejeita_multicanal():
    frame = SignalFrame(samples=np.zeros((2, 10)), fs=256.0, device="x", montage=("A", "B"))
    assert frame.n_channels == 2
    with pytest.raises(ValueError):
        frame.mono()
