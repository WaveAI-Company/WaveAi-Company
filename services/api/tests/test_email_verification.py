"""Verificação de e-mail, cadastro uniforme e reenvio (ADR-0044 + emenda).

O que estes testes protegem:

1. **posse do endereço** — só quem recebe o código verifica a conta;
2. **anti-enumeração** — nenhuma resposta desta área distingue "e-mail existe"
   de "não existe" (ADR-0024); o que revela estado é sempre **posterior** à
   senha correta;
3. **adivinhação** — o código de 6 dígitos queima por tentativas, e a contagem
   mora no banco (vale com N réplicas).

Contas, códigos e e-mails são 100% sintéticos (CLAUDE.md).
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from app.api.deps import reset_login_limiter
from app.config import Settings, get_settings
from app.db.session import get_session
from app.emails import ASSUNTO_CADASTRO_EXISTENTE, ASSUNTO_VERIFICACAO
from app.main import app
from app.models import SingleUseToken, User
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .conftest import EmailRecorder

SENHA = "senha-de-teste-bem-longa"


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
    app.dependency_overrides.pop(get_session, None)


def _com_gate(**ajustes) -> Settings:
    """Configuração com a verificação **exigida** (o gate ligado)."""
    return get_settings().model_copy(
        update={"email_verification_required": True, **ajustes}
    )


@pytest.fixture
def gate_desligado() -> Iterator[None]:
    """Configuração com a verificação **não exigida**.

    Precisou virar fixture na P11-c: o gate passou a nascer ligado, e estes
    testes são justamente os que provam o que muda quando ele não está.
    """
    app.dependency_overrides[get_settings] = lambda: get_settings().model_copy(
        update={"email_verification_required": False}
    )
    yield
    app.dependency_overrides.pop(get_settings, None)


@pytest.fixture
def gate_ligado() -> Iterator[None]:
    # `lambda` sem parâmetros de propósito: o FastAPI lê a assinatura do
    # override como se fosse a de uma dependência, e um `**kwargs` viraria
    # parâmetro de query (a rota respondia 422 em vez de rodar).
    app.dependency_overrides[get_settings] = lambda: _com_gate()
    yield
    app.dependency_overrides.pop(get_settings, None)


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _registrar(client: TestClient, email: str):
    return client.post(
        "/auth/register",
        json={"email": email, "password": SENHA, "role": "patient", "display_name": "F"},
    )


def _codigo_de(emails: EmailRecorder, email: str) -> str:
    """Extrai o código do último e-mail de verificação enviado ao endereço."""
    mensagens = [
        e for e in emails.para(email) if e["subject"] == ASSUNTO_VERIFICACAO
    ]
    assert mensagens, f"nenhum e-mail de verificação para {email}"
    achado = re.search(r"\b(\d{6})\b", mensagens[-1]["body"])
    assert achado, "o e-mail não traz um código de 6 dígitos"
    return achado.group(1)


def _entrar(client: TestClient, email: str, senha: str = SENHA):
    return client.post(
        "/auth/login", json={"email": email, "password": senha, "client": "mobile"}
    )


def _usuario(db_session: Session, email: str) -> User:
    return db_session.scalars(select(User).where(User.email == email)).one()


# -- cadastro uniforme ---------------------------------------------------


def test_cadastro_manda_codigo_de_seis_digitos(client: TestClient, emails: EmailRecorder):
    email = _email()

    _registrar(client, email)

    assert len(_codigo_de(emails, email)) == 6


def test_cadastro_em_e_mail_existente_avisa_a_dona_e_nao_cria_conta(
    client: TestClient, db_session: Session, emails: EmailRecorder
):
    """A resposta não conta nada; quem fica sabendo é a dona do endereço."""
    email = _email()
    _registrar(client, email)

    _registrar(client, email)

    assunto_do_aviso = [e["subject"] for e in emails.para(email)]
    assert ASSUNTO_CADASTRO_EXISTENTE in assunto_do_aviso
    # Uma conta só — a segunda tentativa não criou nada.
    assert len(db_session.scalars(select(User).where(User.email == email)).all()) == 1


def test_cadastro_tem_rate_limit_por_ip(client: TestClient):
    """O `/register` não tinha throttle nenhum antes desta fatia."""
    limite = get_settings().register_rate_limit_attempts

    codigos = [_registrar(client, _email()).status_code for _ in range(limite + 1)]

    assert codigos[:limite] == [202] * limite
    assert codigos[-1] == 429


# -- verificação ---------------------------------------------------------


def test_codigo_correto_verifica_a_conta(
    client: TestClient, db_session: Session, emails: EmailRecorder
):
    email = _email()
    _registrar(client, email)

    resp = client.post(
        "/auth/verify-email", json={"email": email, "code": _codigo_de(emails, email)}
    )

    assert resp.status_code == 204
    assert _usuario(db_session, email).email_verified_at is not None


def test_codigo_vale_uma_vez_so(client: TestClient, emails: EmailRecorder):
    email = _email()
    _registrar(client, email)
    codigo = _codigo_de(emails, email)
    client.post("/auth/verify-email", json={"email": email, "code": codigo})

    repetido = client.post("/auth/verify-email", json={"email": email, "code": codigo})

    assert repetido.status_code == 400


def test_codigo_errado_e_email_inexistente_respondem_igual(
    client: TestClient, emails: EmailRecorder
):
    """A recusa não pode distinguir os dois casos — seria oráculo pelo erro."""
    email = _email()
    _registrar(client, email)

    errado = client.post("/auth/verify-email", json={"email": email, "code": "000000"})
    inexistente = client.post(
        "/auth/verify-email", json={"email": _email(), "code": "000000"}
    )

    assert errado.status_code == inexistente.status_code == 400
    assert errado.json() == inexistente.json()


def test_codigo_queima_por_tentativas(client: TestClient, emails: EmailRecorder):
    """A defesa real do código de 6 dígitos — e ela mora no banco."""
    tentativas = get_settings().single_use_token_max_attempts
    email = _email()
    _registrar(client, email)
    codigo = _codigo_de(emails, email)
    errado = "999999" if codigo != "999999" else "111111"

    for _ in range(tentativas):
        assert client.post(
            "/auth/verify-email", json={"email": email, "code": errado}
        ).status_code == 400

    # Depois de queimado, nem o código CERTO vale mais.
    assert client.post(
        "/auth/verify-email", json={"email": email, "code": codigo}
    ).status_code == 400


def test_codigo_expirado_nao_vale(
    client: TestClient, db_session: Session, emails: EmailRecorder
):
    email = _email()
    _registrar(client, email)
    codigo = _codigo_de(emails, email)
    token = db_session.scalars(select(SingleUseToken)).one()
    token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.flush()

    resp = client.post("/auth/verify-email", json={"email": email, "code": codigo})

    assert resp.status_code == 400


def test_codigo_de_uma_conta_nao_verifica_outra(
    client: TestClient, db_session: Session, emails: EmailRecorder
):
    """A busca é por (usuário, propósito): código não vaza entre contas."""
    uma, outra = _email(), _email()
    _registrar(client, uma)
    _registrar(client, outra)

    resp = client.post(
        "/auth/verify-email", json={"email": outra, "code": _codigo_de(emails, uma)}
    )

    assert resp.status_code == 400
    assert _usuario(db_session, outra).email_verified_at is None


# -- o gate do login -----------------------------------------------------


def test_o_gate_nasce_ligado():
    """Exigir a verificação é o padrão desde a P11-c, quando a tela chegou.

    Prende o valor porque é dele que depende o resto da suíte: com o gate
    desligado, nenhum outro teste atravessaria o login que o produto tem.
    """
    assert get_settings().email_verification_required is True


def test_sem_o_gate_a_conta_nao_verificada_entra(client: TestClient, gate_desligado):
    """Prova que quem barra o login é o gate, e nada mais.

    Foi assim que o backend da P9-e pôde ir para `main` antes das telas. Desde
    a P11-c o padrão é o contrário, e este teste precisa desligá-lo à mão.
    """
    email = _email()
    _registrar(client, email)

    assert _entrar(client, email).status_code == 200


def test_com_o_gate_a_conta_nao_verificada_nao_entra(client: TestClient, gate_ligado):
    email = _email()
    _registrar(client, email)

    resp = _entrar(client, email)

    assert resp.status_code == 403
    assert resp.json()["detail"] == "e-mail nao verificado"


def test_senha_errada_nao_revela_o_estado_da_conta(client: TestClient, gate_ligado):
    """O 403 só aparece DEPOIS da senha correta.

    Se aparecesse antes, bastaria uma senha qualquer para descobrir que o
    e-mail tem conta — exatamente o oráculo que o cadastro uniforme fecha.
    """
    email = _email()
    _registrar(client, email)

    resp = _entrar(client, email, senha="senha-errada-mas-bem-longa")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "credenciais invalidas"


def test_depois_de_verificar_entra(
    client: TestClient, emails: EmailRecorder, gate_ligado
):
    email = _email()
    _registrar(client, email)
    client.post(
        "/auth/verify-email", json={"email": email, "code": _codigo_de(emails, email)}
    )

    assert _entrar(client, email).status_code == 200


# -- reenvio -------------------------------------------------------------


def test_reenvio_manda_codigo_novo(client: TestClient, db_session: Session, emails: EmailRecorder):
    email = _email()
    _registrar(client, email)
    primeiro = _codigo_de(emails, email)
    # Sai do cooldown envelhecendo o token vivo.
    token = db_session.scalars(select(SingleUseToken)).one()
    token.created_at = datetime.now(UTC) - timedelta(minutes=5)
    db_session.flush()

    resp = client.post("/auth/resend-verification", json={"email": email})

    assert resp.status_code == 202
    segundo = _codigo_de(emails, email)
    assert segundo != primeiro
    # E o primeiro não vale mais: emitir supersede (ADR-0044, item 8).
    assert client.post(
        "/auth/verify-email", json={"email": email, "code": primeiro}
    ).status_code == 400


def test_reenvio_respeita_o_cooldown(client: TestClient, emails: EmailRecorder):
    email = _email()
    _registrar(client, email)
    enviados_antes = len(emails.para(email))

    resp = client.post("/auth/resend-verification", json={"email": email})

    assert resp.status_code == 202  # a resposta não denuncia o cooldown
    assert len(emails.para(email)) == enviados_antes  # mas nada foi enviado


def test_reenvio_para_email_sem_conta_responde_igual(
    client: TestClient, emails: EmailRecorder
):
    inexistente = _email()

    resp = client.post("/auth/resend-verification", json={"email": inexistente})

    assert resp.status_code == 202
    assert emails.para(inexistente) == []


def test_reenvio_para_conta_ja_verificada_nao_manda_nada(
    client: TestClient, emails: EmailRecorder
):
    email = _email()
    _registrar(client, email)
    client.post(
        "/auth/verify-email", json={"email": email, "code": _codigo_de(emails, email)}
    )
    antes = len(emails.para(email))

    resp = client.post("/auth/resend-verification", json={"email": email})

    assert resp.status_code == 202
    assert len(emails.para(email)) == antes


# -- reciclagem de conta não verificada ----------------------------------


def test_conta_nao_verificada_e_vencida_devolve_o_email(
    client: TestClient, db_session: Session, gate_ligado
):
    """É isto — e não a verificação — que devolve o endereço e impede o banco
    de acumular cadastros mortos."""
    email = _email()
    _registrar(client, email)
    antiga = _usuario(db_session, email)
    id_antigo = antiga.id
    antiga.created_at = datetime.now(UTC) - timedelta(
        days=get_settings().unverified_account_ttl_days + 1
    )
    db_session.flush()

    assert _registrar(client, email).status_code == 202

    nova = _usuario(db_session, email)
    assert nova.id != id_antigo  # a conta velha cedeu o lugar


def test_conta_verificada_nunca_e_reciclada(
    client: TestClient, db_session: Session, emails: EmailRecorder, gate_ligado
):
    email = _email()
    _registrar(client, email)
    client.post(
        "/auth/verify-email", json={"email": email, "code": _codigo_de(emails, email)}
    )
    user = _usuario(db_session, email)
    id_original = user.id
    user.created_at = datetime.now(UTC) - timedelta(days=3650)
    db_session.flush()

    _registrar(client, email)

    assert _usuario(db_session, email).id == id_original


def test_sem_o_gate_nao_recicla_ninguem(
    client: TestClient, db_session: Session, gate_desligado
):
    """Com o gate desligado, conta não verificada **usa** o produto — apagá-la
    destruiria dado de quem estava usando a plataforma."""
    email = _email()
    _registrar(client, email)
    user = _usuario(db_session, email)
    id_original = user.id
    user.created_at = datetime.now(UTC) - timedelta(days=3650)
    db_session.flush()

    _registrar(client, email)

    assert _usuario(db_session, email).id == id_original
