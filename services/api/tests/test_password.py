"""Testes do hashing de senha (ADR-0020: Argon2id)."""

from app.config import Settings
from app.security.password import Argon2PasswordHasher, PasswordHasher, get_password_hasher

SENHA = "uma-senha-bem-longa-e-aleatoria"


def test_implementacao_respeita_o_contrato():
    assert isinstance(get_password_hasher(), PasswordHasher)


def test_hash_nunca_contem_a_senha(hasher: PasswordHasher):
    resultado = hasher.hash(SENHA)
    assert SENHA not in resultado
    assert resultado.startswith("$argon2id$")


def test_hash_e_salgado(hasher: PasswordHasher):
    # Mesma senha, hashes diferentes: o salt é aleatório por hash.
    assert hasher.hash(SENHA) != hasher.hash(SENHA)


def test_verify_aceita_a_senha_correta(hasher: PasswordHasher):
    assert hasher.verify(hasher.hash(SENHA), SENHA) is True


def test_verify_recusa_a_senha_errada(hasher: PasswordHasher):
    assert hasher.verify(hasher.hash(SENHA), "senha-errada") is False


def test_verify_nao_levanta_com_hash_invalido(hasher: PasswordHasher):
    # Hash corrompido/desconhecido deve virar "não confere", nunca exceção.
    assert hasher.verify("nao-e-um-hash", SENHA) is False


def test_needs_rehash_falso_com_os_mesmos_parametros(hasher: PasswordHasher):
    assert hasher.needs_rehash(hasher.hash(SENHA)) is False


def test_needs_rehash_verdadeiro_quando_os_parametros_endurecem():
    fraco = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    forte = Argon2PasswordHasher(memory_cost=64, time_cost=3, parallelism=1)
    assert forte.needs_rehash(fraco.hash(SENHA)) is True


def test_needs_rehash_verdadeiro_para_hash_ilegivel(hasher: PasswordHasher):
    assert hasher.needs_rehash("formato-antigo-desconhecido") is True


def test_defaults_seguem_o_owasp():
    # ADR-0020: mínimos m=19 MiB (19456 KiB), t=2, p=1.
    settings = Settings()
    assert settings.argon2_memory_cost == 19456
    assert settings.argon2_time_cost == 2
    assert settings.argon2_parallelism == 1
