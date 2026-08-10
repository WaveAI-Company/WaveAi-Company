"""Compartilhamento ao vivo decidido pelo titular (ADR-0045).

São **três portas** para um profissional assistir: CareLink ativo (ADR-0024) +
o titular ter ligado **nesta** sessão (esta ADR) + ele abrir deliberadamente,
com auditoria (ADR-0039). Estes testes cobrem a porta do meio — e provam que o
corte mora no `LiveBus`, um lugar só.

Só dados sintéticos (CLAUDE.md).
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import CaptureSession, LiveShareEvent, SessionStatus, User
from app.services.live_bus import LiveBus, publicar_janela, reset_live_bus

from .conftest import registrar_conta

SENHA = "senha-de-teste-bem-longa"


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
    app.dependency_overrides.pop(get_session, None)


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
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


class _FakeRequest:
    """Request mínimo: o gerador SSE só chama `is_disconnected`."""

    async def is_disconnected(self) -> bool:
        return False


def _user(db_session: Session, email: str) -> User:
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher

    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    return UserRepository(db_session, hasher).get_by_email(email)


def _sessao_ativa(db_session: Session, patient: User) -> CaptureSession:
    sessao = CaptureSession(
        patient_user_id=patient.id,
        device="simulador",
        sample_rate=512,
        status=SessionStatus.ACTIVE,
    )
    db_session.add(sessao)
    db_session.flush()
    return sessao


def _ligar(client: TestClient, ator: Ator, session_id, enabled: bool):
    return client.put(
        f"/me/sessions/{session_id}/live-sharing",
        json={"enabled": enabled},
        headers=ator.headers,
    )


async def _vazio_ou_recebeu(fila) -> str:
    try:
        await asyncio.wait_for(fila.get(), timeout=0.05)
        return "recebeu"
    except asyncio.TimeoutError:
        return "vazio"


# -- o corte, no barramento ----------------------------------------------


def test_espectador_nao_recebe_sem_compartilhamento():
    async def cenario():
        bus = LiveBus()
        pid = uuid.uuid4()
        async with bus.subscribe(pid, espectador=True) as fila:
            bus.publish(pid, {"type": "features"}, compartilhado=False)
            return await _vazio_ou_recebeu(fila)

    assert asyncio.run(cenario()) == "vazio"


def test_espectador_recebe_quando_compartilhado():
    async def cenario():
        bus = LiveBus()
        pid = uuid.uuid4()
        async with bus.subscribe(pid, espectador=True) as fila:
            bus.publish(pid, {"type": "features"}, compartilhado=True)
            return await asyncio.wait_for(fila.get(), timeout=1)

    assert asyncio.run(cenario())["type"] == "features"


def test_titular_recebe_mesmo_sem_compartilhamento():
    """A chave governa quem assiste de fora — nunca o acesso do dono ao próprio dado."""

    async def cenario():
        bus = LiveBus()
        pid = uuid.uuid4()
        async with bus.subscribe(pid) as fila:
            bus.publish(pid, {"type": "features"}, compartilhado=False)
            return await asyncio.wait_for(fila.get(), timeout=1)

    assert asyncio.run(cenario())["type"] == "features"


def test_publish_sem_o_parametro_nao_compartilha():
    """Default fail-closed: esquecer o parâmetro deixa de compartilhar, em vez
    de compartilhar sem autorização."""

    async def cenario():
        bus = LiveBus()
        pid = uuid.uuid4()
        async with bus.subscribe(pid, espectador=True) as fila:
            bus.publish(pid, {"type": "features"})
            return await _vazio_ou_recebeu(fila)

    assert asyncio.run(cenario()) == "vazio"


def test_publicar_janela_respeita_o_compartilhamento():
    async def cenario():
        bus = LiveBus()
        pid, sid = uuid.uuid4(), uuid.uuid4()
        async with bus.subscribe(pid, espectador=True) as fila:
            publicar_janela(bus, pid, sid, {"features": {"a": 1}}, compartilhado=False)
            return await _vazio_ou_recebeu(fila)

    assert asyncio.run(cenario()) == "vazio"


def test_aviso_de_compartilhamento_so_vai_ao_espectador():
    """O titular não recebe o evento `share`: a chave não governa o acesso dele."""

    async def cenario():
        bus = LiveBus()
        pid = uuid.uuid4()
        async with bus.subscribe(pid) as do_titular:
            async with bus.subscribe(pid, espectador=True) as do_espectador:
                bus.publicar_compartilhamento(pid, False)
                visto = await asyncio.wait_for(do_espectador.get(), timeout=1)
                return visto, await _vazio_ou_recebeu(do_titular)

    evento, titular = asyncio.run(cenario())
    assert evento == {"type": "share", "shared": False}
    assert titular == "vazio"


# -- o interruptor --------------------------------------------------------


def test_sessao_nasce_sem_compartilhamento(client: TestClient, db_session: Session):
    paciente = Ator(client)

    sessao = _sessao_ativa(db_session, _user(db_session, paciente.email))

    assert sessao.live_sharing_enabled is False


def test_titular_liga_e_desliga(client: TestClient, db_session: Session):
    paciente = Ator(client)
    sessao = _sessao_ativa(db_session, _user(db_session, paciente.email))
    db_session.commit()

    ligou = _ligar(client, paciente, sessao.id, True)
    assert ligou.status_code == 200
    assert ligou.json()["live_sharing_enabled"] is True

    assert _ligar(client, paciente, sessao.id, False).json()["live_sharing_enabled"] is False


def test_cada_gesto_vira_linha_na_trilha(client: TestClient, db_session: Session):
    """Não só o estado final: numa disputa, quem responde é o histórico."""
    paciente = Ator(client)
    sessao = _sessao_ativa(db_session, _user(db_session, paciente.email))
    db_session.commit()

    _ligar(client, paciente, sessao.id, True)
    _ligar(client, paciente, sessao.id, False)
    _ligar(client, paciente, sessao.id, True)

    eventos = db_session.scalars(
        select(LiveShareEvent)
        .where(LiveShareEvent.session_id == sessao.id)
        .order_by(LiveShareEvent.created_at)
    ).all()
    assert [e.enabled for e in eventos] == [True, False, True]


def test_repetir_o_mesmo_estado_nao_duplica_a_trilha(
    client: TestClient, db_session: Session
):
    paciente = Ator(client)
    sessao = _sessao_ativa(db_session, _user(db_session, paciente.email))
    db_session.commit()

    _ligar(client, paciente, sessao.id, True)
    _ligar(client, paciente, sessao.id, True)

    eventos = db_session.scalars(
        select(LiveShareEvent).where(LiveShareEvent.session_id == sessao.id)
    ).all()
    assert len(eventos) == 1


def test_ninguem_liga_o_compartilhamento_de_outra_pessoa(
    client: TestClient, db_session: Session
):
    """Mesmo 404 para "não existe" e "não é sua" — nada de oráculo de sessões."""
    dona = Ator(client)
    intrusa = Ator(client)
    sessao = _sessao_ativa(db_session, _user(db_session, dona.email))
    db_session.commit()

    assert _ligar(client, intrusa, sessao.id, True).status_code == 404
    assert _ligar(client, intrusa, uuid.uuid4(), True).status_code == 404
    db_session.refresh(sessao)
    assert sessao.live_sharing_enabled is False


def test_sessao_encerrada_nao_aceita_compartilhamento(
    client: TestClient, db_session: Session
):
    """Autorizar depois algo que já aconteceu não é consentimento."""
    paciente = Ator(client)
    sessao = _sessao_ativa(db_session, _user(db_session, paciente.email))
    sessao.status = SessionStatus.COMPLETED
    db_session.commit()

    assert _ligar(client, paciente, sessao.id, True).status_code == 409


# -- o que o profissional vê ----------------------------------------------


def _abrir_transmissao(db_session: Session, paciente: User, medico: User, bus: LiveBus):
    from app.api.live import transmissao_do_paciente

    return transmissao_do_paciente(
        patient_id=paciente.id,
        request=_FakeRequest(),
        paciente=paciente,
        ator=medico,
        session=db_session,
        bus=bus,
    )


def _status(chunk: str) -> dict:
    import json

    for linha in chunk.splitlines():
        if linha.startswith("data:"):
            return json.loads(linha[len("data:") :].strip())
    raise AssertionError(f"sem evento data no chunk: {chunk!r}")


def test_status_do_espectador_reflete_a_chave(client: TestClient, db_session: Session):
    """O painel precisa saber que não está compartilhado — senão a tela mente
    oferecendo um botão que não funciona (ADR-0027)."""
    paciente = Ator(client)
    medico = Ator(client, role="doctor")
    client.post("/care-links", json={"email": medico.email}, headers=paciente.headers)
    p_user = _user(db_session, paciente.email)
    m_user = _user(db_session, medico.email)
    sessao = _sessao_ativa(db_session, p_user)
    db_session.commit()
    bus = LiveBus()

    async def status() -> dict:
        resp = await _abrir_transmissao(db_session, p_user, m_user, bus)
        try:
            return _status(await asyncio.wait_for(resp.body_iterator.__anext__(), timeout=2))
        finally:
            await resp.body_iterator.aclose()

    assert asyncio.run(status()) == {"live": True, "shared": False}

    sessao.live_sharing_enabled = True
    db_session.commit()
    assert asyncio.run(status()) == {"live": True, "shared": True}


def test_desligar_encerra_o_stream_do_profissional(
    client: TestClient, db_session: Session
):
    """Corta na hora — sem esperar a próxima janela."""
    paciente = Ator(client)
    medico = Ator(client, role="doctor")
    client.post("/care-links", json={"email": medico.email}, headers=paciente.headers)
    p_user = _user(db_session, paciente.email)
    m_user = _user(db_session, medico.email)
    sessao = _sessao_ativa(db_session, p_user)
    sessao.live_sharing_enabled = True
    db_session.commit()
    bus = LiveBus()

    async def cenario():
        resp = await _abrir_transmissao(db_session, p_user, m_user, bus)
        it = resp.body_iterator
        inicial = _status(await asyncio.wait_for(it.__anext__(), timeout=2))
        bus.publicar_compartilhamento(p_user.id, False)  # o titular desliga
        aviso = await asyncio.wait_for(it.__anext__(), timeout=2)
        try:
            await asyncio.wait_for(it.__anext__(), timeout=2)
            fim = "continuou"
        except StopAsyncIteration:
            fim = "encerrou"
        finally:
            await it.aclose()
        return inicial, aviso, fim

    inicial, aviso, fim = asyncio.run(cenario())
    assert inicial == {"live": True, "shared": True}
    assert _status(aviso) == {"type": "share", "shared": False}
    assert fim == "encerrou"
