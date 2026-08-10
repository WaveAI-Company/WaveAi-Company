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

from app.api.deps import get_analysis_client, reset_login_limiter
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

from .conftest import registrar_conta

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


def test_persiste_device_e_montagem_em_claro(db_session: Session):
    """ADR-0033: proveniência (device + montagem) fica EM CLARO no Result."""
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    sessao = _sessao(db_session, paciente)
    metrics = {**METRICS_FALSAS, "device": "mindwave-mobile-2", "montage": ["FP1"]}

    result = service.persistir(patient=paciente, session_id=sessao.id, metrics=metrics)

    assert result is not None
    # Colunas em claro (consultáveis, ao lado de engine_version).
    persistido = db_session.execute(
        select(Result.device, Result.montage).where(Result.id == result.id)
    ).one()
    assert persistido.device == "mindwave-mobile-2"
    assert persistido.montage == "FP1"  # lista serializada por vírgula


def test_serie_longitudinal_cronologica_com_qualidade(db_session: Session):
    """N5: série (mais antiga → mais recente) de features + qualidade; audita leitura."""
    from datetime import UTC, datetime, timedelta

    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    base = datetime(2026, 1, 1, tzinfo=UTC)

    def _seed(alpha: float, score: float, quando: datetime):
        metrics = {
            **METRICS_FALSAS,
            "features": {"rel_alpha": alpha},
            "quality": {"score": score},
        }
        r = service.persistir(
            patient=paciente, session_id=_sessao(db_session, paciente).id, metrics=metrics
        )
        r.created_at = quando
        db_session.flush()

    # Inseridos fora de ordem cronológica de propósito.
    _seed(0.30, 0.8, base + timedelta(minutes=1))
    _seed(0.40, 0.7, base + timedelta(minutes=2))
    _seed(0.20, 0.9, base)

    serie = service.serie_longitudinal(titular=paciente, ator=paciente)
    # Ordenado por tempo: 0.20 (base) → 0.30 → 0.40.
    assert serie["sessions"] == [{"rel_alpha": 0.20}, {"rel_alpha": 0.30}, {"rel_alpha": 0.40}]
    assert serie["quality_scores"] == [0.9, 0.8, 0.7]
    assert serie["period"]["first"] == base.isoformat()

    # Acesso humano aos dados derivados: audita como leitura.
    acoes = [
        e.action for e in db_session.scalars(
            select(ResultAccessEvent).where(ResultAccessEvent.patient_user_id == paciente.id)
        )
    ]
    assert ResultAccessAction.READ in acoes


def test_historico_de_features_para_baseline(db_session: Session):
    """ADR-0032: histórico do titular vem dos Result com features; sem auditar."""
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)

    # Dois Result COM features + um sem (anterior ao Catálogo N2).
    com = {**METRICS_FALSAS, "features": {"rel_alpha": 0.31, "rel_beta": 0.05}}
    service.persistir(patient=paciente, session_id=_sessao(db_session, paciente).id, metrics=com)
    service.persistir(patient=paciente, session_id=_sessao(db_session, paciente).id, metrics=com)
    sem = {k: v for k, v in METRICS_FALSAS.items()}  # sem chave "features"
    service.persistir(patient=paciente, session_id=_sessao(db_session, paciente).id, metrics=sem)

    historico = service.historico_de_features(titular=paciente)
    assert historico == [{"rel_alpha": 0.31, "rel_beta": 0.05}] * 2

    # Uso interno: NÃO gera evento de leitura (só as três criações).
    eventos = db_session.scalars(
        select(ResultAccessEvent).where(ResultAccessEvent.patient_user_id == paciente.id)
    ).all()
    assert all(e.action == ResultAccessAction.CREATED for e in eventos)


def test_metrics_sem_device_persiste_como_nulo(db_session: Session):
    """Result anterior à proveniência: device/montagem NULOS, não inventados."""
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    sessao = _sessao(db_session, paciente)

    result = service.persistir(
        patient=paciente, session_id=sessao.id, metrics=METRICS_FALSAS
    )

    assert result is not None
    assert result.device is None
    assert result.montage is None


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
        registrar_conta(client, email=self.email, senha=SENHA, display_name="Sint")
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
    registrar_conta(client, email=medico_email, senha=SENHA, role="doctor", display_name="Dr")
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


# -- relatório longitudinal (N5) ----------------------------------------


