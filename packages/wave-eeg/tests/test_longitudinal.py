"""Tendências longitudinais por feature (N5) — descritivo, sem clínica."""
import numpy as np
import pytest

from wave_eeg.longitudinal import (
    DIRECTION_DOWN,
    DIRECTION_FLAT,
    DIRECTION_UP,
    feature_trend,
    longitudinal_report,
)


def test_tendencia_subindo():
    tr = feature_trend([0.10, 0.20, 0.30, 0.40])
    assert tr.direction == DIRECTION_UP
    assert tr.slope > 0
    assert tr.first == 0.10 and tr.last == 0.40
    assert tr.delta_abs == pytest.approx(0.30)
    assert tr.n == 4


def test_tendencia_descendo():
    tr = feature_trend([0.40, 0.30, 0.20, 0.10])
    assert tr.direction == DIRECTION_DOWN
    assert tr.slope < 0


def test_tendencia_estavel_dentro_do_ruido():
    # Variação minúscula em torno de 0,30 -> estável (não é tendência).
    tr = feature_trend([0.300, 0.301, 0.299, 0.300, 0.3005])
    assert tr.direction == DIRECTION_FLAT


def test_uma_sessao_e_estavel_sem_inclinacao():
    tr = feature_trend([0.25])
    assert tr.n == 1
    assert tr.slope == 0.0
    assert tr.direction == DIRECTION_FLAT
    assert tr.first == tr.last == 0.25


def test_ignora_nao_finitos_e_vazio():
    tr = feature_trend([0.2, float("nan"), 0.4, None])
    assert tr.n == 2
    assert feature_trend([float("nan"), None]) is None


def test_relatorio_agrega_por_feature():
    sessions = [
        {"rel_alpha": 0.20, "rel_beta": 0.10},
        {"rel_alpha": 0.30, "rel_beta": 0.10},
        {"rel_alpha": 0.40, "rel_beta": 0.10},
    ]
    rep = longitudinal_report(sessions)
    assert rep["n_sessions"] == 3
    assert rep["features"]["rel_alpha"]["direction"] == DIRECTION_UP
    assert rep["features"]["rel_beta"]["direction"] == DIRECTION_FLAT


def test_relatorio_resume_qualidade_quando_dada():
    sessions = [{"rel_alpha": 0.3}, {"rel_alpha": 0.3}]
    rep = longitudinal_report(sessions, quality_scores=[0.9, 0.7])
    assert rep["quality"]["n"] == 2
    assert rep["quality"]["min"] == 0.7
    assert rep["quality"]["last"] == 0.7


def test_relatorio_feature_ausente_em_algumas_sessoes():
    # rel_beta só existe em 2 das 3 sessões: n reflete o disponível.
    sessions = [
        {"rel_alpha": 0.2, "rel_beta": 0.1},
        {"rel_alpha": 0.3},
        {"rel_alpha": 0.4, "rel_beta": 0.2},
    ]
    rep = longitudinal_report(sessions)
    assert rep["features"]["rel_alpha"]["n"] == 3
    assert rep["features"]["rel_beta"]["n"] == 2
