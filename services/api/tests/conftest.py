"""Fixtures dos testes.

Os testes de persistência rodam contra **PostgreSQL real** (não SQLite): o
esquema usa tipos específicos do Postgres (enum nativo, UUID, `timestamptz`) e
testar noutro motor daria falsa confiança. O schema é criado **pelas próprias
migrations**, então o aceite "a migration cria as tabelas" é testado de fato.

Sem banco acessível os testes de DB são pulados — exceto quando
`WAVEAI_TEST_REQUIRE_DB=1` (usado no CI), aí a ausência vira **falha**. Isso
impede que o CI fique "verde por omissão".
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator

# Segredo de teste **explícito** (ADR-0023: não existe default em lugar nenhum;
# o que muda por ambiente é a origem do segredo, nunca a exigência). Definido
# antes de importar `app.*`, que valida a config no carregamento.
os.environ.setdefault("WAVEAI_API_JWT_SECRET", "segredo-de-teste-" + "0" * 40)
# Chave Fernet de teste (ADR-0026). Descartável e explícita, como o JWT.
os.environ.setdefault(
    "WAVEAI_API_RESULT_ENCRYPTION_KEY", "sRzpGGMSAff35dzYCgpeXTyI2rMfVLkVtN_nu5bhwTE="
)
# Os testes de integração exercem o cookie **de produção** (Secure), como a
# fixture https assume. O default de `Secure` passou a seguir o ambiente
# (dev→false), então fixamos aqui — o comportamento por ambiente é coberto,
# isolado, em test_config_secret.py (que faz `delenv` explícito).
os.environ.setdefault("WAVEAI_API_REFRESH_COOKIE_SECURE", "true")

import pytest
from alembic import command
from alembic.config import Config
from app.config import get_settings
from app.security.password import Argon2PasswordHasher, PasswordHasher
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

#: Senha sintética única da suíte (CLAUDE.md: nunca senha de pessoa real).
#: Mora AQUI, e não copiada em cada módulo, porque ela precisa satisfazer os
#: requisitos que a API cobra — quando a regra muda, muda num lugar só. Tem
#: dígito de propósito: sem ele, esta senha é recusada pelo `/auth/register`.
SENHA = "senha-de-teste-bem-longa-7"

#: Segunda senha sintética, para os fluxos que exigem "diferente da atual".
SENHA_NOVA = "outra-senha-de-teste-bem-longa-8"


def _require_db() -> bool:
    return os.getenv("WAVEAI_TEST_REQUIRE_DB", "").strip() in {"1", "true", "yes"}


@pytest.fixture(scope="session")
def db_engine() -> Iterator[Engine]:
    """Engine de teste com o schema aplicado pelas migrations."""
    # `connect_timeout` curto: sem ele, a sonda pode ficar minutos pendurada
    # quando não há banco — a suíte deve pular (ou falhar) rápido.
    engine = create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 3},
    )
    try:
        with engine.connect():
            pass
    except OperationalError as exc:
        engine.dispose()
        message = f"PostgreSQL indisponivel para os testes de banco: {exc}"
        if _require_db():
            pytest.fail(message, pytrace=False)
        pytest.skip(message, allow_module_level=True)

    config = Config("alembic.ini")
    command.upgrade(config, "head")

    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine: Engine) -> Iterator[Session]:
    """Sessão isolada: tudo o que o teste escrever é desfeito no fim."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="session")
def hasher() -> PasswordHasher:
    """Hasher com parâmetros reduzidos: testes rápidos, comportamento idêntico."""
    return Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)


# -- envio de e-mail (ADR-0044) ------------------------------------------


class EmailRecorder:
    """Duplo do `EmailSender`: guarda o que teria sido enviado.

    Autouse para toda a suíte por dois motivos: o adapter de console imprimiria
    um e-mail a cada cadastro (a suíte inteira registra usuários), e os testes
    dos fluxos precisam ler o código sem depender de stdout.
    """

    def __init__(self) -> None:
        self.enviados: list[dict[str, str | None]] = []

    def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        self.enviados.append({"to": to, "subject": subject, "body": body, "html": html})

    def para(self, email: str) -> list[dict[str, str | None]]:
        return [e for e in self.enviados if e["to"] == email]


@pytest.fixture(autouse=True)
def emails() -> Iterator[EmailRecorder]:
    from app.api.deps import get_email_sender
    from app.main import app

    gravador = EmailRecorder()
    app.dependency_overrides[get_email_sender] = lambda: gravador
    yield gravador
    app.dependency_overrides.pop(get_email_sender, None)


def gravador_de_emails() -> EmailRecorder:
    """O `EmailRecorder` deste teste, sem passar pela fixture.

    A fixture `emails` é autouse, então ele sempre existe. Buscá-lo pelo
    override deixa os helpers abaixo utilizáveis de dentro dos `Ator` da suíte,
    que recebem só o `client`.
    """
    from app.api.deps import get_email_sender
    from app.main import app

    gravador = app.dependency_overrides[get_email_sender]()
    assert isinstance(gravador, EmailRecorder)
    return gravador


def codigo_de_verificacao(email: str) -> str:
    """Lê o código de 6 dígitos do último e-mail de verificação do endereço."""
    from app.emails import ASSUNTO_VERIFICACAO

    mensagens = [
        e for e in gravador_de_emails().para(email) if e["subject"] == ASSUNTO_VERIFICACAO
    ]
    assert mensagens, f"nenhum e-mail de verificação para {email}"
    achado = re.search(r"\b(\d{6})\b", mensagens[-1]["body"])
    assert achado, "o e-mail de verificação não traz um código de 6 dígitos"
    return achado.group(1)


def registrar_conta(
    client,
    *,
    email: str,
    senha: str,
    role: str = "patient",
    display_name: str = "Ficticio",
) -> None:
    """Cria a conta **e confirma a posse do e-mail**, como o app faz.

    Desde a P11-c o gate `email_verification_required` nasce ligado, então sem
    este segundo passo o login desta suíte responderia 403.

    Verifica pelo **código de verdade**, extraído do e-mail, em vez de escrever
    `email_verified_at` direto no banco: um atalho aqui deixaria a suíte inteira
    passando por um caminho que o produto não tem — o mesmo erro do duplo mais
    permissivo que o serviço real.
    """
    resposta = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": senha,
            "role": role,
            "display_name": display_name,
        },
    )
    assert resposta.status_code == 202, resposta.text

    confirmacao = client.post(
        "/auth/verify-email",
        json={"email": email, "code": codigo_de_verificacao(email)},
    )
    assert confirmacao.status_code == 204, confirmacao.text
