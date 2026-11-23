"""Rotação da chave do Result (emenda à ADR-0026).

O que estes testes protegem: trocar a chave **não pode** tornar ilegível o que
já foi gravado — e, depois do script, a chave velha precisa poder sair do
ambiente sem deixar nenhum Result para trás.
"""

from __future__ import annotations

import pytest
from app.config import Settings
from app.models import CaptureSession, SessionStatus, UserRole
from app.models.result import Result
from app.repositories.user import UserRepository
from app.security.crypto import MetricsCipher
from cryptography.fernet import Fernet
from pydantic import ValidationError
from sqlalchemy.orm import Session

from .conftest import SENHA

VELHA = Fernet.generate_key().decode()
NOVA = Fernet.generate_key().decode()
METRICAS = {"rel_alpha": 0.42, "engine_version": "fake/1.0"}


def test_chave_nova_com_a_velha_listada_le_o_que_a_velha_gravou():
    blob_antigo = MetricsCipher(VELHA).encrypt(METRICAS)
    assert MetricsCipher(NOVA, [VELHA]).decrypt(blob_antigo) == METRICAS


def test_quem_cifra_e_sempre_a_chave_atual():
    blob = MetricsCipher(NOVA, [VELHA]).encrypt(METRICAS)
    assert MetricsCipher(NOVA).decrypt(blob) == METRICAS
    with pytest.raises(ValueError):
        MetricsCipher(VELHA).decrypt(blob)


def test_rotacionar_libera_a_chave_velha():
    blob_antigo = MetricsCipher(VELHA).encrypt(METRICAS)
    rotacionado = MetricsCipher(NOVA, [VELHA]).rotate(blob_antigo)
    # Depois da rotação, só a nova basta.
    assert MetricsCipher(NOVA).decrypt(rotacionado) == METRICAS


def test_rotacionar_sem_a_chave_que_cifrou_falha_alto():
    blob_antigo = MetricsCipher(VELHA).encrypt(METRICAS)
    with pytest.raises(ValueError):
        MetricsCipher(NOVA).rotate(blob_antigo)


def test_chave_anterior_invalida_nao_sobe():
    """Fail-closed, como a chave principal: configuração errada é erro, não silêncio."""
    with pytest.raises(ValidationError):
        Settings(
            result_encryption_key=NOVA,
            result_encryption_previous_keys="nao-e-chave",
            jwt_secret="j" * 40,
            _env_file=None,
        )


def test_lista_de_chaves_anteriores_ignora_vazios():
    s = Settings(
        result_encryption_key=NOVA,
        result_encryption_previous_keys=f" {VELHA} ,, ",
        jwt_secret="j" * 40,
        _env_file=None,
    )
    assert s.result_encryption_previous_key_list == [VELHA]


def test_script_re_cifra_o_acervo(db_session: Session, hasher, monkeypatch):
    from scripts import rotate_result_key

    paciente = UserRepository(db_session, hasher).create(
        email="rotacao@example.com", password=SENHA, role=UserRole.PATIENT,
        display_name="Rotação (teste)",
    )
    sessao = CaptureSession(
        patient_user_id=paciente.id, device="simulador", sample_rate=512,
        status=SessionStatus.COMPLETED,
    )
    db_session.add(sessao)
    db_session.flush()
    result = Result(
        session_id=sessao.id,
        patient_user_id=paciente.id,
        engine_version="fake/1.0",
        metrics_encrypted=MetricsCipher(VELHA).encrypt(METRICAS),
    )
    db_session.add(result)
    db_session.flush()

    monkeypatch.setattr(
        rotate_result_key, "get_metrics_cipher", lambda: MetricsCipher(NOVA, [VELHA])
    )
    # Simular confere sem gravar: o blob segue na chave velha.
    assert rotate_result_key.rotacionar(db_session, simular=True) >= 1
    assert MetricsCipher(VELHA).decrypt(result.metrics_encrypted) == METRICAS

    assert rotate_result_key.rotacionar(db_session) >= 1
    db_session.refresh(result)
    assert MetricsCipher(NOVA).decrypt(result.metrics_encrypted) == METRICAS
