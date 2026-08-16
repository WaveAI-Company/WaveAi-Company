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
from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import CaptureSession, LiveShareEvent, SessionStatus, User
from app.services.live_bus import LiveBus, publicar_janela, reset_live_bus
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .conftest import SENHA, registrar_conta


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
    except TimeoutError:
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


# -- ligar com a captação já em curso -----------------------------------


class _AnalysisFake:
    """Devolve uma janela pronta, para o gateway ter o que espelhar."""

    def analyze_window(self, samples, fs, device=None):
        return {"rel_alpha": 0.42, "engine_version": "fake/1.0"}

    def analyze_session(self, samples, fs, labels=None, device=None, history=None):
        return {"rel_alpha": 0.33, "engine_version": "fake/1.0"}


def test_ligar_com_a_sessao_correndo_passa_a_publicar(db_session: Session):
    """O caminho **real** do compartilhamento, e o que estava quebrado.

    Toda sessão nasce desligada (ADR-0045), então ligar durante a captação é a
    única forma de compartilhar. O gateway carrega a sessão uma vez, no
    `start`, e quem liga é outra requisição: sem reler a coluna, a conexão do
    WebSocket seguia publicando `compartilhado=False` para sempre — o
    espectador via `shared: true` no status e não recebia janela nenhuma.

    O teste anda pelo fluxo inteiro: abre o stream de verdade, liga pela rota
    HTTP com a sessão já correndo e confere que a janela seguinte chega a quem
    assina o barramento.
    """
    from app.api.deps import get_analysis_client
    from app.services.live_bus import get_live_bus

    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_analysis_client] = lambda: _AnalysisFake()
    try:
        with TestClient(app, base_url="https://testserver") as client:
            paciente = Ator(client)
            p_user = _user(db_session, paciente.email)
            bus = get_live_bus()
            recebidos: list[dict] = []

            with client.websocket_connect("/stream") as ws:
                ws.send_json({"type": "auth", "token": paciente.token})
                assert ws.receive_json() == {"type": "auth_ok"}
                ws.send_json(
                    {"type": "start", "device": "simulador", "sample_rate": 512}
                )
                session_id = ws.receive_json()["session_id"]

                # Espia o barramento como um espectador autorizado faria: o
                # corte de quem vê o quê é do `LiveBus`, e é dele que a fila
                # de espectador recebe (ou não) a janela.
                fila: asyncio.Queue[dict] = asyncio.Queue()
                bus._espectadores[p_user.id].add(fila)

                # Ainda desligado: a janela não pode vazar.
                ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
                assert "features" in ws.receive_json()
                assert fila.empty()

                # O titular liga **agora**, com a captação em curso.
                resp = _ligar(client, paciente, session_id, True)
                assert resp.status_code == 200

                ws.send_json({"type": "samples", "seq": 2, "data": [1.0] * 1024})
                assert "features" in ws.receive_json()
                while not fila.empty():
                    recebidos.append(fila.get_nowait())

            tipos = [e["type"] for e in recebidos]
            # O `share` é o aviso que a própria rota publica ao ligar; o que
            # importa aqui é a **janela** que vem depois dele.
            assert tipos == ["share", "features"], (
                "a janela seguinte ao 'ligar' precisa chegar ao espectador"
            )
            janela = recebidos[-1]
            assert janela["session_id"] == session_id
            assert janela["features"]["rel_alpha"] == 0.42
    finally:
        app.dependency_overrides.clear()


def test_publicar_le_o_compartilhamento_do_banco(
    client: TestClient, db_session: Session
):
    """O mecanismo do bug, isolado: **duas sessões do SQLAlchemy**.

    Em produção a conexão do WebSocket tem a sua sessão e a rota que liga o
    compartilhamento tem outra. Sem reler a coluna na hora de publicar, a
    primeira segue com o valor lido no `start` — `False`, sempre, porque toda
    sessão nasce assim (ADR-0045).

    O teste de fluxo acima **não** pega isso: no `TestClient` as duas pontas
    compartilham a mesma sessão pelo override do `get_session`, e o objeto já
    vem atualizado. Aqui a segunda sessão é criada à mão, e o alvo é
    `_publicar_ao_vivo` — o **ponto de uso**, não o helper: testar o helper
    sozinho deixaria passar justamente a regressão de alguém voltar a ler
    `sessao.live_sharing_enabled` na hora de publicar.
    """
    from types import SimpleNamespace

    from app.api.stream import _publicar_ao_vivo

    paciente = _user(db_session, Ator(client).email)
    sessao = _sessao_ativa(db_session, paciente)
    db_session.commit()

    # A "outra requisição": sessão própria, sobre a mesma conexão do teste.
    outra = Session(
        bind=db_session.connection(), join_transaction_mode="create_savepoint"
    )
    try:
        espelho = outra.get(CaptureSession, sessao.id)
        espelho.live_sharing_enabled = True
        outra.commit()
    finally:
        outra.close()

    # O objeto que o gateway carregou no `start` ainda não sabe de nada.
    assert sessao.live_sharing_enabled is False

    protocolo = SimpleNamespace(state=SimpleNamespace(user=paciente, session=sessao))

    async def cenario() -> str:
        bus = LiveBus()
        async with bus.subscribe(paciente.id, espectador=True) as fila:
            _publicar_ao_vivo(bus, protocolo, {"features": {"a": 1}}, db_session)
            return await _vazio_ou_recebeu(fila)

    assert asyncio.run(cenario()) == "recebeu"
