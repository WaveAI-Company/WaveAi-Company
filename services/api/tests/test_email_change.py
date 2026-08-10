"""Troca do e-mail da conta (3ª emenda à ADR-0044).

O que estes testes protegem:

1. **quem prova posse é o endereço NOVO** — o código chega lá, e a troca só
   acontece quando ele volta digitado;
2. **anti-enumeração (ADR-0024)** — pedir a troca para um endereço que já tem
   conta responde igual a pedir para um livre; quem é avisado é a dona do
   endereço, não quem pediu;
3. **a senha atual é obrigatória** — um token roubado não move a conta;
4. **o endereço antigo é avisado** — é o único sinal que chega a quem está
   perdendo a conta;
5. **o vínculo sobrevive** — `care_links` guarda id, não e-mail.

Contas, endereços e senhas são 100% sintéticos (CLAUDE.md).
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Iterator

import pytest
from app.api.deps import reset_login_limiter
from app.config import get_settings
from app.db.session import get_session
from app.emails import (
    ASSUNTO_ENDERECO_JA_EM_USO,
    ASSUNTO_TROCA_AVISO,
    ASSUNTO_TROCA_DE_EMAIL,
)
from app.main import app
from app.models import SingleUseToken, SingleUseTokenPurpose
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .conftest import SENHA, EmailRecorder, registrar_conta


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


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _conta(client: TestClient, email: str | None = None, role: str = "patient") -> str:
    endereco = email or _email()
    registrar_conta(client, email=endereco, senha=SENHA, role=role)
    return endereco


def _token_de(client: TestClient, email: str) -> str:
    resp = client.post(
        "/auth/login", json={"email": email, "password": SENHA, "client": "mobile"}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _pedir(client: TestClient, token: str, novo: str, senha: str = SENHA):
    return client.post(
        "/auth/email",
        json={"current_password": senha, "new_email": novo},
        headers={"Authorization": f"Bearer {token}"},
    )


def _confirmar(client: TestClient, token: str, codigo: str):
    return client.post(
        "/auth/email/confirm",
        json={"code": codigo},
        headers={"Authorization": f"Bearer {token}"},
    )


def _codigo(emails: EmailRecorder, endereco: str) -> str:
    """Lê o código de 6 dígitos do e-mail que chegou ao endereço NOVO."""
    mensagens = [
        e for e in emails.para(endereco) if e["subject"] == ASSUNTO_TROCA_DE_EMAIL
    ]
    assert mensagens, f"nenhum e-mail de troca para {endereco}"
    achado = re.search(r"\b(\d{6})\b", mensagens[-1]["body"])
    assert achado, "o e-mail de troca não traz um código de 6 dígitos"
    return achado.group(1)


# -- caminho feliz -------------------------------------------------------


def test_troca_completa_muda_o_login(client: TestClient, emails: EmailRecorder):
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()

    assert _pedir(client, token, novo).status_code == 202
    assert _confirmar(client, token, _codigo(emails, novo)).status_code == 204

    # O endereço novo é o login; o antigo não entra mais.
    assert client.post(
        "/auth/login", json={"email": novo, "password": SENHA}
    ).status_code == 200
    assert client.post(
        "/auth/login", json={"email": antigo, "password": SENHA}
    ).status_code == 401
    # E o `me` da sessão em curso já reflete a troca (a sessão não caiu).
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == novo


def test_o_codigo_vai_para_o_endereco_novo_e_o_aviso_para_o_antigo(
    client: TestClient, emails: EmailRecorder
):
    """O endereço que precisa provar posse é o **novo**; o antigo só é avisado."""
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()

    _pedir(client, token, novo)

    assuntos_novo = [e["subject"] for e in emails.para(novo)]
    assuntos_antigo = [e["subject"] for e in emails.para(antigo)]
    assert ASSUNTO_TROCA_DE_EMAIL in assuntos_novo
    assert ASSUNTO_TROCA_AVISO in assuntos_antigo
    # O aviso ao antigo NÃO entrega o endereço de destino: se a troca partiu de
    # um invasor, este e-mail é o que chega à vítima.
    aviso = [e for e in emails.para(antigo) if e["subject"] == ASSUNTO_TROCA_AVISO][-1]
    assert novo not in aviso["body"]
    # E o e-mail do endereço novo não nomeia a conta de origem: quem recebe
    # pode ser um estranho que teve o endereço digitado por engano.
    codigo_msg = [e for e in emails.para(novo) if e["subject"] == ASSUNTO_TROCA_DE_EMAIL][-1]
    assert antigo not in codigo_msg["body"]


def test_ate_confirmar_o_endereco_antigo_continua_valendo(
    client: TestClient, emails: EmailRecorder
):
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()

    _pedir(client, token, novo)

    # Pedido feito, código não usado: nada mudou.
    assert client.post(
        "/auth/login", json={"email": antigo, "password": SENHA}
    ).status_code == 200
    assert client.post(
        "/auth/login", json={"email": novo, "password": SENHA}
    ).status_code == 401


def test_vinculo_sobrevive_a_troca(client: TestClient, emails: EmailRecorder):
    """`care_links` guarda id, não e-mail — trocar de endereço não desfaz nada."""
    paciente = _conta(client)
    medico = _conta(client, role="doctor")
    token_paciente = _token_de(client, paciente)
    # Paciente inicia: o vínculo nasce ACTIVE (ADR-0024).
    assert client.post(
        "/care-links",
        json={"email": medico},
        headers={"Authorization": f"Bearer {token_paciente}"},
    ).status_code == 202

    novo = _email()
    _pedir(client, token_paciente, novo)
    assert _confirmar(client, token_paciente, _codigo(emails, novo)).status_code == 204

    vinculos = client.get(
        "/care-links", headers={"Authorization": f"Bearer {_token_de(client, novo)}"}
    )
    assert vinculos.status_code == 200
    assert [v["status"] for v in vinculos.json()] == ["active"]


# -- senha atual ---------------------------------------------------------


def test_senha_errada_nao_troca_nem_manda_email(
    client: TestClient, emails: EmailRecorder
):
    """Um token roubado não pode bastar para mover a conta."""
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()

    resp = _pedir(client, token, novo, senha="nao-e-a-senha-atual-1")

    assert resp.status_code == 401
    assert emails.para(novo) == []
    # Nem o aviso ao endereço antigo sai: não houve pedido legítimo.
    assert [e["subject"] for e in emails.para(antigo) if e["subject"] == ASSUNTO_TROCA_AVISO] == []


def test_sem_autenticacao_nao_ha_troca(client: TestClient):
    resp = client.post(
        "/auth/email", json={"current_password": SENHA, "new_email": _email()}
    )
    assert resp.status_code == 401


# -- anti-enumeração -----------------------------------------------------


def test_endereco_ocupado_responde_igual_e_avisa_o_dono(
    client: TestClient, emails: EmailRecorder, db_session: Session
):
    """A resposta não pode contar se o endereço tem conta (ADR-0024)."""
    ocupado = _conta(client)
    antigo = _conta(client)
    token = _token_de(client, antigo)

    livre = _email()
    resposta_livre = _pedir(client, token, livre)
    # Cooldown é por (usuário, propósito): usar outra conta para o 2º pedido.
    outro = _conta(client)
    resposta_ocupada = _pedir(client, _token_de(client, outro), ocupado)

    assert resposta_ocupada.status_code == resposta_livre.status_code == 202
    assert resposta_ocupada.json() == resposta_livre.json()

    # Quem fica sabendo é a dona do endereço — e não quem pediu.
    assert [e["subject"] for e in emails.para(ocupado)][-1] == ASSUNTO_ENDERECO_JA_EM_USO
    # Nenhum token de troca foi emitido para a segunda conta.
    tokens = db_session.scalars(
        select(SingleUseToken).where(
            SingleUseToken.purpose == SingleUseTokenPurpose.EMAIL_CHANGE,
            SingleUseToken.new_email == ocupado,
        )
    ).all()
    assert tokens == []


def test_endereco_ocupado_nao_muda_nada(client: TestClient, emails: EmailRecorder):
    ocupado = _conta(client)
    antigo = _conta(client)
    token = _token_de(client, antigo)

    _pedir(client, token, ocupado)

    # Sem token emitido, não há código que confirme: a conta segue no antigo.
    assert _confirmar(client, token, "000000").status_code == 400
    assert client.post(
        "/auth/login", json={"email": antigo, "password": SENHA}
    ).status_code == 200


def test_pedir_o_proprio_endereco_e_recusado(client: TestClient):
    """Aqui vale dizer o que houve: a pessoa conhece o próprio e-mail."""
    antigo = _conta(client)
    token = _token_de(client, antigo)

    resp = _pedir(client, token, antigo)

    assert resp.status_code == 400


# -- o segredo -----------------------------------------------------------


def test_codigo_errado_gasta_tentativa_e_no_teto_queima(
    client: TestClient, emails: EmailRecorder, db_session: Session
):
    """A defesa dos 6 dígitos é o contador na linha, não a entropia."""
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()
    _pedir(client, token, novo)
    codigo = _codigo(emails, novo)

    errado = "000000" if codigo != "000000" else "111111"
    for _ in range(get_settings().single_use_token_max_attempts):
        assert _confirmar(client, token, errado).status_code == 400

    # Queimado: nem o código certo vale mais, e a conta segue no endereço antigo.
    assert _confirmar(client, token, codigo).status_code == 400
    assert client.post(
        "/auth/login", json={"email": antigo, "password": SENHA}
    ).status_code == 200


def test_codigo_da_troca_nao_serve_para_verificar_o_email(
    client: TestClient, emails: EmailRecorder, db_session: Session
):
    """O `purpose` não é rótulo: um propósito não vale pelo outro (ADR-0044).

    A direção testada é a que dá para exercer pela API: o código emitido para
    a troca não é aceito pelo `/auth/verify-email`. A direção inversa não é
    encenável por aqui — o código de verificação do cadastro já foi consumido
    para a conta poder entrar, e um teste com token gasto passaria pelo motivo
    errado (usado, não propósito trocado).
    """
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()
    _pedir(client, token, novo)
    codigo = _codigo(emails, novo)

    resp = client.post("/auth/verify-email", json={"email": antigo, "code": codigo})

    assert resp.status_code == 400
    # E o token da troca continua vivo: a tentativa no propósito errado nem o
    # encontra, então não gasta tentativa dele.
    assert _confirmar(client, token, codigo).status_code == 204


def test_confirmar_sem_pedido_nao_faz_nada(client: TestClient):
    antigo = _conta(client)
    token = _token_de(client, antigo)

    assert _confirmar(client, token, "123456").status_code == 400
    assert client.post(
        "/auth/login", json={"email": antigo, "password": SENHA}
    ).status_code == 200


def test_endereco_tomado_entre_o_pedido_e_a_confirmacao(
    client: TestClient, emails: EmailRecorder
):
    """Dez minutos é tempo de alguém cadastrar o endereço pretendido."""
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()
    _pedir(client, token, novo)
    codigo = _codigo(emails, novo)

    # Alguém cria a conta com o endereço pretendido antes da confirmação.
    _conta(client, novo)

    resp = _confirmar(client, token, codigo)

    assert resp.status_code == 409
    assert client.post(
        "/auth/login", json={"email": antigo, "password": SENHA}
    ).status_code == 200


def test_cooldown_impede_reenvio_imediato(client: TestClient, emails: EmailRecorder):
    """Mesmo cooldown do reenvio de verificação, e pelo mesmo motivo: mora no
    banco, então vale com N réplicas — e impede usar a rota para inundar a
    caixa de entrada de terceiros."""
    antigo = _conta(client)
    token = _token_de(client, antigo)
    novo = _email()

    _pedir(client, token, novo)
    outro_novo = _email()
    segundo = _pedir(client, token, outro_novo)

    assert segundo.status_code == 202  # resposta uniforme, mesmo sem enviar
    assert emails.para(outro_novo) == []
