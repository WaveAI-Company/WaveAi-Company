"""Cifragem em repouso do Result (ADR-0026)."""

import pytest
from cryptography.fernet import Fernet
from pydantic import ValidationError

from app.config import Settings
from app.security.crypto import MetricsCipher

CHAVE = Fernet.generate_key().decode()
VALIDO = "x" * 32  # placeholder para completar o Settings de teste


def _settings(chave: str) -> Settings:
    return Settings(result_encryption_key=chave, jwt_secret="j" * 40, _env_file=None)


def test_cifra_e_decifra_o_dict():
    cipher = MetricsCipher(CHAVE)
    metrics = {"rel_alpha": 0.42, "bandas": {"alpha": 0.42}, "engine_version": "v/1"}

    blob = cipher.encrypt(metrics)
    assert cipher.decrypt(blob) == metrics


def test_o_blob_nao_contem_o_conteudo_em_claro():
    cipher = MetricsCipher(CHAVE)
    blob = cipher.encrypt({"rel_alpha": 0.42, "segredo": "conteudo-sensivel"})

    assert b"conteudo-sensivel" not in blob
    assert b"rel_alpha" not in blob


def test_chave_diferente_nao_decifra():
    outra = MetricsCipher(Fernet.generate_key().decode())
    blob = MetricsCipher(CHAVE).encrypt({"a": 1})

    with pytest.raises(ValueError):
        outra.decrypt(blob)


def test_chave_ausente_impede_carregar(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("WAVEAI_API_RESULT_ENCRYPTION_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(jwt_secret="j" * 40, _env_file=None)


@pytest.mark.parametrize("chave", ["", "curta", "nao-e-fernet-valido"])
def test_chave_invalida_e_rejeitada(chave: str):
    with pytest.raises(ValidationError):
        _settings(chave)


def test_chave_valida_e_aceita():
    assert _settings(CHAVE).result_encryption_key == CHAVE
