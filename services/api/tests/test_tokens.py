"""Testes dos tokens (ADR-0021)."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.config import Settings
from app.security.tokens import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)

SEGREDO = "x" * 48


@pytest.fixture
def settings() -> Settings:
    return Settings(jwt_secret=SEGREDO, _env_file=None)


def _token(settings: Settings, **kwargs) -> str:
    return create_access_token(
        user_id=kwargs.pop("user_id", uuid.uuid4()),
        role=kwargs.pop("role", "patient"),
        settings=settings,
        **kwargs,
    )


def test_access_token_carrega_claims_minimas(settings: Settings):
    user_id = uuid.uuid4()
    claims = decode_access_token(_token(settings, user_id=user_id, role="doctor"), settings)

    assert claims.user_id == user_id
    assert claims.role == "doctor"
    assert claims.jti


def test_payload_nao_expoe_dado_sensivel(settings: Settings):
    # JWT é apenas base64: qualquer um lê o payload (ADR-0021).
    payload = jwt.decode(_token(settings), SEGREDO, algorithms=["HS256"])

    assert set(payload) == {"sub", "role", "typ", "jti", "iat", "exp"}
    assert "email" not in payload
    assert "password_hash" not in payload


def test_token_expirado_e_recusado(settings: Settings):
    passado = datetime.now(UTC) - timedelta(minutes=settings.access_token_ttl_minutes + 1)
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(settings, now=passado), settings)


def test_token_adulterado_e_recusado(settings: Settings):
    token = _token(settings)
    adulterado = token[:-4] + ("aaaa" if not token.endswith("aaaa") else "bbbb")
    with pytest.raises(InvalidTokenError):
        decode_access_token(adulterado, settings)


def test_token_de_outro_segredo_e_recusado(settings: Settings):
    outro = Settings(jwt_secret="y" * 48, _env_file=None)
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(outro), settings)


def test_algoritmo_none_e_recusado(settings: Settings):
    # Ataque clássico: trocar o alg para "none" e remover a assinatura.
    malicioso = jwt.encode(
        {"sub": str(uuid.uuid4()), "role": "doctor", "typ": "access", "exp": 9999999999},
        key="",
        algorithm="none",
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(malicioso, settings)


def test_token_de_outro_tipo_e_recusado(settings: Settings):
    outro_tipo = jwt.encode(
        {"sub": str(uuid.uuid4()), "role": "patient", "typ": "refresh", "exp": 9999999999},
        SEGREDO,
        algorithm="HS256",
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(outro_tipo, settings)


def test_refresh_token_e_opaco_e_aleatorio():
    a, b = generate_refresh_token(), generate_refresh_token()
    assert a != b
    assert len(a) >= 43  # ~48 bytes em base64url


def test_hash_do_refresh_e_deterministico_e_nao_reversivel():
    token = generate_refresh_token()
    assert hash_refresh_token(token) == hash_refresh_token(token)
    assert token not in hash_refresh_token(token)
    assert len(hash_refresh_token(token)) == 64
