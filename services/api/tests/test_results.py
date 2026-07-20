"""Persistência de Result, gate de consentimento e direitos do titular.

ADR-0026 / Medical/72. **Só dados sintéticos** (regra do CLAUDE.md): as métricas
aqui são inventadas, nunca vindas de captação real.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import reset_login_limiter
from app.config import get_settings
from app.db.session import get_session
from app.main import app
from app.models import (
    CaptureSession,
    Result,
    ResultAccessAction,
    ResultAccessEvent,
    SessionStatus,
    User,
    UserRole,
)
from app.security.crypto import get_metrics_cipher
from app.services.results import ConsentRequiredError, ResultService

SENHA = "senha-de-teste-bem-longa"

#: Métricas SINTÉTICAS — nunca dado real (CLAUDE.md).
METRICS_FALSAS = {
    "engine_version": "WaveEegEngine/0.1.0+wave_eeg/0.1.0",
    "rel_alpha": 0.31,
    "relative_band_powers": {"delta": 0.4, "theta": 0.2, "alpha": 0.31, "beta": 0.05, "gamma": 0.04},
    "quality": {"signal_std": 42.0, "mains_power": 1.0, "mains_power_ratio": 0.01},
}


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


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _service(db_session: Session) -> ResultService:
    settings = get_settings()
    return ResultService(
        session=db_session, settings=settings, cipher=get_metrics_cipher(settings)
    )


def _paciente(db_session: Session, *, consentiu: bool) -> User:
    """Cria um paciente sintético direto no banco (sem passar pela API)."""
    from datetime import UTC, datetime

    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, hasher).create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Sintetico"
    )
    if consentiu:
        user.consent_given_at = datetime.now(UTC)
    db_session.flush()
    return user


def _sessao(db_session: Session, patient: User) -> CaptureSession:
    sessao = CaptureSession(
        patient_user_id=patient.id, device="simulador", sample_rate=512,
        status=SessionStatus.COMPLETED,
    )
    db_session.add(sessao)
    db_session.flush()
    return sessao


# -- persistência + gate de consentimento --------------------------------


def test_persiste_result_cifrado_quando_ha_consentimento(db_session: Session):
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    sessao = _sessao(db_session, paciente)

    result = service.persistir(patient=paciente, session_id=sessao.id, metrics=METRICS_FALSAS)

    assert result is not None
    assert result.engine_version == METRICS_FALSAS["engine_version"]
    # No banco, o conteudo esta CIFRADO (nem o valor nem a chave em claro).
    bruto = db_session.execute(
        select(Result.metrics_encrypted).where(Result.id == result.id)
    ).scalar_one()
    assert b"rel_alpha" not in bruto
    assert b"0.31" not in bruto


def test_sem_consentimento_nao_persiste(db_session: Session):
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=False)
    sessao = _sessao(db_session, paciente)

    with pytest.raises(ConsentRequiredError):
        service.persistir(patient=paciente, session_id=sessao.id, metrics=METRICS_FALSAS)

    assert db_session.scalars(select(Result)).all() == []


def test_persistencia_desligada_nao_grava(db_session: Session, monkeypatch):
    from app.config import Settings

    settings = get_settings()
    monkeypatch.setattr(settings, "result_persistence_enabled", False)
    service = ResultService(
        session=db_session, settings=settings, cipher=get_metrics_cipher(settings)
    )
    paciente = _paciente(db_session, consentiu=True)
    sessao = _sessao(db_session, paciente)

    assert service.persistir(
        patient=paciente, session_id=sessao.id, metrics=METRICS_FALSAS
    ) is None
    assert db_session.scalars(select(Result)).all() == []


def test_criacao_e_auditada(db_session: Session):
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    sessao = _sessao(db_session, paciente)

    service.persistir(patient=paciente, session_id=sessao.id, metrics=METRICS_FALSAS)

    eventos = db_session.scalars(
        select(ResultAccessEvent).where(ResultAccessEvent.patient_user_id == paciente.id)
    ).all()
    assert [e.action for e in eventos] == [ResultAccessAction.CREATED]


# -- direitos do titular (via API) --------------------------------------


class Paciente:
    def __init__(self, client: TestClient, *, consentiu: bool) -> None:
        self._client = client
        self.email = _email()
        client.post(
            "/auth/register",
            json={"email": self.email, "password": SENHA, "role": "patient", "display_name": "Sint"},
        )
        self.token = client.post(
            "/auth/login", json={"email": self.email, "password": SENHA, "client": "mobile"}
        ).json()["access_token"]
        if consentiu:
            assert self.post("/me/consent").status_code == 204

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, url):
        return self._client.get(url, headers=self.headers)

    def post(self, url, json=None):
        return self._client.post(url, json=json or {}, headers=self.headers)

    def delete(self, url):
        return self._client.delete(url, headers=self.headers)


def _semear_result(db_session: Session, email: str) -> None:
    """Grava um Result sintético para o paciente de `email`."""
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, hasher).get_by_email(email)
    sessao = _sessao(db_session, user)
    _service(db_session).persistir(
        patient=user, session_id=sessao.id, metrics=METRICS_FALSAS
    )
    db_session.commit()


def test_consentimento_liga_e_desliga(client: TestClient):
    p = Paciente(client, consentiu=False)
    assert p.get("/me/consent").json()["consent_given"] is False

    assert p.post("/me/consent").status_code == 204
    assert p.get("/me/consent").json()["consent_given"] is True

    assert p.delete("/me/consent").status_code == 204
    assert p.get("/me/consent").json()["consent_given"] is False


def test_consentimento_registra_a_versao_do_termo(client: TestClient):
    from app.consent import CONSENT_TERM_VERSION

    p = Paciente(client, consentiu=False)
    # O app envia a versão que exibiu; a API registra a vigente.
    assert p.post("/me/consent", {"version": CONSENT_TERM_VERSION}).status_code == 204

    status = p.get("/me/consent").json()
    assert status["consent_version"] == CONSENT_TERM_VERSION
    assert status["current_version"] == CONSENT_TERM_VERSION

    # Revogar limpa a versão junto com a data.
    p.delete("/me/consent")
    assert p.get("/me/consent").json()["consent_version"] is None


def test_termo_desatualizado_e_recusado(client: TestClient):
    """Consentir a um texto que já mudou não é consentimento informado."""
    p = Paciente(client, consentiu=False)

    resp = p.post("/me/consent", {"version": "versao-antiga-0.0"})

    assert resp.status_code == 409
    assert p.get("/me/consent").json()["consent_given"] is False


def test_titular_acessa_os_proprios_results(client: TestClient, db_session: Session):
    p = Paciente(client, consentiu=True)
    _semear_result(db_session, p.email)

    resp = p.get("/me/results")

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    # As metricas voltam DECIFRADAS para o titular.
    assert results[0]["metrics"]["rel_alpha"] == 0.31


def test_exportacao_traz_tudo_em_formato_aberto(client: TestClient, db_session: Session):
    p = Paciente(client, consentiu=True)
    _semear_result(db_session, p.email)

    export = p.get("/me/results/export").json()

    assert export["email"] == p.email
    assert export["consent_given_at"] is not None
    assert len(export["results"]) == 1


def test_exclusao_apaga_todos_os_results(client: TestClient, db_session: Session):
    p = Paciente(client, consentiu=True)
    _semear_result(db_session, p.email)
    _semear_result(db_session, p.email)

    resp = p.delete("/me/results")

    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2
    assert p.get("/me/results").json()["results"] == []


def test_acesso_e_exclusao_ficam_auditados(client: TestClient, db_session: Session):
    p = Paciente(client, consentiu=True)
    _semear_result(db_session, p.email)

    p.get("/me/results")
    p.get("/me/results/export")
    p.delete("/me/results")

    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, hasher).get_by_email(p.email)
    acoes = [
        e.action
        for e in db_session.scalars(
            select(ResultAccessEvent)
            .where(ResultAccessEvent.patient_user_id == user.id)
            .order_by(ResultAccessEvent.created_at)
        )
    ]
    assert ResultAccessAction.CREATED in acoes
    assert ResultAccessAction.READ in acoes
    assert ResultAccessAction.EXPORTED in acoes
    assert ResultAccessAction.DELETED in acoes


def test_rotas_de_direitos_exigem_autenticacao(client: TestClient):
    assert client.get("/me/results").status_code == 401
    assert client.get("/me/results/export").status_code == 401
    assert client.delete("/me/results").status_code == 401
    assert client.post("/me/consent").status_code == 401


# -- leitura pelo médico (RBAC + CareLink) -------------------------------


def test_medico_le_results_so_com_vinculo_ativo(client: TestClient, db_session: Session):
    paciente = Paciente(client, consentiu=True)
    _semear_result(db_session, paciente.email)

    medico_email = _email()
    client.post(
        "/auth/register",
        json={"email": medico_email, "password": SENHA, "role": "doctor", "display_name": "Dr"},
    )
    medico_token = client.post(
        "/auth/login", json={"email": medico_email, "password": SENHA, "client": "mobile"}
    ).json()["access_token"]
    cabecalho = {"Authorization": f"Bearer {medico_token}"}

    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    paciente_id = UserRepository(db_session, hasher).get_by_email(paciente.email).id

    # Sem vinculo: 403.
    assert client.get(f"/patients/{paciente_id}/results", headers=cabecalho).status_code == 403

    # Paciente convida o medico -> active; agora o medico le.
    paciente.post("/care-links", {"email": medico_email})
    resp = client.get(f"/patients/{paciente_id}/results", headers=cabecalho)
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1
