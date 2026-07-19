"""Gateway WebSocket de captação (#13).

O que estes testes protegem: **nenhum dado entra sem token válido**, a sessão
pertence a quem a abriu, e blocos malformados ou grandes demais não derrubam
nem inflam o servidor.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

from app.api.deps import get_analysis_client, reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import CaptureSession, SessionStatus
from app.services.analysis_client import AnalysisUnavailableError
from app.services.streaming import CloseCode

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


def _token(client: TestClient, role: str = "patient") -> str:
    email = _email()
    client.post(
        "/auth/register",
        json={"email": email, "password": SENHA, "role": role, "display_name": "Ficticio"},
    )
    resp = client.post(
        "/auth/login", json={"email": email, "password": SENHA, "client": "mobile"}
    )
    return resp.json()["access_token"]


def _abrir_sessao(ws, token: str, sample_rate: int = 512) -> str:
    ws.send_json({"type": "auth", "token": token})
    assert ws.receive_json() == {"type": "auth_ok"}
    ws.send_json({"type": "start", "device": "mindwave-mobile-2", "sample_rate": sample_rate})
    resposta = ws.receive_json()
    assert resposta["type"] == "session"
    return resposta["session_id"]


# -- autenticação --------------------------------------------------------


def test_sem_token_nao_entra_dado(client: TestClient):
    with client.websocket_connect("/stream") as ws:
        # Tenta pular a autenticação e já mandar sinal.
        ws.send_json({"type": "start", "device": "x", "sample_rate": 512})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == CloseCode.NAO_AUTENTICADO.value


def test_token_invalido_e_recusado(client: TestClient):
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": "nao-e-um-token"})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == CloseCode.NAO_AUTENTICADO.value


def test_token_ausente_e_recusado(client: TestClient):
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth"})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_medico_nao_abre_sessao_de_captacao(client: TestClient):
    """Quem capta é o paciente; um médico não abre sessão em nome de ninguém."""
    token = _token(client, role="doctor")
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": token})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == CloseCode.PAPEL_INVALIDO.value


# -- ciclo de vida da sessão --------------------------------------------


def test_stream_autenticado_cria_sessao(client: TestClient, db_session: Session):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)

    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao is not None
    assert sessao.device == "mindwave-mobile-2"
    assert sessao.sample_rate == 512


def test_blocos_de_amostras_sao_contabilizados(client: TestClient, db_session: Session):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)

        ws.send_json({"type": "samples", "seq": 1, "data": [1, 2, 3, 4]})
        primeiro = ws.receive_json()
        ws.send_json({"type": "samples", "seq": 2, "data": [5, 6]})
        segundo = ws.receive_json()

        assert primeiro["type"] == "ack"
        assert primeiro["received"] == 4
        assert segundo["total"] == 6

    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.sample_count == 6


def test_stop_encerra_a_sessao(client: TestClient, db_session: Session):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1, 2, 3]})
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["type"] == "closed"
    assert fim["sample_count"] == 3
    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.status is SessionStatus.COMPLETED
    assert sessao.ended_at is not None


def test_desconexao_sem_stop_marca_sessao_como_abortada(
    client: TestClient, db_session: Session
):
    """Queda no meio da captação não pode deixar a sessão ativa para sempre."""
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1, 2]})
        ws.receive_json()
        # Sai do contexto sem enviar `stop`.

    db_session.expire_all()
    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.status is SessionStatus.ABORTED
    assert sessao.ended_at is not None


def test_sessao_pertence_a_quem_a_abriu(client: TestClient, db_session: Session):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        session_id = _abrir_sessao(ws, token)

    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert str(sessao.patient_user_id) == me["id"]


# -- protocolo -----------------------------------------------------------


def test_amostras_antes_de_start_sao_recusadas(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": token})
        ws.receive_json()
        ws.send_json({"type": "samples", "seq": 1, "data": [1, 2]})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == CloseCode.PROTOCOLO_INVALIDO.value


def test_start_duplicado_e_recusado(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "start", "device": "outro", "sample_rate": 512})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_json_invalido_e_recusado(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": token})
        ws.receive_json()
        ws.send_text("isto nao e json")
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


@pytest.mark.parametrize(
    "start",
    [
        {"type": "start", "sample_rate": 512},
        {"type": "start", "device": "  ", "sample_rate": 512},
        {"type": "start", "device": "x", "sample_rate": 0},
        {"type": "start", "device": "x", "sample_rate": -1},
        {"type": "start", "device": "x", "sample_rate": 999999},
        {"type": "start", "device": "x", "sample_rate": "512"},
    ],
)
def test_start_malformado_e_recusado(client: TestClient, start: dict):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": token})
        ws.receive_json()
        ws.send_json(start)
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


@pytest.mark.parametrize(
    "bloco",
    [
        {"type": "samples", "seq": 1, "data": []},
        {"type": "samples", "seq": 1, "data": "nao-e-lista"},
        {"type": "samples", "seq": 1, "data": [1, "dois", 3]},
        {"type": "samples", "seq": 1},
    ],
)
def test_bloco_malformado_e_recusado(client: TestClient, bloco: dict):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(bloco)
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_bloco_grande_demais_e_recusado(client: TestClient):
    """Sem teto por bloco, um cliente enche a memória do servidor num frame."""
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [0] * 5000})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == CloseCode.LIMITE_EXCEDIDO.value


def test_tipo_desconhecido_e_recusado(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": token})
        ws.receive_json()
        ws.send_json({"type": "faz-qualquer-coisa"})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_reautenticar_e_recusado(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": token})
        ws.receive_json()
        ws.send_json({"type": "auth", "token": token})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


# -- análise ao vivo (#14) ----------------------------------------------


class AnalysisFake:
    """Duplo do serviço de Analysis: registra as janelas que recebeu."""

    def __init__(self, *, falha: bool = False) -> None:
        self.falha = falha
        self.janelas: list[tuple[int, float]] = []

    def analyze_window(self, samples, fs):
        if self.falha:
            raise AnalysisUnavailableError("fora do ar")
        self.janelas.append((len(samples), fs))
        return {"rel_alpha": 0.42, "engine_version": "fake/1.0"}


@pytest.fixture
def analysis() -> AnalysisFake:
    return AnalysisFake()


@pytest.fixture
def client_com_analysis(
    db_session: Session, analysis: AnalysisFake
) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_analysis_client] = lambda: analysis
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def test_features_chegam_quando_a_janela_fecha(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """Janela padrão = 2 s a 512 Hz = 1024 amostras."""
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)

        # Meia janela: ainda não analisa.
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 512})
        assert "features" not in ws.receive_json()

        # Fecha a janela: agora sim.
        ws.send_json({"type": "samples", "seq": 2, "data": [1.0] * 512})
        resposta = ws.receive_json()

    assert resposta["features"]["rel_alpha"] == 0.42
    assert analysis.janelas == [(1024, 512.0)]


def test_janela_usa_a_taxa_declarada_na_sessao(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token, sample_rate=256)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 512})
        ws.receive_json()

    # 2 s a 256 Hz = 512 amostras.
    assert analysis.janelas == [(512, 256.0)]


def test_sobra_do_buffer_entra_na_proxima_janela(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        for seq in range(4):  # 4 x 600 = 2400 amostras
            ws.send_json({"type": "samples", "seq": seq, "data": [1.0] * 600})
            ws.receive_json()

    # 2400 amostras rendem 2 janelas de 1024; o resto fica no buffer.
    assert analysis.janelas == [(1024, 512.0), (1024, 512.0)]


def test_analysis_fora_do_ar_nao_derruba_a_captacao(
    db_session: Session, analysis: AnalysisFake
):
    """Perder o ao vivo e aceitavel; perder a sessao do paciente nao."""
    analysis.falha = True
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_analysis_client] = lambda: analysis
    try:
        with TestClient(app, base_url="https://testserver") as client:
            token = _token(client)
            with client.websocket_connect("/stream") as ws:
                session_id = _abrir_sessao(ws, token)
                ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
                resposta = ws.receive_json()
                ws.send_json({"type": "stop"})
                fim = ws.receive_json()
    finally:
        app.dependency_overrides.clear()

    # O bloco foi aceito e a sessão encerrou normalmente...
    assert resposta["received"] == 1024
    assert fim["type"] == "closed"
    # ...e o cliente sabe que as features não vieram.
    assert resposta["features"] == {"unavailable": True}

    sessao = db_session.get(CaptureSession, uuid.UUID(session_id))
    assert sessao.status is SessionStatus.COMPLETED
    assert sessao.sample_count == 1024


def test_erro_nao_detalha_o_motivo_da_recusa(client: TestClient):
    """A mensagem não distingue token expirado, inválido ou de outro papel."""
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": "invalido"})
        detalhe = ws.receive_json()["detail"]
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()

    assert "invalido" in detalhe
    assert "expir" not in detalhe.lower()
