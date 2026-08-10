"""Recuperação de senha (ADR-0044 + 1ª e 2ª emendas).

O que estes testes protegem:

1. **as duas formas do mesmo segredo** — código digitado e token do link levam
   ao mesmo lugar, e usar uma queima a outra;
2. **anti-enumeração** — nem o pedido nem a recusa distinguem "e-mail existe";
3. **a semântica do ato** — redefinir derruba as sessões, vale como prova de
   posse do endereço, e não emite sessão nova.

Contas, códigos e senhas são 100% sintéticos (CLAUDE.md).
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from app.api.deps import reset_login_limiter
from app.config import get_settings
from app.db.session import get_session
from app.emails import ASSUNTO_RECUPERACAO
from app.main import app
from app.models import SingleUseToken, SingleUseTokenPurpose, User
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .conftest import SENHA, SENHA_NOVA, EmailRecorder, codigo_de_verificacao


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


def _registrar(client: TestClient, email: str):
    return client.post(
        "/auth/register",
        json={"email": email, "password": SENHA, "role": "patient", "display_name": "F"},
    )


def _entrar(client: TestClient, email: str, senha: str):
    return client.post(
        "/auth/login", json={"email": email, "password": senha, "client": "mobile"}
    )


def _verificar(client: TestClient, email: str) -> None:
    """Confirma a posse do e-mail pelo código que o cadastro emitiu.

    Preciso só onde o teste vai **entrar** na conta: com o gate ligado (P11-c),
    conta não verificada não faz login. Onde o assunto é a recuperação em si, a
    conta segue não verificada de propósito — redefinir a senha vale como prova
    de posse do endereço (2ª emenda à ADR-0044).
    """
    resp = client.post(
        "/auth/verify-email",
        json={"email": email, "code": codigo_de_verificacao(email)},
    )
    assert resp.status_code == 204, resp.text


def _mensagem_de_recuperacao(emails: EmailRecorder, email: str) -> str:
    mensagens = [e for e in emails.para(email) if e["subject"] == ASSUNTO_RECUPERACAO]
    assert mensagens, f"nenhum e-mail de recuperação para {email}"
    return mensagens[-1]["body"]


def _codigo(emails: EmailRecorder, email: str) -> str:
    achado = re.search(r"Seu código é: (\d{6})", _mensagem_de_recuperacao(emails, email))
    assert achado, "o e-mail não traz o código de 6 dígitos"
    return achado.group(1)


def _token_do_link(emails: EmailRecorder, email: str) -> str:
    achado = re.search(r"reset-password\?token=(\S+)", _mensagem_de_recuperacao(emails, email))
    assert achado, "o e-mail não traz o link com o token"
    return achado.group(1)


def _pedir(client: TestClient, email: str):
    return client.post("/auth/forgot-password", json={"email": email})


def _conta_pronta(client: TestClient, emails: EmailRecorder) -> str:
    """Conta sintética com um pedido de recuperação já feito."""
    email = _email()
    _registrar(client, email)
    _pedir(client, email)
    return email


# -- pedido --------------------------------------------------------------


def test_pedido_manda_link_e_codigo(client: TestClient, emails: EmailRecorder):
    """O design oferece os dois na mesma tela — o e-mail precisa trazer os dois."""
    email = _conta_pronta(client, emails)

    assert len(_codigo(emails, email)) == 6
    assert _token_do_link(emails, email)


def test_pedido_para_email_sem_conta_responde_igual(
    client: TestClient, emails: EmailRecorder
):
    inexistente = _email()
    existente = _conta_pronta(client, emails)

    resp_inexistente = _pedir(client, inexistente)

    assert resp_inexistente.status_code == 202
    assert resp_inexistente.json() == {"detail": "se houver conta, o codigo foi enviado"}
    assert emails.para(inexistente) == []
    assert _mensagem_de_recuperacao(emails, existente)  # a de verdade saiu


def test_pedido_respeita_o_cooldown(client: TestClient, emails: EmailRecorder):
    email = _conta_pronta(client, emails)
    antes = len(emails.para(email))

    resp = _pedir(client, email)

    assert resp.status_code == 202  # a resposta não denuncia o cooldown
    assert len(emails.para(email)) == antes


def test_pedido_tem_rate_limit_por_ip(client: TestClient):
    limite = get_settings().register_rate_limit_attempts

    codigos = [_pedir(client, _email()).status_code for _ in range(limite + 1)]

    assert codigos[-1] == 429


# -- redefinição pelas duas formas ---------------------------------------


def test_redefine_pelo_codigo(client: TestClient, emails: EmailRecorder):
    email = _conta_pronta(client, emails)

    resp = client.post(
        "/auth/reset-password",
        json={"email": email, "code": _codigo(emails, email), "new_password": SENHA_NOVA},
    )

    assert resp.status_code == 204
    assert _entrar(client, email, SENHA_NOVA).status_code == 200
    assert _entrar(client, email, SENHA).status_code == 401


def test_redefine_pelo_token_do_link(client: TestClient, emails: EmailRecorder):
    """O link não carrega o endereço — o token identifica a conta sozinho."""
    email = _conta_pronta(client, emails)

    resp = client.post(
        "/auth/reset-password",
        json={"token": _token_do_link(emails, email), "new_password": SENHA_NOVA},
    )

    assert resp.status_code == 204
    assert _entrar(client, email, SENHA_NOVA).status_code == 200


def test_redefinicao_recusa_senha_sem_digito(client: TestClient, emails: EmailRecorder):
    """A terceira porta de escrita de senha usa a mesma régua das outras duas.

    Importa que o 422 chegue **antes** de gastar o segredo: reprovar a senha e
    queimar o código junto obrigaria a pessoa a pedir outro por ter digitado
    uma senha fraca.
    """
    email = _conta_pronta(client, emails)
    codigo = _codigo(emails, email)

    resp = client.post(
        "/auth/reset-password",
        json={"email": email, "code": codigo, "new_password": "senha-nova-sem-digito"},
    )

    assert resp.status_code == 422
    # O código continua valendo — só a senha foi recusada.
    segunda = client.post(
        "/auth/reset-password",
        json={"email": email, "code": codigo, "new_password": SENHA_NOVA},
    )
    assert segunda.status_code == 204


def test_usar_uma_forma_queima_a_outra(client: TestClient, emails: EmailRecorder):
    """É um segredo só, em duas formas — não dois segredos."""
    email = _conta_pronta(client, emails)
    codigo = _codigo(emails, email)
    token = _token_do_link(emails, email)
    client.post(
        "/auth/reset-password",
        json={"email": email, "code": codigo, "new_password": SENHA_NOVA},
    )

    resp = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "terceira-senha-bem-longa-9"},
    )

    assert resp.status_code == 400


def test_codigo_de_verificacao_nao_serve_para_redefinir(
    client: TestClient, emails: EmailRecorder
):
    """Propósitos não se cruzam (ADR-0044, item 6) — aqui vale o inverso do
    teste da fatia 5."""
    from app.emails import ASSUNTO_VERIFICACAO

    email = _email()
    _registrar(client, email)
    verificacao = [e for e in emails.para(email) if e["subject"] == ASSUNTO_VERIFICACAO][-1]
    codigo_de_verificacao = re.search(r"\b(\d{6})\b", verificacao["body"]).group(1)

    resp = client.post(
        "/auth/reset-password",
        json={"email": email, "code": codigo_de_verificacao, "new_password": SENHA_NOVA},
    )

    assert resp.status_code == 400
    # A senha continua a original — e o código de verificação sequer foi
    # tocado: ele segue valendo para o propósito dele.
    _verificar(client, email)
    assert _entrar(client, email, SENHA).status_code == 200


# -- recusas -------------------------------------------------------------


def test_codigo_errado_e_email_inexistente_respondem_igual(
    client: TestClient, emails: EmailRecorder
):
    email = _conta_pronta(client, emails)

    errado = client.post(
        "/auth/reset-password",
        json={"email": email, "code": "000000", "new_password": SENHA_NOVA},
    )
    inexistente = client.post(
        "/auth/reset-password",
        json={"email": _email(), "code": "000000", "new_password": SENHA_NOVA},
    )

    assert errado.status_code == inexistente.status_code == 400
    assert errado.json() == inexistente.json()


def test_codigo_expirado_nao_redefine(
    client: TestClient, db_session: Session, emails: EmailRecorder
):
    email = _conta_pronta(client, emails)
    codigo = _codigo(emails, email)
    # Filtra pelo PROPÓSITO: o cadastro também emitiu um token (verificação), e
    # o `now()` do Postgres é por transação — os dois têm o mesmo `created_at`,
    # então ordenar por data não desempata.
    token = db_session.scalars(
        select(SingleUseToken).where(
            SingleUseToken.purpose == SingleUseTokenPurpose.PASSWORD_RESET
        )
    ).one()
    token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.flush()

    resp = client.post(
        "/auth/reset-password",
        json={"email": email, "code": codigo, "new_password": SENHA_NOVA},
    )

    assert resp.status_code == 400
    _verificar(client, email)  # só para poder entrar e provar a senha intacta
    assert _entrar(client, email, SENHA).status_code == 200


def test_senha_nova_igual_a_atual_e_recusada(client: TestClient, emails: EmailRecorder):
    """O mockup promete "uma senha que você ainda não usou"; sem histórico de
    hashes, o que dá para garantir é "diferente da atual" (2ª emenda)."""
    email = _conta_pronta(client, emails)

    resp = client.post(
        "/auth/reset-password",
        json={"email": email, "code": _codigo(emails, email), "new_password": SENHA},
    )

    assert resp.status_code == 400
    assert "diferente da atual" in resp.json()["detail"]


def test_exige_uma_forma_e_nao_as_duas(client: TestClient, emails: EmailRecorder):
    email = _conta_pronta(client, emails)

    nenhuma = client.post("/auth/reset-password", json={"new_password": SENHA_NOVA})
    ambas = client.post(
        "/auth/reset-password",
        json={
            "email": email,
            "code": _codigo(emails, email),
            "token": _token_do_link(emails, email),
            "new_password": SENHA_NOVA,
        },
    )

    assert nenhuma.status_code == 422
    assert ambas.status_code == 422


# -- semântica do ato (2ª emenda) ----------------------------------------


def test_redefinir_derruba_as_sessoes_antigas(client: TestClient, emails: EmailRecorder):
    """Recuperar senha é o gesto de quem perdeu o controle da conta."""
    email = _conta_pronta(client, emails)
    _verificar(client, email)  # sem isto não há sessão antiga para derrubar
    antigo = _entrar(client, email, SENHA).json()["access_token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {antigo}"}).status_code == 200

    client.post(
        "/auth/reset-password",
        json={"email": email, "code": _codigo(emails, email), "new_password": SENHA_NOVA},
    )

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {antigo}"})
    assert resp.status_code == 401


def test_redefinir_vale_como_prova_de_posse_do_email(
    client: TestClient, db_session: Session, emails: EmailRecorder
):
    """Sem isto, com o gate ligado, quem recupera a senha continuaria sem
    entrar — um beco sem saída criado por nós."""
    email = _conta_pronta(client, emails)
    user = db_session.scalars(select(User).where(User.email == email)).one()
    assert user.email_verified_at is None  # cadastro novo, ainda não verificado

    client.post(
        "/auth/reset-password",
        json={"email": email, "code": _codigo(emails, email), "new_password": SENHA_NOVA},
    )

    db_session.refresh(user)
    assert user.email_verified_at is not None


def test_redefinir_nao_devolve_sessao(client: TestClient, emails: EmailRecorder):
    """O design manda de volta para o login: "Entre com a sua nova senha"."""
    email = _conta_pronta(client, emails)

    resp = client.post(
        "/auth/reset-password",
        json={"email": email, "code": _codigo(emails, email), "new_password": SENHA_NOVA},
    )

    assert resp.status_code == 204
    assert resp.content == b""
