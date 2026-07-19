"""Análise de janela ao vivo (#14)."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.demo_data import synthetic_session
from app.main import app

client = TestClient(app)
FS = 512.0


def _janela(alpha_amp: float, secs: float = 2.0, seed: int = 7) -> list[float]:
    rng = np.random.default_rng(seed)
    t = np.arange(int(FS * secs)) / FS
    sinal = alpha_amp * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 10, t.size)
    return sinal.tolist()


def test_janela_devolve_features():
    resp = client.post("/analyze/window", json={"samples": _janela(20.0), "fs": FS})

    assert resp.status_code == 200
    corpo = resp.json()
    assert 0.0 <= corpo["rel_alpha"] <= 1.0
    assert set(corpo["relative_band_powers"]) == {
        "delta", "theta", "alpha", "beta", "gamma",
    }
    assert set(corpo["quality"]) == {"signal_std", "mains_power", "mains_power_ratio"}


def test_janela_rastreia_a_versao_do_engine():
    corpo = client.post("/analyze/window", json={"samples": _janela(20.0), "fs": FS}).json()
    assert "wave_eeg/" in corpo["engine_version"]


def test_mais_alfa_no_sinal_gera_rel_alpha_maior():
    """Sanidade: o resultado acompanha o sinal, não é constante."""
    forte = client.post("/analyze/window", json={"samples": _janela(30.0), "fs": FS}).json()
    fraco = client.post("/analyze/window", json={"samples": _janela(2.0), "fs": FS}).json()

    assert forte["rel_alpha"] > fraco["rel_alpha"]


def test_janela_nao_faz_claim_clinica():
    corpo = client.post("/analyze/window", json={"samples": _janela(20.0), "fs": FS}).json()
    assert "não-clínico" in corpo["disclaimer"].lower()


@pytest.mark.parametrize(
    "payload",
    [
        {"samples": [], "fs": 512},
        {"samples": [1.0] * 8, "fs": 512},           # curta demais
        {"samples": [1.0] * 100, "fs": 0},
        {"samples": [1.0] * 100, "fs": -1},
        {"samples": [1.0] * 40_000, "fs": 512},      # grande demais
        {"fs": 512},
    ],
)
def test_janela_malformada_e_recusada(payload: dict):
    assert client.post("/analyze/window", json=payload).status_code == 422


def test_janela_do_simulador_do_pacote():
    """Usa o gerador sintético do próprio pacote, como manda o aceite da #14."""
    samples, _, fs = synthetic_session(secs=2.0)
    resp = client.post("/analyze/window", json={"samples": samples[:1024].tolist(), "fs": fs})

    assert resp.status_code == 200
    assert resp.json()["n_samples"] == 1024
