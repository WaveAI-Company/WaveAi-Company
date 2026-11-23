"""ADR-0058: a sessão de captação nunca fica órfã.

O que estes testes protegem, cada um contra um defeito medido em 13/09/2026:
- cliente autenticado que **para de mandar** frames não deixa a sessão "ao vivo"
  para sempre (antes: 150 s sem fechar, e o pong seguia automático);
- uma **falha inesperada** no meio da captação encerra a sessão pelo caminho de
  sempre (antes: Postgres parado → sessão `active` para sempre);
- a sessão que sobrou `active` porque o processo morreu **não conta como ativa**
  depois de 12 h, e o expurgo diário a encerra.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from app.api.deps import get_analysis_client
from app.config import get_settings
from app.db.session import get_session
from app.main import app
from app.models import CaptureSession, SessionStatus
from app.models.user import UserRole
from app.repositories.session import CaptureSessionRepository
from app.repositories.user import UserRepository
from app.services.streaming import CloseCode
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

from .conftest import SENHA
from .test_stream import AnalysisFake, _abrir_sessao, _token


@pytest.fixture
def client_impaciente(db_session: Session) -> Iterator[TestClient]:
    """Cliente com o timeout de inatividade curto, para o teste não esperar 30 s."""
    curto = get_settings().model_copy(update={"stream_idle_timeout_seconds": 0.3})
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_settings] = lambda: curto
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def test_silencio_depois_do_auth_encerra_a_sessao(
    client_impaciente: TestClient, db_session: Session
):
    token = _token(client_impaciente)
    with client_impaciente.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)
        # Nada mais é enviado: o socket segue aberto, como o de um app morto.
        assert ws.receive_json() == {"type": "error", "detail": "sem dados do cliente"}
        with pytest.raises(WebSocketDisconnect) as fechamento:
            ws.receive_json()
        assert fechamento.value.code == CloseCode.INATIVO.value

    db_session.expire_all()
    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.status is SessionStatus.ABORTED
    assert sessao.ended_at is not None


def test_frames_dentro_do_limite_mantem_a_sessao(
    client_impaciente: TestClient, db_session: Session
):
    """O limite é de SILÊNCIO, não de duração: quem segue mandando segue captando."""
    token = _token(client_impaciente)
    with client_impaciente.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)
        for seq in range(1, 6):
            ws.send_json({"type": "samples", "seq": seq, "data": [1, 2]})
            assert ws.receive_json()["type"] == "ack"
        ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "closed"

    db_session.expire_all()
    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.status is SessionStatus.COMPLETED


class _AnalysisQueQuebra(AnalysisFake):
    """Falha que nenhum `except` específico do gateway conhece."""

    def analyze_window(self, samples, fs, device=None):
        raise RuntimeError("bug qualquer")


def test_falha_inesperada_encerra_a_sessao_e_salva_o_captado(
    db_session: Session,
):
    from app.models import Result
    from sqlalchemy import select

    analysis = _AnalysisQueQuebra()
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_analysis_client] = lambda: analysis
    try:
        with TestClient(app, base_url="https://testserver") as client:
            token = _token(client)
            assert client.post(
                "/me/consent", headers={"Authorization": f"Bearer {token}"}
            ).status_code == 204
            with client.websocket_connect("/stream") as ws:
                session_id = _abrir_sessao(ws, token)
                # 1024 amostras fecham uma janela, e a janela quebra.
                ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
                with pytest.raises(WebSocketDisconnect) as fechamento:
                    ws.receive_json()
                assert fechamento.value.code == 1011
    finally:
        app.dependency_overrides.clear()

    db_session.expire_all()
    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.status is SessionStatus.ABORTED
    # O que já tinha sido captado vira Result, como em qualquer queda (ADR-0055).
    assert len(db_session.scalars(select(Result)).all()) == 1


def _paciente(db_session: Session, hasher):
    return UserRepository(db_session, hasher).create(
        email=f"orfa-{uuid.uuid4().hex[:10]}@example.com",
        password=SENHA,
        role=UserRole.PATIENT,
        display_name="Paciente Órfã (teste)",
    )


def test_sessao_ativa_velha_nao_conta_como_ao_vivo(db_session: Session, hasher):
    repo = CaptureSessionRepository(db_session)
    paciente = _paciente(db_session, hasher)
    agora = datetime.now(UTC)
    velha = repo.abrir(patient=paciente, device="mindwave", sample_rate=512)
    velha.started_at = agora - timedelta(hours=13)
    db_session.flush()

    assert repo.ativa_do_paciente(paciente.id) is velha  # sem limiar, como antes
    assert repo.ativa_do_paciente(paciente.id, orfa_apos=timedelta(hours=12), now=agora) is None

    nova = repo.abrir(patient=paciente, device="mindwave", sample_rate=512)
    assert repo.ativa_do_paciente(paciente.id, orfa_apos=timedelta(hours=12), now=agora) is nova


def test_expurgo_encerra_so_as_orfas(db_session: Session, hasher):
    repo = CaptureSessionRepository(db_session)
    paciente = _paciente(db_session, hasher)
    agora = datetime.now(UTC)
    velha = repo.abrir(patient=paciente, device="mindwave", sample_rate=512)
    velha.started_at = agora - timedelta(hours=13)
    viva = repo.abrir(patient=paciente, device="mindwave", sample_rate=512)
    viva.started_at = agora - timedelta(hours=1)
    db_session.flush()

    assert repo.encerrar_orfas(orfa_apos=timedelta(hours=12), now=agora) >= 1
    assert velha.status is SessionStatus.ABORTED
    assert velha.ended_at == agora
    # Uma captação de uma hora atrás pode estar acontecendo agora mesmo.
    assert viva.status is SessionStatus.ACTIVE


class _AnalysisLenta(AnalysisFake):
    """Analysis que demora — como a medida em 13/09 (5 s por janela)."""

    def analyze_window(self, samples, fs, device=None):
        import time

        time.sleep(1.0)
        return super().analyze_window(samples, fs, device)


def test_janela_lenta_nao_trava_as_outras_requisicoes(db_session: Session):
    """ADR-0058, Decisão 4: o trabalho síncrono do gateway roda fora do loop.

    Antes, enquanto uma janela esperava a Analysis, o loop de eventos inteiro
    ficava parado — e o `/health` de outra requisição esperava junto.
    """
    import threading
    import time

    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_analysis_client] = lambda: _AnalysisLenta()
    medida: dict[str, float] = {}
    try:
        with TestClient(app, base_url="https://testserver") as client:
            token = _token(client)
            with client.websocket_connect("/stream") as ws:
                _abrir_sessao(ws, token)
                # Fecha uma janela: a Analysis vai segurar 1 s.
                ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
                time.sleep(0.2)

                def bater_no_health() -> None:
                    inicio = time.perf_counter()
                    assert client.get("/health").status_code == 200
                    medida["segundos"] = time.perf_counter() - inicio

                outra = threading.Thread(target=bater_no_health)
                outra.start()
                outra.join(timeout=5)
                assert ws.receive_json()["type"] == "ack"
    finally:
        app.dependency_overrides.clear()

    # Com o trabalho no loop, o /health esperava os ~0,8 s restantes da janela.
    assert medida["segundos"] < 0.4, medida
