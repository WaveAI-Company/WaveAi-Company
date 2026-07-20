"""Relatório de sessão em batch (#15)."""

from fastapi.testclient import TestClient

from app.demo_data import synthetic_session
from app.main import app

client = TestClient(app)


def test_relatorio_de_sessao_sem_labels():
    samples, _, fs = synthetic_session(secs=4.0)
    resp = client.post("/analyze/session", json={"samples": samples.tolist(), "fs": fs})

    assert resp.status_code == 200
    corpo = resp.json()
    assert "wave_eeg/" in corpo["engine_version"]
    assert set(corpo["relative_band_powers"]) == {"delta", "theta", "alpha", "beta", "gamma"}
    # Sem labels, não há comparação Exp. B.
    assert "comparison" not in corpo


def test_relatorio_de_sessao_com_labels_faz_exp_b():
    samples, labels, fs = synthetic_session(secs=30.0)
    resp = client.post(
        "/analyze/session", json={"samples": samples.tolist(), "fs": fs, "labels": labels}
    )

    assert resp.status_code == 200
    comparison = resp.json()["comparison"]
    assert comparison["eyes_closed_rel_alpha"] > comparison["eyes_open_rel_alpha"]
    assert "PASSOU" in comparison["verdict"]


def test_labels_de_tamanho_errado_e_recusado():
    samples, _, fs = synthetic_session(secs=4.0)
    resp = client.post(
        "/analyze/session",
        json={"samples": samples.tolist(), "fs": fs, "labels": ["OC", "OA"]},
    )
    assert resp.status_code == 422


def test_sessao_vazia_e_recusada():
    assert client.post("/analyze/session", json={"samples": [], "fs": 512}).status_code == 422