class _AnalysisReportFake:
    """Duplo da Analysis para o relatório: registra a série recebida.

    **Recusa lista vazia, como o serviço real** (`LongitudinalRequest.sessions`
    tem `min_length=1`). Um duplo mais permissivo que o original transforma o
    teste em ficção: foi assim que a janela vazia passou verde aqui e devolveu
    503 no ambiente de verdade (P11-a).
    """

    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def longitudinal_report(self, sessions, quality_scores=None):
        if not sessions:
            raise AssertionError(
                "a Analysis real recusa série vazia; o gateway não deve chamá-la"
            )
        self.calls.append((sessions, quality_scores))
        return {
            "engine_version": "fake/1.0",
            "report": {"n_sessions": len(sessions), "features": {}},
            "summary": [f"Resumo de {len(sessions)} sessões."],
            "disclaimer": "Resultado exploratório. Não-clínico e não-diagnóstico.",
        }


@pytest.fixture
def analysis_fake() -> _AnalysisReportFake:
    return _AnalysisReportFake()


@pytest.fixture
def client_report(db_session: Session, analysis_fake: _AnalysisReportFake) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_analysis_client] = lambda: analysis_fake
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def _seed_result_features(db_session: Session, email: str, alpha: float, score: float, quando) -> None:
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, hasher).get_by_email(email)
    metrics = {**METRICS_FALSAS, "features": {"rel_alpha": alpha}, "quality": {"score": score}}
    r = _service(db_session).persistir(patient=user, session_id=_sessao(db_session, user).id, metrics=metrics)
    r.created_at = quando
    db_session.commit()


def test_me_report_longitudinal(client_report, db_session: Session, analysis_fake):
    from datetime import UTC, datetime, timedelta

    base = datetime(2026, 1, 1, tzinfo=UTC)
    p = Paciente(client_report, consentiu=True)
    _seed_result_features(db_session, p.email, 0.40, 0.7, base + timedelta(minutes=1))
    _seed_result_features(db_session, p.email, 0.20, 0.9, base)  # mais antigo

    resp = p.get("/me/report/longitudinal")

    assert resp.status_code == 200
    body = resp.json()
    assert body["n_sessions"] == 2
    assert body["report"]["n_sessions"] == 2
    assert body["summary"] == ["Resumo de 2 sessões."]  # N5-c: sumário passa adiante
    # N6-b: narrativa desligada por padrão (sem chave) → None; app usa o sumário.
    assert body["narrative"] is None
    assert body["period"]["first"] == base.isoformat()
    # A Analysis recebeu a série CRONOLÓGICA (mais antiga primeiro) + qualidade.
    sessions, quality_scores = analysis_fake.calls[-1]
    assert sessions == [{"rel_alpha": 0.20}, {"rel_alpha": 0.40}]
    assert quality_scores == [0.9, 0.7]


def test_me_report_longitudinal_com_narrativa(client_report, db_session: Session):
    """N6-b: com narrador ligado, a `narrative` (prosa aterrada) acompanha o relatório."""
    from datetime import UTC, datetime

    from app.api.deps import get_narrator

    class _NarratorFake:
        def narrate(self, report, summary):
            return "Nas 2 sessões, o alfa relativo variou pouco."

    app.dependency_overrides[get_narrator] = lambda: _NarratorFake()
    try:
        p = Paciente(client_report, consentiu=True)
        _seed_result_features(db_session, p.email, 0.3, 0.8, datetime(2026, 1, 1, tzinfo=UTC))
        body = p.get("/me/report/longitudinal").json()
    finally:
        app.dependency_overrides.pop(get_narrator, None)

    assert body["narrative"] == "Nas 2 sessões, o alfa relativo variou pouco."


def test_report_longitudinal_exige_autenticacao(client_report):
    assert client_report.get("/me/report/longitudinal").status_code == 401


def test_medico_ve_relatorio_so_com_vinculo(client_report, db_session: Session):
    from datetime import UTC, datetime

    paciente = Paciente(client_report, consentiu=True)
    _seed_result_features(db_session, paciente.email, 0.3, 0.8, datetime(2026, 1, 1, tzinfo=UTC))

    medico_email = _email()
    registrar_conta(
        client_report, email=medico_email, senha=SENHA, role="doctor", display_name="Dr"
    )
    token = client_report.post(
        "/auth/login", json={"email": medico_email, "password": SENHA, "client": "mobile"}
    ).json()["access_token"]
    cab = {"Authorization": f"Bearer {token}"}

    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    pid = UserRepository(db_session, hasher).get_by_email(paciente.email).id

    # Sem vínculo ativo: 403.
    assert client_report.get(f"/patients/{pid}/report/longitudinal", headers=cab).status_code == 403
    # Com vínculo: 200.
    paciente.post("/care-links", {"email": medico_email})
    resp = client_report.get(f"/patients/{pid}/report/longitudinal", headers=cab)
    assert resp.status_code == 200
    assert resp.json()["n_sessions"] == 1


