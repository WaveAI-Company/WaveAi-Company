"""Testes das rotas de autenticação (ADR-0021/0023)."""

import uuid
from collections.abc import Iterator

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import require_role, reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import UserRole

SENHA = "senha-de-teste-bem-longa"
COOKIE = "waveai_refresh"


# Rota mínima só para exercer a autorização por papel: as rotas de produto por
# papel chegam nas issues #9/#10.
@app.get("/_test/doctor-only")
def _doctor_only(user=Depends(require_role(UserRole.DOCTOR))):  # noqa: ANN001
    return {"ok": True}


@pytest.fixture(autouse=True)
def _limiter_limpo() -> Iterator[None]:
    # O limiter é global ao processo; sem reset, um teste contamina o outro.
    reset_login_limiter()
    yield
    reset_login_limiter()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """Cliente HTTP ligado à sessão transacional do teste.

    `base_url` é **https** de propósito: o cookie do refresh usa `Secure`, que
    o navegador (e o TestClient) só envia sobre TLS. Testar em http mascararia
    a configuração real de produção.
    """
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _registrar(client: TestClient, email: str, role: str = "patient"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": SENHA, "role": role, "display_name": "Fulano"},
    )


# -- registro ------------------------------------------------------------


def test_registro_devolve_201_sem_expor_credencial(client: TestClient):
    resp = _registrar(client, _email())

    assert resp.status_code == 201
    corpo = resp.json()
    assert corpo["role"] == "patient"
    assert "password" not in corpo
    assert "password_hash" not in corpo


def test_registro_duplicado_devolve_409(client: TestClient):
    email = _email()
    _registrar(client, email)
    assert _registrar(client, email).status_code == 409


def test_registro_recusa_senha_curta(client: TestClient):
    resp = client.post(
        "/auth/register",
        json={"email": _email(), "password": "curta", "role": "patient", "display_name": "F"},
    )
    assert resp.status_code == 422


# -- login e armazenamento por plataforma (ADR-0021) ---------------------


def test_login_web_poe_refresh_em_cookie_httponly_e_nao_no_corpo(client: TestClient):
    email = _email()
    _registrar(client, email)

    resp = client.post("/auth/login", json={"email": email, "password": SENHA, "client": "web"})

    assert resp.status_code == 200
    assert resp.json()["access_token"]
    # No web o refresh NUNCA vai no corpo (JS não pode alcançá-lo).
    assert resp.json()["refresh_token"] is None

    set_cookie = resp.headers["set-cookie"]
    assert COOKIE in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite" in set_cookie


def test_login_mobile_devolve_refresh_no_corpo_e_sem_cookie(client: TestClient):
    email = _email()
    _registrar(client, email)

    resp = client.post(
        "/auth/login", json={"email": email, "password": SENHA, "client": "mobile"}
    )

    assert resp.status_code == 200
    assert resp.json()["refresh_token"]  # vai para o expo-secure-store
    assert "set-cookie" not in {k.lower() for k in resp.headers}


def test_senha_errada_e_email_inexistente_respondem_identico(client: TestClient):
    email = _email()
    _registrar(client, email)

    errada = client.post("/auth/login", json={"email": email, "password": "outra-senha"})
    inexistente = client.post(
        "/auth/login", json={"email": _email(), "password": SENHA}
    )

    assert errada.status_code == inexistente.status_code == 401
    # Mesma mensagem: não dá para descobrir se o e-mail existe (ADR-0023).
    assert errada.json()["detail"] == inexistente.json()["detail"]


# -- rate limiting (ADR-0023) -------------------------------------------


def test_login_e_limitado_por_tentativas(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WAVEAI_API_LOGIN_RATE_LIMIT_ATTEMPTS", "3")
    reset_login_limiter()

    email = _email()
    _registrar(client, email)

    for _ in range(3):
        client.post("/auth/login", json={"email": email, "password": "errada"})

    bloqueado = client.post("/auth/login", json={"email": email, "password": "errada"})
    assert bloqueado.status_code == 429


def test_throttle_acontece_antes_de_validar_a_senha(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """Se o limiter rodasse depois do Argon2, a senha correta passaria."""
    monkeypatch.setenv("WAVEAI_API_LOGIN_RATE_LIMIT_ATTEMPTS", "2")
    reset_login_limiter()

    email = _email()
    _registrar(client, email)

    for _ in range(2):
        client.post("/auth/login", json={"email": email, "password": "errada"})

    # Credencial VÁLIDA, mas a janela já estourou -> 429, não 200.
    resp = client.post("/auth/login", json={"email": email, "password": SENHA})
    assert resp.status_code == 429


# -- refresh via cookie e reuso -----------------------------------------


def test_refresh_pelo_cookie_rotaciona(client: TestClient):
    email = _email()
    _registrar(client, email)
    client.post("/auth/login", json={"email": email, "password": SENHA, "client": "web"})

    resp = client.post("/auth/refresh", json={"client": "web"})

    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_reuso_de_refresh_pela_api_derruba_a_sessao(client: TestClient):
    email = _email()
    _registrar(client, email)
    login = client.post(
        "/auth/login", json={"email": email, "password": SENHA, "client": "mobile"}
    )
    antigo = login.json()["refresh_token"]

    novo = client.post(
        "/auth/refresh", json={"refresh_token": antigo, "client": "mobile"}
    ).json()["refresh_token"]

    # Reapresentar o antigo: 401 e a família inteira cai.
    assert client.post(
        "/auth/refresh", json={"refresh_token": antigo, "client": "mobile"}
    ).status_code == 401
    assert client.post(
        "/auth/refresh", json={"refresh_token": novo, "client": "mobile"}
    ).status_code == 401


def test_refresh_sem_token_devolve_401(client: TestClient):
    assert client.post("/auth/refresh", json={"client": "web"}).status_code == 401


def test_logout_limpa_o_cookie_e_invalida_o_refresh(client: TestClient):
    email = _email()
    _registrar(client, email)
    client.post("/auth/login", json={"email": email, "password": SENHA, "client": "web"})

    assert client.post("/auth/logout", json={"client": "web"}).status_code == 204
    assert client.post("/auth/refresh", json={"client": "web"}).status_code == 401


# -- rotas protegidas e papéis ------------------------------------------


def _login_token(client: TestClient, email: str, role: str = "patient") -> str:
    _registrar(client, email, role)
    resp = client.post(
        "/auth/login", json={"email": email, "password": SENHA, "client": "mobile"}
    )
    return resp.json()["access_token"]


def test_rota_protegida_exige_token(client: TestClient):
    assert client.get("/auth/me").status_code == 401


def test_rota_protegida_recusa_token_invalido(client: TestClient):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer nao-e-um-token"})
    assert resp.status_code == 401


def test_me_devolve_o_usuario_autenticado(client: TestClient):
    email = _email()
    token = _login_token(client, email)

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    assert resp.json()["email"] == email
    assert resp.json()["display_name"] == "Fulano"


def test_papel_errado_devolve_403(client: TestClient):
    token = _login_token(client, _email(), role="patient")

    resp = client.get("/_test/doctor-only", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 403


def test_papel_correto_e_autorizado(client: TestClient):
    token = _login_token(client, _email(), role="doctor")

    resp = client.get("/_test/doctor-only", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
