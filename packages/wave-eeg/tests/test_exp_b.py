"""Exp. B intercalado (DataScience/31 §12) — pipeline travado, 100% sintético."""
import numpy as np
import pytest

from wave_eeg.exp_b import (
    EYES_CLOSED,
    EYES_OPEN,
    Block,
    analyze_interleaved,
    fs_from_duration,
    synth_interleaved,
)


def test_pipeline_travado_detecta_of_maior():
    """Com 60 Hz + drift + ruído, o pipeline travado ainda recupera OF>OA."""
    res = analyze_interleaved(synth_interleaved(alpha_closed=25.0, alpha_open=8.0, seed=1))
    assert res.eyes_closed_rel_alpha > res.eyes_open_rel_alpha
    assert res.ratio > 1.0
    assert res.passed
    assert res.n_blocks_closed == 3 and res.n_blocks_open == 3
    assert res.cohens_d > 0.0


def test_anti_falso_positivo_sem_diferenca_nao_passa():
    """Sem diferença real (OF≈OA), o veredito NÃO passa — nada força significância."""
    res = analyze_interleaved(synth_interleaved(alpha_closed=10.0, alpha_open=10.0, seed=2))
    assert not res.passed


def test_fs_por_bloco_nao_junta_timestamps():
    """§8.1: juntar condições inflava o fs (1022 Hz). Aqui o fs é por bloco."""
    fs, block_s = 512.0, 60.0
    n = int(fs * block_s)
    # fs correto: amostras do bloco / tempo real do bloco
    assert fs_from_duration(n, block_s) == pytest.approx(512.0)
    # o erro que NÃO cometemos: juntar 2 condições e dividir pelo tempo de 1 bloco
    assert fs_from_duration(2 * n, block_s) == pytest.approx(1024.0)
    # a análise usa o fs por bloco -> detecta OF>OA corretamente
    assert analyze_interleaved(synth_interleaved(seed=3)).passed


def test_descarte_de_transicao_por_bloco():
    """Descartar mais transição reduz as épocas por bloco (descarte é por bloco)."""
    blocks = synth_interleaved(seed=4)
    poucos = analyze_interleaved(blocks, discard_s=5.0)
    muitos = analyze_interleaved(blocks, discard_s=20.0)
    assert muitos.n_epochs_closed < poucos.n_epochs_closed
    assert muitos.n_epochs_open < poucos.n_epochs_open


def test_condicao_desconhecida_falha():
    with pytest.raises(ValueError):
        analyze_interleaved([Block(condition="olhos_semi", samples=np.zeros(2048), fs=512.0)])
