"""Exp. D — caracterização de artefatos (§14), 100% sintético."""
import csv

import numpy as np
import pytest

from wave_eeg.exp_d import (
    BLINK,
    CLEAN,
    JAW,
    Block,
    characterize,
    load_blocks,
    synth_artifacts,
)


def _sigs(blocks):
    signatures, _ = characterize(blocks)
    return {s.label: s for s in signatures}


def test_clean_e_referencia_neutra():
    s = _sigs(synth_artifacts(seed=1))
    assert 0.8 <= s[CLEAN].rms_ratio <= 1.2      # CLEAN vs ele mesmo ~ 1
    assert s[CLEAN].detect_rate < 0.3            # poucas épocas acima do limiar


def test_blink_alta_amplitude_e_detectavel():
    s = _sigs(synth_artifacts(seed=2))
    assert s[BLINK].rms_ratio > 2.0             # piscada é grande em amplitude
    assert s[BLINK].detect_rate > 0.8           # quase toda época sinalizada


def test_jaw_infla_alta_frequencia():
    s = _sigs(synth_artifacts(seed=3))
    # EMG (25 Hz injetado) infla beta em relação ao CLEAN
    assert s[JAW].band_delta["beta"] > 0
    assert s[JAW].rms_ratio > 1.0


def test_exige_bloco_clean():
    blocks = [b for b in synth_artifacts(seed=4) if b.condition != CLEAN]
    with pytest.raises(ValueError):
        characterize(blocks)


def test_artefato_desconhecido_falha():
    with pytest.raises(ValueError):
        characterize([Block(condition="tosse", samples=np.zeros(30000), fs=512.0)])


def _write(path, label, fs=512, secs=30.0, seed=0):
    rng = np.random.default_rng(seed)
    n = int(fs * secs)
    t = np.arange(n) / fs
    raw = 10 * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 8, n)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t", "raw", "poor_signal", "condition"])
        for i in range(n):
            w.writerow([f"{t[i]:.6f}", raw[i], 8, label])


def test_load_blocks_rotulos(tmp_path):
    for label in ("CLEAN", "BLINK", "JAW"):
        _write(tmp_path / f"{label}.csv", label)
    blocks = load_blocks([str(tmp_path / f"{l}.csv") for l in ("CLEAN", "BLINK", "JAW")])
    assert {b.condition for b in blocks} == {CLEAN, BLINK, JAW}
    sigs, _ = characterize(blocks, discard_s=0.0)
    assert any(s.label == CLEAN for s in sigs)
