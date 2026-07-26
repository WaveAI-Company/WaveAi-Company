"""Relatório de sessão em batch (#15)."""

from fastapi.testclient import TestClient
from wave_eeg import FEATURE_CATALOG

from app.demo_data import synthetic_session
from app.main import app

client = TestClient(app)
CATALOG_NAMES = {spec.name for spec in FEATURE_CATALOG}


def test_relatorio_de_sessao_sem_labels():
    samples, _, fs = synthetic_session(secs=4.0)
    resp = client.post("/analyze/session", json={"samples": samples.tolist(), "fs": fs})

    assert resp.status_code == 200
    corpo = resp.json()
    assert "wave_eeg/" in corpo["engine_version"]
    assert set(corpo["relative_band_powers"]) == {"delta", "theta", "alpha", "beta", "gamma"}
    # N3-a.1: relatório de sessão traz o Catálogo N2 completo.
    assert set(corpo["features"]) == CATALOG_NAMES
    # Sem labels, não há comparação Exp. B.
    assert "comparison" not in corpo


def test_relatorio_com_historico_traz_desvios_do_baseline():
    """ADR-0032: /analyze/session com histórico do titular traz `deviations`."""
    samples, _, fs = synthetic_session(secs=4.0)
    # Descobre o rel_alpha atual para posicionar o histórico longe dele.
    atual = client.post(
        "/analyze/session", json={"samples": samples.tolist(), "fs": fs}
    ).json()
    assert atual["deviations"] == {}  # sem histórico, sem desvio
    base = atual["features"]["rel_alpha"]

    history = [{"rel_alpha": base + 0.2 + 0.001 * (i % 2)} for i in range(30)]
    resp = client.post(
        "/analyze/session",
        json={"samples": samples.tolist(), "fs": fs, "history": history},
    )
    assert resp.status_code == 200
    dev = resp.json()["deviations"]["rel_alpha"]
    assert dev["source"] == "personal"
    assert dev["is_peak"] is True


def test_relatorio_carrega_proveniencia_do_device():
    """ADR-0033: /analyze/session ecoa device + montagem (flui p/ persistência)."""
    samples, _, fs = synthetic_session(secs=4.0)
    resp = client.post(
        "/analyze/session",
        json={"samples": samples.tolist(), "fs": fs, "device": "mindwave-mobile-2"},
    )

    assert resp.status_code == 200
    corpo = resp.json()
    assert corpo["device"] == "mindwave-mobile-2"
    assert corpo["montage"] == ["FP1"]


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
