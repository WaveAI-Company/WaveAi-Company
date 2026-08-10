"""Espectador ao vivo (ADR-0039).

Só dados sintéticos (CLAUDE.md). Protege: o fan-out (LiveBus) não bloqueia a
captação; o gateway publica features/eSense/closed; o titular assiste à própria
sessão e o profissional só com CareLink ativo, com o acesso auditado.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import Iterator

import pytest
from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import (
    CaptureSession,
    LiveViewAccessEvent,
    SessionStatus,
    User,
)
from app.repositories.session import CaptureSessionRepository
from app.services.live_bus import (
    LiveBus,
    publicar_encerrada,
    publicar_janela,
    reset_live_bus,
)
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .conftest import SENHA, registrar_conta

# -- LiveBus (fan-out em processo, puro) --------------------------------


def test_bus_entrega_evento_ao_assinante():
    async def cenario():
        bus = LiveBus()
        pid = uuid.uuid4()
        async with bus.subscribe(pid) as fila:
            bus.publish(pid, {"type": "features", "value": 1})
            return await asyncio.wait_for(fila.get(), timeout=1)

    evento = asyncio.run(cenario())
    assert evento["type"] == "features"


def test_bus_nao_entrega_a_outro_paciente():
    async def cenario():
        bus = LiveBus()
        alvo, outro = uuid.uuid4(), uuid.uuid4()
        async with bus.subscribe(alvo) as fila:
            bus.publish(outro, {"type": "features"})
            try:
                await asyncio.wait_for(fila.get(), timeout=0.05)
                return "recebeu"
            except TimeoutError:
                return "vazio"

    assert asyncio.run(cenario()) == "vazio"


def test_bus_assinante_lento_nao_trava_a_captacao():
    """Fila cheia = espectador lento: descarta o evento, nunca levanta."""

    async def cenario():
        bus = LiveBus(fila_max=1)
        pid = uuid.uuid4()
        async with bus.subscribe(pid):
            bus.publish(pid, {"n": 1})  # enche
            bus.publish(pid, {"n": 2})  # descartado, sem erro
        # Fora do contexto, sem assinantes: publicar é no-op.
        bus.publish(pid, {"n": 3})
        return bus.subscriber_count(pid)

    assert asyncio.run(cenario()) == 0


def test_publicar_janela_traduz_features_esense_e_closed():
    bus = LiveBus()
    pid, sid = uuid.uuid4(), uuid.uuid4()
    recebidos: list[dict] = []

    async def cenario():
        async with bus.subscribe(pid) as fila:
            publicar_janela(bus, pid, sid, {"type": "ack", "features": {"rel_alpha": 0.4}})
            publicar_janela(bus, pid, sid,
                            {"type": "ack", "esense": {"attention": 50, "proprietary": True}})
            publicar_janela(bus, pid, sid,
                            {"type": "closed", "report": {"x": 1}, "result": {"persisted": True}})
            for _ in range(3):
                recebidos.append(await asyncio.wait_for(fila.get(), timeout=1))

    asyncio.run(cenario())
    tipos = [e["type"] for e in recebidos]
    assert tipos == ["features", "esense", "closed"]
    assert all(e["session_id"] == str(sid) for e in recebidos)
    assert recebidos[2]["report"] == {"x": 1}


def test_publicar_encerrada_emite_ended():
    bus = LiveBus()
    pid, sid = uuid.uuid4(), uuid.uuid4()

    async def cenario():
        async with bus.subscribe(pid) as fila:
            publicar_encerrada(bus, pid, sid)
            return await asyncio.wait_for(fila.get(), timeout=1)

    evento = asyncio.run(cenario())
    assert evento["type"] == "ended" and evento["session_id"] == str(sid)


# -- repositório: sessão ativa ------------------------------------------


def test_ativa_do_paciente_ignora_encerradas(client: TestClient, db_session: Session):
    paciente = _user(db_session, Ator(client).email)

    repo = CaptureSessionRepository(db_session)
    assert repo.ativa_do_paciente(paciente.id) is None

    encerrada = CaptureSession(
        patient_user_id=paciente.id, device="simulador", sample_rate=512,
        status=SessionStatus.COMPLETED,
    )
    ativa = CaptureSession(
        patient_user_id=paciente.id, device="simulador", sample_rate=512,
        status=SessionStatus.ACTIVE,
    )
    db_session.add_all([encerrada, ativa])
    db_session.flush()

    achada = repo.ativa_do_paciente(paciente.id)
    assert achada is not None and achada.id == ativa.id


# -- endpoints SSE -------------------------------------------------------


@pytest.fixture(autouse=True)
def _isola() -> Iterator[None]:
    reset_login_limiter()
    reset_live_bus()
    yield
    reset_login_limiter()
    reset_live_bus()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


class Ator:
    def __init__(self, client: TestClient, *, role: str = "patient") -> None:
        self._client = client
        self.email = f"user-{uuid.uuid4().hex[:12]}@example.com"
        registrar_conta(
            client, email=self.email, senha=SENHA, role=role, display_name="Sint"
        )
        self.token = client.post(
            "/auth/login", json={"email": self.email, "password": SENHA, "client": "mobile"}
        ).json()["access_token"]

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}


def _user(db_session: Session, email: str) -> User:
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    return UserRepository(db_session, hasher).get_by_email(email)


def _sessao_ativa(db_session: Session, patient: User) -> CaptureSession:
    sessao = CaptureSession(
        patient_user_id=patient.id, device="simulador", sample_rate=512,
        status=SessionStatus.ACTIVE,
    )
    db_session.add(sessao)
    db_session.flush()
    return sessao


class _FakeRequest:
    """Request mínimo: o gerador SSE só chama `is_disconnected`."""

    async def is_disconnected(self) -> bool:
        return False


def _status_do_primeiro_chunk(chunk: str) -> dict:
    for linha in chunk.splitlines():
        if linha.startswith("data:"):
            return json.loads(linha[len("data:"):].strip())
    raise AssertionError(f"sem evento data no chunk: {chunk!r}")


async def _primeiro_evento(resp) -> str:
    """Lê o 1º chunk do StreamingResponse e fecha o gerador (roda o cleanup).

    Chamamos o endpoint direto (sem HTTP): tanto o TestClient quanto o
    ASGITransport do httpx **bufferizam** a resposta inteira, e o stream ao vivo é
    infinito — travaria. Aqui lê-se **um** evento do `body_iterator`.
    """
    try:
        return await asyncio.wait_for(resp.body_iterator.__anext__(), timeout=2)
    finally:
        await resp.body_iterator.aclose()


def test_me_live_exige_autenticacao(client: TestClient):
    assert client.get("/me/live").status_code == 401


def test_me_live_recusa_papel_errado(client: TestClient):
    medico = Ator(client, role="doctor")
    assert client.get("/me/live", headers=medico.headers).status_code == 403


def test_me_live_status_reflete_sessao_ativa(client: TestClient, db_session: Session):
    from app.api.live import minha_transmissao

    p_user = _user(db_session, Ator(client).email)
    bus = LiveBus()

    async def status() -> dict:
        resp = await minha_transmissao(
            request=_FakeRequest(), user=p_user, session=db_session, bus=bus
        )
        return _status_do_primeiro_chunk(await _primeiro_evento(resp))

    # Sem captação: live=false.
    assert asyncio.run(status()) == {"live": False}
    # Com sessão ativa: live=true.
    _sessao_ativa(db_session, p_user)
    db_session.commit()
    assert asyncio.run(status()) == {"live": True}


def test_profissional_so_assiste_com_vinculo(client: TestClient, db_session: Session):
    """Sem CareLink → 403 (via HTTP); com vínculo, a abertura é auditada."""
    from app.api.live import transmissao_do_paciente

    paciente = Ator(client)
    pid = _user(db_session, paciente.email).id
    medico = Ator(client, role="doctor")

    # Sem vínculo: 403 (a guarda `require_active_care_link`).
    assert client.get(f"/patients/{pid}/live", headers=medico.headers).status_code == 403

    # Com vínculo ativo (o paciente convida), a abertura da transmissão é auditada.
    client.post("/care-links", json={"email": medico.email}, headers=paciente.headers)
    paciente_user = _user(db_session, paciente.email)
    medico_user = _user(db_session, medico.email)
    bus = LiveBus()

    async def abrir() -> dict:
        resp = await transmissao_do_paciente(
            patient_id=pid,
            request=_FakeRequest(),
            paciente=paciente_user,
            ator=medico_user,
            session=db_session,
            bus=bus,
        )
        return _status_do_primeiro_chunk(await _primeiro_evento(resp))

    # O espectador recebe tambem `shared` (ADR-0045): sem captacao ativa nao
    # ha o que compartilhar.
    assert asyncio.run(abrir()) == {"live": False, "shared": False}

    eventos = db_session.scalars(
        select(LiveViewAccessEvent).where(LiveViewAccessEvent.patient_user_id == pid)
    ).all()
    assert len(eventos) == 1
    assert eventos[0].actor_user_id == medico_user.id  # ator = profissional
