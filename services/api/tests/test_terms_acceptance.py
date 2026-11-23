"""Aceite dos Termos por quem já tem conta (emenda à ADR-0048).

O que estes testes protegem: a Política promete "avisaremos no aplicativo"
quando os Termos mudam. Para o app avisar, ele precisa **saber** qual versão a
pessoa aceitou; para o aviso valer, o aceite precisa ser da versão **vigente**
— a mesma regra de 409 do cadastro.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.legal import TERMS_VERSION
from app.main import app
from app.models import User
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .conftest import SENHA, registrar_conta


@pytest.fixture(autouse=True)
def _limiter_limpo() -> Iterator[None]:
    reset_login_limiter()
    yield
    reset_login_limiter()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def _entrar(client: TestClient) -> tuple[str, dict[str, str]]:
    email = f"termos-{uuid.uuid4().hex[:10]}@example.com"
    registrar_conta(client, email=email, senha=SENHA)
    token = client.post(
        "/auth/login", json={"email": email, "password": SENHA, "client": "mobile"}
    ).json()["access_token"]
    return email, {"Authorization": f"Bearer {token}"}


def test_me_diz_que_nao_ha_registro_de_aceite(client: TestClient):
    """Conta sem aceite registrado: nulo, que é a verdade — não "recusou"."""
    _, headers = _entrar(client)
    assert client.get("/auth/me", headers=headers).json()["accepted_terms_version"] is None


def test_aceitar_a_versao_vigente_fica_registrado(client: TestClient, db_session: Session):
    email, headers = _entrar(client)
    resposta = client.post("/auth/me/terms", json={"version": TERMS_VERSION}, headers=headers)
    assert resposta.status_code == 204

    assert client.get("/auth/me", headers=headers).json()["accepted_terms_version"] == TERMS_VERSION
    usuario = db_session.scalars(select(User).where(User.email == email)).one()
    assert usuario.accepted_terms_at is not None


def test_aceitar_versao_desatualizada_e_recusado(client: TestClient):
    """O app mostrou um texto que já não vale: aceitar isso não é aceite informado."""
    _, headers = _entrar(client)
    resposta = client.post("/auth/me/terms", json={"version": "0.1"}, headers=headers)
    assert resposta.status_code == 409
    assert client.get("/auth/me", headers=headers).json()["accepted_terms_version"] is None


def test_aceitar_exige_sessao(client: TestClient):
    assert client.post("/auth/me/terms", json={"version": TERMS_VERSION}).status_code == 401
