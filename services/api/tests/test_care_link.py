"""Vínculo médico-paciente e RBAC consent-first (ADR-0024).

O que estes testes protegem: **ninguém vê os dados de um paciente sem um ato
de autorização desse paciente**. Convite pendente não basta; revogação corta na
hora; e o convite não pode revelar quem tem conta.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import CareLink, CareLinkEvent, CareLinkEventType, CareLinkStatus

SENHA = "senha-de-teste-bem-longa"


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


class Ator:
    """Um usuário logado, com atalho para chamadas autenticadas."""

    def __init__(self, client: TestClient, role: str) -> None:
        self._client = client
        self.email = _email()
        self.role = role
        resp = client.post(
            "/auth/register",
            json={
                "email": self.email,
                "password": SENHA,
                "role": role,
                "display_name": f"{role} ficticio",
            },
        )
        assert resp.status_code == 201
        self.id = resp.json()["id"]
        login = client.post(
            "/auth/login",
            json={"email": self.email, "password": SENHA, "client": "mobile"},
        )
        self.token = login.json()["access_token"]

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, url: str):
        return self._client.get(url, headers=self.headers)

    def post(self, url: str, json: dict | None = None):
        return self._client.post(url, json=json or {}, headers=self.headers)

    def convidar(self, outro: "Ator"):
        return self.post("/care-links", {"email": outro.email})

    def ver_paciente(self, paciente: "Ator"):
        return self.get(f"/patients/{paciente.id}")

    def vinculos(self) -> list[dict]:
        return self.get("/care-links").json()


@pytest.fixture
def medico(client: TestClient) -> Ator:
    return Ator(client, "doctor")


@pytest.fixture
def paciente(client: TestClient) -> Ator:
    return Ator(client, "patient")


# -- a invariante central ------------------------------------------------


def test_convite_pendente_nao_da_acesso(medico: Ator, paciente: Ator):
    """O ato do médico, sozinho, não autoriza nada."""
    medico.convidar(paciente)

    assert medico.ver_paciente(paciente).status_code == 403


def test_acesso_so_depois_do_paciente_aceitar(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo = paciente.vinculos()[0]
    assert vinculo["status"] == "pending"

    aceite = paciente.post(f"/care-links/{vinculo['id']}/accept")
    assert aceite.status_code == 200
    assert aceite.json()["status"] == "active"

    resposta = medico.ver_paciente(paciente)
    assert resposta.status_code == 200
    assert resposta.json()["display_name"] == "patient ficticio"


def test_sem_vinculo_nenhum_o_acesso_e_negado(medico: Ator, paciente: Ator):
    assert medico.ver_paciente(paciente).status_code == 403


def test_medico_nao_acessa_paciente_de_outro_medico(client: TestClient, paciente: Ator):
    medico_a, medico_b = Ator(client, "doctor"), Ator(client, "doctor")
    medico_a.convidar(paciente)
    paciente.post(f"/care-links/{paciente.vinculos()[0]['id']}/accept")

    # A tem acesso; B, que não foi autorizado, não.
    assert medico_a.ver_paciente(paciente).status_code == 200
    assert medico_b.ver_paciente(paciente).status_code == 403


# -- revogação -----------------------------------------------------------


def test_paciente_revoga_e_o_acesso_cai_na_hora(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")
    assert medico.ver_paciente(paciente).status_code == 200

    paciente.post(f"/care-links/{vinculo_id}/revoke")

    assert medico.ver_paciente(paciente).status_code == 403


def test_medico_tambem_pode_revogar(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")

    revoke = medico.post(f"/care-links/{vinculo_id}/revoke")

    assert revoke.status_code == 200
    assert revoke.json()["status"] == "revoked"
    assert medico.ver_paciente(paciente).status_code == 403


def test_re_vinculo_exige_novo_consentimento(medico: Ator, paciente: Ator):
    """Revogado não "reativa": o novo convite volta a nascer pendente."""
    medico.convidar(paciente)
    primeiro = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{primeiro}/accept")
    paciente.post(f"/care-links/{primeiro}/revoke")

    medico.convidar(paciente)

    novo = paciente.vinculos()[0]
    assert novo["id"] != primeiro
    assert novo["status"] == "pending"
    assert medico.ver_paciente(paciente).status_code == 403


def test_vinculo_revogado_nao_aparece_mais_na_lista(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    assert paciente.vinculos() == []
    assert medico.vinculos() == []


# -- quem pode fazer o quê ----------------------------------------------


def test_medico_nao_pode_aceitar_o_proprio_convite(medico: Ator, paciente: Ator):
    """Se pudesse, o consentimento do paciente seria decorativo."""
    medico.convidar(paciente)
    vinculo_id = medico.vinculos()[0]["id"]

    resposta = medico.post(f"/care-links/{vinculo_id}/accept")

    assert resposta.status_code == 404
    assert medico.ver_paciente(paciente).status_code == 403


def test_aceitar_vinculo_ja_ativo_devolve_409(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    assert paciente.post(f"/care-links/{vinculo_id}/accept").status_code == 200

    assert paciente.post(f"/care-links/{vinculo_id}/accept").status_code == 409


def test_aceitar_vinculo_revogado_devolve_409(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    assert paciente.post(f"/care-links/{vinculo_id}/accept").status_code == 409


def test_terceiro_nao_aceita_vinculo_alheio(client: TestClient, medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    intruso = Ator(client, "patient")

    assert intruso.post(f"/care-links/{vinculo_id}/accept").status_code == 404


def test_paciente_nao_usa_rota_de_medico(medico: Ator, paciente: Ator):
    # /patients/{id} exige papel de médico (403 antes mesmo do vínculo).
    assert paciente.get(f"/patients/{paciente.id}").status_code == 403


def test_rotas_de_vinculo_exigem_autenticacao(client: TestClient):
    assert client.get("/care-links").status_code == 401
    assert client.post("/care-links", json={"email": _email()}).status_code == 401


# -- paciente iniciando --------------------------------------------------


def test_paciente_iniciando_ja_nasce_ativo(medico: Ator, paciente: Ator):
    """O próprio ato do paciente É o consentimento (ADR-0024)."""
    paciente.convidar(medico)

    assert paciente.vinculos()[0]["status"] == "active"
    assert medico.ver_paciente(paciente).status_code == 200


def test_vinculo_exige_papeis_diferentes(client: TestClient, paciente: Ator):
    outro_paciente = Ator(client, "patient")

    paciente.convidar(outro_paciente)

    assert paciente.vinculos() == []


# -- anti-enumeração -----------------------------------------------------


def test_convite_nao_revela_se_a_conta_existe(medico: Ator, paciente: Ator):
    existente = medico.convidar(paciente)
    inexistente = medico.post("/care-links", {"email": _email()})

    assert existente.status_code == inexistente.status_code == 202
    assert existente.json() == inexistente.json()


def test_403_nao_distingue_paciente_inexistente_de_nao_autorizado(
    medico: Ator, paciente: Ator
):
    sem_autorizacao = medico.ver_paciente(paciente)
    inexistente = medico.get(f"/patients/{uuid.uuid4()}")

    assert sem_autorizacao.status_code == inexistente.status_code == 403
    assert sem_autorizacao.json() == inexistente.json()


# -- auditoria -----------------------------------------------------------


def test_consentimento_e_revogacao_ficam_auditados(
    medico: Ator, paciente: Ator, db_session: Session
):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    eventos = db_session.scalars(
        select(CareLinkEvent)
        .where(CareLinkEvent.care_link_id == uuid.UUID(vinculo_id))
        .order_by(CareLinkEvent.created_at)
    ).all()

    assert [e.event for e in eventos] == [
        CareLinkEventType.REQUESTED,
        CareLinkEventType.ACCEPTED,
        CareLinkEventType.REVOKED,
    ]
    # Quem praticou cada ato fica registrado.
    assert str(eventos[0].actor_user_id) == medico.id
    assert str(eventos[1].actor_user_id) == paciente.id
    assert str(eventos[2].actor_user_id) == paciente.id


def test_estado_do_vinculo_registra_datas_de_consentimento_e_revogacao(
    medico: Ator, paciente: Ator, db_session: Session
):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    link = db_session.get(CareLink, uuid.UUID(vinculo_id))
    assert link.status is CareLinkStatus.REVOKED
    assert link.consented_at is not None
    assert link.revoked_at is not None


def test_lista_mostra_apenas_a_contraparte(medico: Ator, paciente: Ator):
    medico.convidar(paciente)

    visao_medico = medico.vinculos()[0]
    visao_paciente = paciente.vinculos()[0]

    assert visao_medico["counterpart_user_id"] == paciente.id
    assert visao_medico["counterpart_role"] == "patient"
    assert visao_paciente["counterpart_user_id"] == medico.id
    assert visao_paciente["counterpart_role"] == "doctor"