# -- recorte de período (?days=N) ---------------------------------------
#
# Contrato desta fatia (P9-b): o parâmetro só **estreita**. Ausente, tudo se
# comporta como antes — os testes acima seguem valendo como não-regressão.


def _ha_dias(n: float):
    from datetime import UTC, datetime, timedelta

    return datetime.now(UTC) - timedelta(days=n)


def _eventos_de_leitura(db_session: Session, paciente: User) -> list[ResultAccessEvent]:
    return [
        e
        for e in db_session.scalars(
            select(ResultAccessEvent).where(ResultAccessEvent.patient_user_id == paciente.id)
        )
        if e.action == ResultAccessAction.READ
    ]


def _seed_em(db_session: Session, paciente: User, alpha: float, quando) -> None:
    metrics = {**METRICS_FALSAS, "features": {"rel_alpha": alpha}, "quality": {"score": 0.8}}
    r = _service(db_session).persistir(
        patient=paciente, session_id=_sessao(db_session, paciente).id, metrics=metrics
    )
    r.created_at = quando
    db_session.flush()


def test_serie_longitudinal_recorta_pela_janela(db_session: Session):
    """A janela corta no banco: fora dela a sessão não entra na tendência."""
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    _seed_em(db_session, paciente, 0.10, _ha_dias(200))
    _seed_em(db_session, paciente, 0.20, _ha_dias(45))
    _seed_em(db_session, paciente, 0.30, _ha_dias(5))

    serie = service.serie_longitudinal(titular=paciente, ator=paciente, desde=_ha_dias(30))

    assert serie["sessions"] == [{"rel_alpha": 0.30}]
    # A auditoria conta o que foi DE FATO lido, não o histórico inteiro.
    assert [e.count for e in _eventos_de_leitura(db_session, paciente)] == [1]


def test_janela_inclui_a_borda(db_session: Session):
    """Corte é `>=`: a sessão exatamente no limite entra."""
    from datetime import timedelta

    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    corte = _ha_dias(30)
    _seed_em(db_session, paciente, 0.20, corte)
    _seed_em(db_session, paciente, 0.10, corte - timedelta(seconds=1))

    serie = service.serie_longitudinal(titular=paciente, ator=paciente, desde=corte)

    assert serie["sessions"] == [{"rel_alpha": 0.20}]


def test_janela_vazia_nao_audita_leitura(db_session: Session):
    """Sem nada dentro da janela não houve acesso a dado de titular — nada a auditar."""
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    _seed_em(db_session, paciente, 0.10, _ha_dias(90))

    serie = service.serie_longitudinal(titular=paciente, ator=paciente, desde=_ha_dias(7))

    assert serie["sessions"] == []
    assert serie["period"] is None
    assert _eventos_de_leitura(db_session, paciente) == []


def test_exportacao_ignora_qualquer_janela(db_session: Session):
    """Portabilidade é o direito a TUDO (Medical/72) — não tem recorte."""
    service = _service(db_session)
    paciente = _paciente(db_session, consentiu=True)
    _seed_em(db_session, paciente, 0.10, _ha_dias(400))
    _seed_em(db_session, paciente, 0.20, _ha_dias(1))

    assert len(service.exportar(titular=paciente)["results"]) == 2


def test_me_report_longitudinal_com_days(client_report, db_session: Session, analysis_fake):
    p = Paciente(client_report, consentiu=True)
    _seed_result_features(db_session, p.email, 0.10, 0.7, _ha_dias(120))
    _seed_result_features(db_session, p.email, 0.20, 0.8, _ha_dias(60))
    _seed_result_features(db_session, p.email, 0.30, 0.9, _ha_dias(3))

    body = p.get("/me/report/longitudinal?days=30").json()

    assert body["n_sessions"] == 1
    assert body["window_days"] == 30
    # A Analysis recebe só a janela — ela é cega a data, o corte é do gateway.
    sessions, _ = analysis_fake.calls[-1]
    assert sessions == [{"rel_alpha": 0.30}]

    # Sem o parâmetro, nada muda: histórico inteiro e `window_days` nulo.
    tudo = p.get("/me/report/longitudinal").json()
    assert tudo["n_sessions"] == 3
    assert tudo["window_days"] is None


