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
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.security.password import Argon2PasswordHasher, PasswordHasher


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
