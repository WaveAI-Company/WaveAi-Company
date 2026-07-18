"""Testes de integração da API de análise."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_analyze_demo_retorna_rel_alpha_e_verdict():
    resp = client.post("/analyze/demo")
    assert resp.status_code == 200

    body = resp.json()
    # Criterio de aceite da issue #3.
    assert "rel_alpha" in body
    assert "verdict" in body

    assert body["rel_alpha"]["eyes_closed"] > body["rel_alpha"]["eyes_open"]
    assert "PASSOU" in body["verdict"]


def test_analyze_demo_rastreia_engine_e_rotula_dado_ficticio():
    body = client.post("/analyze/demo").json()

    # Rastreabilidade (engine_version em todo resultado).
    assert "wave_eeg/" in body["engine_version"]
    # LGPD: dado sintetico rotulado como tal.
    assert body["data_source"] == "synthetic"


def test_analyze_demo_nao_faz_claim_clinica():
    body = client.post("/analyze/demo").json()
    assert "não-clínico" in body["disclaimer"].lower()
    assert "não-diagnóstico" in body["disclaimer"].lower()


def test_analyze_demo_expoe_qualidade_e_bandas():
    body = client.post("/analyze/demo").json()

    assert set(body["relative_band_powers"]) == {
        "delta", "theta", "alpha", "beta", "gamma",
    }
    assert set(body["quality"]) == {"signal_std", "mains_power", "mains_power_ratio"}
