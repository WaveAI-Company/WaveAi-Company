"""Captura de poor_signal + carregamento de blocos de captura (glue da N1)."""
import csv

import numpy as np

from wave_eeg.cli import capture_rows
from wave_eeg.exp_b import (
    EYES_CLOSED,
    EYES_OPEN,
    analyze_interleaved,
    load_blocks,
    read_capture_csv,
)
from wave_eeg.reader import SimulatedReader


def test_capture_rows_pareia_poor_signal():
    # O simulador insere pacotes de poor_signal (=0) periodicamente.
    samples = list(np.zeros(600, dtype=int))
    reader = SimulatedReader(samples, fs=512)
    # clock constante: não dispara o limite; o stream simulado é finito e termina.
    rows = capture_rows(reader, max_seconds=10.0, clock=lambda: 0.0)
    assert len(rows) == len(samples)
    # cada linha tem (t, raw, poor_signal); poor_signal preenchido (0), não None
    assert all(len(r) == 3 for r in rows)
    assert rows[-1][2] == 0


def _write_capture(path, condition, fs=512, secs=4.0, alpha_amp=25.0, seed=0, poor=8.0):
    rng = np.random.default_rng(seed)
    n = int(fs * secs)
    t = np.arange(n) / fs
    raw = alpha_amp * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 8, n)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t", "raw", "poor_signal", "condition"])
        for i in range(n):
            w.writerow([f"{t[i]:.6f}", raw[i], poor, condition])


def test_read_capture_csv_condicao_e_poor(tmp_path):
    p = tmp_path / "b1_oc.csv"
    _write_capture(p, "OC", poor=12.0)
    cap = read_capture_csv(str(p))
    assert cap.condition == EYES_CLOSED
    assert cap.poor_signal_mean == 12.0
    assert cap.raw.size == int(512 * 4.0)


def test_load_blocks_fs_por_bloco_e_analise(tmp_path):
    paths = []
    for i, cond in enumerate(["OC", "OA", "OC", "OA", "OC", "OA"]):
        amp = 25.0 if cond == "OC" else 8.0  # OF > OA
        p = tmp_path / f"b{i}_{cond}.csv"
        _write_capture(p, cond, alpha_amp=amp, seed=i)
        paths.append(str(p))
    blocks = load_blocks(paths)
    assert blocks[0].condition == EYES_CLOSED
    assert blocks[1].condition == EYES_OPEN
    assert abs(blocks[0].fs - 512.0) < 1.0  # fs por bloco pelo tempo real (~512)
    # o pipeline travado roda sobre os blocos carregados e detecta OF>OA.
    # discard_s=0: os blocos de teste têm só 4 s (o default de 5 s os esvaziaria).
    res = analyze_interleaved(blocks, discard_s=0.0)
    assert res.eyes_closed_rel_alpha > res.eyes_open_rel_alpha
