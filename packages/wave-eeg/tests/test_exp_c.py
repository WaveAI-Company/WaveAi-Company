"""Exp. C intercalado (§13) — pipeline travado, 100% sintético."""
import csv

import numpy as np
import pytest
from wave_eeg.exp_c import (
    LOAD,
    REST,
    Block,
    analyze_interleaved,
    load_blocks,
    synth_interleaved,
)


def test_alfa_menor_na_carga_passa():
    """Alfa forte no repouso, fraco na carga -> rel_alpha(REPOUSO) > rel_alpha(CARGA)."""
    res = analyze_interleaved(synth_interleaved(alpha_rest=25.0, alpha_load=8.0, seed=1))
    assert res.rest_rel_alpha > res.load_rel_alpha
    assert res.ratio > 1.0
    assert res.passed
    assert res.n_blocks_rest == 3 and res.n_blocks_load == 3
    assert res.cohens_d > 0.0
    # secundárias reportadas (exploratórias)
    assert set(res.secondary) == {"rel_theta", "ratio_theta_beta", "ratio_alpha_beta"}


def test_anti_falso_positivo_sem_diferenca():
    """Sem diferença real (alfa igual) -> NÃO passa; nada força significância."""
    res = analyze_interleaved(synth_interleaved(alpha_rest=12.0, alpha_load=12.0, seed=2))
    assert not res.passed


def test_direcao_invertida_nao_passa():
    """Se o alfa fosse MAIOR na carga, o veredito não passa (hipótese é repouso>carga)."""
    res = analyze_interleaved(synth_interleaved(alpha_rest=8.0, alpha_load=25.0, seed=3))
    assert not res.passed
    assert "invertida" in res.verdict


def test_condicao_desconhecida_falha():
    rng = np.random.default_rng(0)
    bloco = Block(condition="soneca", samples=rng.normal(0, 1, 2048), fs=512.0)
    with pytest.raises(ValueError):
        analyze_interleaved([bloco], discard_s=0.0)  # sem descarte: chega à checagem


def _write_capture(path, condition, fs=512, secs=4.0, alpha_amp=20.0, seed=0):
    rng = np.random.default_rng(seed)
    n = int(fs * secs)
    t = np.arange(n) / fs
    raw = alpha_amp * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 8, n)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t", "raw", "poor_signal", "condition"])
        for i in range(n):
            w.writerow([f"{t[i]:.6f}", raw[i], 9, condition])


def test_load_blocks_rest_load(tmp_path):
    paths = []
    for i, (cond, amp) in enumerate([("REST", 25.0), ("LOAD", 8.0)] * 3):
        p = tmp_path / f"b{i}_{cond}.csv"
        _write_capture(p, cond, alpha_amp=amp, seed=i)
        paths.append(str(p))
    blocks = load_blocks(paths)
    assert blocks[0].condition == REST
    assert blocks[1].condition == LOAD
    assert abs(blocks[0].fs - 512.0) < 1.0
    res = analyze_interleaved(blocks, discard_s=0.0)  # blocos de 4 s no teste
    assert res.rest_rel_alpha > res.load_rel_alpha
