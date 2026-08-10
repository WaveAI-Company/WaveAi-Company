"""Anotações de contexto de sessão (ADR-0037).

Só dados sintéticos (CLAUDE.md): notas inventadas, nunca contexto real de
ninguém. Protege: cifra em repouso, uma nota por sessão (upsert), quem escreve
vs quem lê, CareLink + auditoria dedicada, e export/erasure.
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
from app.models import (
    AnnotationAccessAction,
    AnnotationAccessEvent,
    CaptureSession,
    SessionAnnotation,
    SessionStatus,
    User,
    UserRole,
)

from .conftest import registrar_conta

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


def _user(db_session: Session, email: str) -> User:
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    return UserRepository(db_session, hasher).get_by_email(email)


def _sessao(db_session: Session, patient: User) -> CaptureSession:
    sessao = CaptureSession(
        patient_user_id=patient.id, device="simulador", sample_rate=512,
        status=SessionStatus.COMPLETED,
    )
    db_session.add(sessao)
    db_session.flush()
    return sessao


class Ator:
    """Cliente autenticado (paciente ou profissional)."""

    def __init__(self, client: TestClient, *, role: str = "patient") -> None:
        self._client = client
        self.email = _email()
        registrar_conta(
            client, email=self.email, senha=SENHA, role=role, display_name="Sint"
        )
        self.token = client.post(
            "/auth/login", json={"email": self.email, "password": SENHA, "client": "mobile"}
        ).json()["access_token"]

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, url):
        return self._client.get(url, headers=self.headers)

    def put(self, url, json):
        return self._client.put(url, json=json, headers=self.headers)

    def post(self, url, json=None):
        return self._client.post(url, json=json or {}, headers=self.headers)

    def delete(self, url):
        return self._client.delete(url, headers=self.headers)


# -- escrita e leitura pelo titular -------------------------------------


def test_titular_cria_e_le_a_propria_nota(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()

    posto = p.put(f"/sessions/{sessao.id}/annotation", {"note": "Depois de meditar 10 min."})
    assert posto.status_code == 200
    assert posto.json()["note"] == "Depois de meditar 10 min."

    lido = p.get(f"/sessions/{sessao.id}/annotation")
    assert lido.status_code == 200
    assert lido.json()["annotation"]["note"] == "Depois de meditar 10 min."


def test_nota_fica_cifrada_em_repouso(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()
    segredo = "cafe e noite mal dormida"

    p.put(f"/sessions/{sessao.id}/annotation", {"note": segredo})

    bruto = db_session.execute(
        select(SessionAnnotation.note_encrypted).where(
            SessionAnnotation.session_id == sessao.id
        )
    ).scalar_one()
    assert segredo.encode("utf-8") not in bruto


def test_upsert_edita_sem_duplicar(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()

    p.put(f"/sessions/{sessao.id}/annotation", {"note": "primeira"})
    p.put(f"/sessions/{sessao.id}/annotation", {"note": "segunda"})

    notas = db_session.scalars(
        select(SessionAnnotation).where(SessionAnnotation.session_id == sessao.id)
    ).all()
    assert len(notas) == 1  # uma nota por sessão
    assert p.get(f"/sessions/{sessao.id}/annotation").json()["annotation"]["note"] == "segunda"


def test_sessao_sem_nota_devolve_null(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()

    resp = p.get(f"/sessions/{sessao.id}/annotation")
    assert resp.status_code == 200
    assert resp.json()["annotation"] is None


def test_titular_apaga_a_propria_nota(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()
    p.put(f"/sessions/{sessao.id}/annotation", {"note": "algo"})

    resp = p.delete(f"/sessions/{sessao.id}/annotation")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    assert p.get(f"/sessions/{sessao.id}/annotation").json()["annotation"] is None


def test_nao_anota_sessao_de_outro(client: TestClient, db_session: Session):
    """Anotar sessão que não é sua → 404 (não revela existência de terceiros)."""
    dono = Ator(client)
    intruso = Ator(client)
    sessao = _sessao(db_session, _user(db_session, dono.email))
    db_session.commit()

    resp = intruso.put(f"/sessions/{sessao.id}/annotation", {"note": "xereta"})
    assert resp.status_code == 404
    # E nada foi gravado.
    assert db_session.scalars(select(SessionAnnotation)).all() == []


def test_nota_vazia_e_recusada(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()

    assert p.put(f"/sessions/{sessao.id}/annotation", {"note": ""}).status_code == 422


def test_rotas_de_anotacao_exigem_autenticacao(client: TestClient):
    sid = uuid.uuid4()
    assert client.get(f"/sessions/{sid}/annotation").status_code == 401
    assert client.put(f"/sessions/{sid}/annotation", json={"note": "x"}).status_code == 401
    assert client.delete(f"/sessions/{sid}/annotation").status_code == 401


# -- leitura pelo profissional (RBAC + CareLink + auditoria) ------------


def _vincular(client: TestClient, paciente: Ator, db_session: Session) -> tuple[Ator, uuid.UUID]:
    """Cria um profissional e um CareLink ATIVO (o paciente convida). Devolve
    (profissional, patient_id)."""
    profissional = Ator(client, role="doctor")
    pid = _user(db_session, paciente.email).id
    paciente.post("/care-links", {"email": profissional.email})  # convite → active
    return profissional, pid


def test_profissional_le_nota_so_com_vinculo(client: TestClient, db_session: Session):
    paciente = Ator(client)
    sessao = _sessao(db_session, _user(db_session, paciente.email))
    db_session.commit()
    paciente.put(f"/sessions/{sessao.id}/annotation", {"note": "contexto do dia"})

    profissional = Ator(client, role="doctor")
    pid = _user(db_session, paciente.email).id
    url = f"/patients/{pid}/sessions/{sessao.id}/annotation"

    # Sem vínculo: 403.
    assert profissional.get(url).status_code == 403

    # Com vínculo ativo: lê (read-only).
    paciente.post("/care-links", {"email": profissional.email})
    resp = profissional.get(url)
    assert resp.status_code == 200
    assert resp.json()["annotation"]["note"] == "contexto do dia"


def test_profissional_nao_le_sessao_de_outro_paciente(client: TestClient, db_session: Session):
    """Sessão que não é do paciente vinculado → 404, mesmo com CareLink."""
    paciente = Ator(client)
    outro = Ator(client)
    sessao_do_outro = _sessao(db_session, _user(db_session, outro.email))
    db_session.commit()
    profissional, pid = _vincular(client, paciente, db_session)

    resp = profissional.get(f"/patients/{pid}/sessions/{sessao_do_outro.id}/annotation")
    assert resp.status_code == 404


def test_leitura_do_profissional_e_auditada(client: TestClient, db_session: Session):
    paciente = Ator(client)
    sessao = _sessao(db_session, _user(db_session, paciente.email))
    db_session.commit()
    paciente.put(f"/sessions/{sessao.id}/annotation", {"note": "x"})
    profissional, pid = _vincular(client, paciente, db_session)

    profissional.get(f"/patients/{pid}/sessions/{sessao.id}/annotation")

    eventos = db_session.scalars(
        select(AnnotationAccessEvent).where(AnnotationAccessEvent.patient_user_id == pid)
    ).all()
    acoes = [e.action for e in eventos]
    assert AnnotationAccessAction.CREATED in acoes  # o titular criou
    assert AnnotationAccessAction.READ in acoes     # o profissional leu
    # A leitura foi em nome do titular, mas pelo ator profissional.
    leitura = next(e for e in eventos if e.action == AnnotationAccessAction.READ)
    assert leitura.actor_user_id != pid


# -- export / erasure incluem as notas (ADR-0037) -----------------------


def test_export_inclui_as_notas(client: TestClient, db_session: Session):
    p = Ator(client)
    assert p.post("/me/consent").status_code == 204
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()
    p.put(f"/sessions/{sessao.id}/annotation", {"note": "nota exportável"})

    export = p.get("/me/results/export").json()
    assert any(a["note"] == "nota exportável" for a in export["annotations"])


def test_erasure_apaga_as_notas(client: TestClient, db_session: Session):
    p = Ator(client)
    sessao = _sessao(db_session, _user(db_session, p.email))
    db_session.commit()
    p.put(f"/sessions/{sessao.id}/annotation", {"note": "some junto"})

    resp = p.delete("/me/results")
    assert resp.status_code == 200
    assert resp.json()["annotations_deleted"] == 1
    assert p.get(f"/sessions/{sessao.id}/annotation").json()["annotation"] is None
