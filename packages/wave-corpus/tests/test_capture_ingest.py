"""Ingestão de um CSV de captura no corpus (glue da N1)."""
import csv

import numpy as np
import pytest

from wave_corpus import CorpusIndex, ingest_frame
from wave_corpus.capture_csv import read_capture_frame


def _write_capture(path, condition, fs=512, secs=4.0, seed=0, poor=9.0):
    rng = np.random.default_rng(seed)
    n = int(fs * secs)
    t = np.arange(n) / fs
    raw = 20.0 * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 8, n)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t", "raw", "poor_signal", "condition"])
        for i in range(n):
            w.writerow([f"{t[i]:.6f}", raw[i], poor, condition])


def test_read_capture_frame_extrai_condicao_poor_fs(tmp_path):
    p = tmp_path / "b1_oc.csv"
    _write_capture(p, "OC", poor=12.0)
    cap = read_capture_frame(str(p), montage=["FP1"])
    assert cap.condition == "eyes_closed"
    assert cap.poor_signal == 12.0
    assert cap.frame.n_channels == 1
    assert abs(cap.frame.fs - 512.0) < 1.0


def test_montagem_multicanal_recusada_na_captura(tmp_path):
    p = tmp_path / "b.csv"
    _write_capture(p, "OA")
    with pytest.raises(ValueError):
        read_capture_frame(str(p), montage=["FP1", "FP2"])  # captura é canal único


def test_ingestao_de_captura_grava_condicao_e_poor_signal(tmp_path):
    p = tmp_path / "b2_oa.csv"
    _write_capture(p, "OA", poor=7.0)
    index = CorpusIndex(
        database_url=f"sqlite:///{tmp_path / 'index.db'}",
        root=tmp_path / "store",
    )
    index.create_all()
    cap = read_capture_frame(str(p), montage=["FP1"])
    sid, _ = ingest_frame(
        index, cap.frame, device="NeuroSky MindWave Mobile 2",
        condition=cap.condition, poor_signal=cap.poor_signal,
    )
    sess = index.get_session(sid)
    assert sess.experimental_condition == "eyes_open"
    assert sess.poor_signal == 7.0
    assert sess.montage == ["FP1"]