def test_report_com_janela_vazia_responde_200(client_report, db_session: Session, analysis_fake):
    """Janela sem sessão é 200 vazio, não 404: a tela diz "nenhuma sessão neste
    período" — erro faria a tela inteira cair.

    E a Analysis **não é chamada**: ela recusa lista vazia (`min_length=1`), o
    que virava 503 "analise indisponivel" — mentira, porque o serviço está de
    pé; é que não há o que analisar. O duplo desta suíte aceitava lista vazia e
    escondeu o defeito até o smoke (P11-a).
    """
    p = Paciente(client_report, consentiu=True)
    _seed_result_features(db_session, p.email, 0.30, 0.9, _ha_dias(90))
    chamadas_antes = len(analysis_fake.calls)

    resp = p.get("/me/report/longitudinal?days=7")

    assert resp.status_code == 200
    body = resp.json()
    assert body["n_sessions"] == 0
    assert body["period"] is None
    assert body["window_days"] == 7
    assert body["report"] == {"n_sessions": 0, "features": {}}
    assert body["summary"] == []
    # Nenhum motor rodou, então não há versão a carimbar.
    assert body["engine_version"] is None
    assert len(analysis_fake.calls) == chamadas_antes


def test_conta_sem_nenhuma_sessao_nao_chama_a_analysis(client_report, analysis_fake):
    """Mesmo caminho, sem recorte: conta nova também não tem o que analisar."""
    p = Paciente(client_report, consentiu=True)

    body = p.get("/me/report/longitudinal").json()

    assert body["n_sessions"] == 0
    assert analysis_fake.calls == []


def test_me_results_recorta_pela_janela(client: TestClient, db_session: Session):
    """Minimização: quem pede 30 dias não recebe o histórico inteiro para o
    cliente esconder o resto."""
    p = Paciente(client, consentiu=True)
    _seed_result_features(db_session, p.email, 0.10, 0.7, _ha_dias(120))
    _seed_result_features(db_session, p.email, 0.30, 0.9, _ha_dias(3))

    body = p.get("/me/results?days=30").json()

    assert len(body["results"]) == 1
    assert body["window_days"] == 30
    assert len(p.get("/me/results").json()["results"]) == 2


@pytest.mark.parametrize("valor", ["0", "-1", "3651", "abc", ""])
def test_days_invalido_e_recusado(client_report, valor: str):
    p = Paciente(client_report, consentiu=True)

    assert p.get(f"/me/report/longitudinal?days={valor}").status_code == 422
    assert p.get(f"/me/results?days={valor}").status_code == 422


def test_medico_com_days_ainda_passa_pelo_vinculo(client_report, db_session: Session):
    """O gate do CareLink roda ANTES do recorte — `days` não é via de acesso."""
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    paciente = Paciente(client_report, consentiu=True)
    _seed_result_features(db_session, paciente.email, 0.10, 0.7, _ha_dias(120))
    _seed_result_features(db_session, paciente.email, 0.30, 0.9, _ha_dias(3))

    medico_email = _email()
    registrar_conta(
        client_report, email=medico_email, senha=SENHA, role="doctor", display_name="Dr"
    )
    token = client_report.post(
        "/auth/login", json={"email": medico_email, "password": SENHA, "client": "mobile"}
    ).json()["access_token"]
    cab = {"Authorization": f"Bearer {token}"}

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    pid = UserRepository(db_session, hasher).get_by_email(paciente.email).id

    # Sem vínculo: 403 mesmo com janela.
    assert client_report.get(
        f"/patients/{pid}/report/longitudinal?days=30", headers=cab
    ).status_code == 403
    assert client_report.get(f"/patients/{pid}/results?days=30", headers=cab).status_code == 403

    # Com vínculo: 200 e a janela recorta igual à do titular.
    paciente.post("/care-links", {"email": medico_email})
    relatorio = client_report.get(
        f"/patients/{pid}/report/longitudinal?days=30", headers=cab
    ).json()
    assert relatorio["n_sessions"] == 1
    assert relatorio["window_days"] == 30

    lista = client_report.get(f"/patients/{pid}/results?days=30", headers=cab).json()
    assert len(lista["results"]) == 1
    assert lista["window_days"] == 30
