"""Testes de integração da API de análise."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_report_longitudinal_traz_tendencias():
    """N5: relatório longitudinal sobre a série cronológica de features."""
    sessions = [
        {"rel_alpha": 0.20, "rel_beta": 0.10},
        {"rel_alpha": 0.30, "rel_beta": 0.10},
        {"rel_alpha": 0.40, "rel_beta": 0.10},
    ]
    resp = client.post(
        "/report/longitudinal",
        json={"sessions": sessions, "quality_scores": [0.9, 0.8, 0.7]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "wave_eeg/" in body["engine_version"]
    report = body["report"]
    assert report["n_sessions"] == 3
    assert report["features"]["rel_alpha"]["direction"] == "subindo"
    assert report["quality"]["last"] == 0.7
    assert "não-clínico" in body["disclaimer"].lower()
    # N5-c: sumário por template determinístico acompanha o relatório.
    assert isinstance(body["summary"], list) and body["summary"]
    assert any("alfa relativo" in linha for linha in body["summary"])


def test_report_longitudinal_serie_vazia_e_recusada():
    assert client.post("/report/longitudinal", json={"sessions": []}).status_code == 422


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
    # N3-b (ADR-0031): qualidade traz métricas cruas + veredito (score/rejeição).
    assert set(body["quality"]) == {
        "signal_std", "mains_power", "mains_power_ratio",
        "score", "rejected", "reason", "artifact_ratio",
    }
    assert 0.0 <= body["quality"]["score"] <= 1.0
