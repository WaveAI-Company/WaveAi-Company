"""Gateway WebSocket de captação (#13).

O que estes testes protegem: **nenhum dado entra sem token válido**, a sessão
pertence a quem a abriu, e blocos malformados ou grandes demais não derrubam
nem inflam o servidor.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from app.api.deps import get_analysis_client, reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models import CaptureSession, SessionStatus
from app.services.analysis_client import AnalysisUnavailableError
from app.services.streaming import CloseCode
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

from .conftest import SENHA, registrar_conta


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
    registrar_conta(client, email=email, senha=SENHA, role=role)
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
    """Duplo do serviço de Analysis: registra as janelas/sessões que recebeu."""

    def __init__(self, *, falha: bool = False) -> None:
        self.falha = falha
        self.janelas: list[tuple[int, float]] = []
        self.sessoes: list[tuple[int, float]] = []
        #: Device recebido em cada analyze_session — prova que a proveniência
        #: (ADR-0033) flui do gateway para a Analysis.
        self.session_devices: list[str | None] = []
        #: Histórico recebido (ADR-0032): prova que o baseline pessoal é
        #: alimentado pelos Result já persistidos do titular.
        self.session_histories: list[list | None] = []
        #: Labels recebidas (ADR-0053): prova que a marcação de fase do
        #: protocolo guiado chega até a Analysis, e com que forma.
        self.session_labels: list[list[str] | None] = []
        #: Contraste devolvido, quando o teste quiser encená-lo. `None` espelha
        #: a Analysis real sem as duas fases: a chave simplesmente não aparece.
        self.comparison: dict | None = None

    def analyze_window(self, samples, fs, device=None):
        if self.falha:
            raise AnalysisUnavailableError("fora do ar")
        self.janelas.append((len(samples), fs))
        return {"rel_alpha": 0.42, "engine_version": "fake/1.0"}

    def analyze_session(self, samples, fs, labels=None, device=None, history=None):
        if self.falha:
            raise AnalysisUnavailableError("fora do ar")
        self.sessoes.append((len(samples), fs))
        self.session_devices.append(device)
        self.session_histories.append(history)
        self.session_labels.append(labels)
        # A Analysis real carimba device+montagem e devolve as features do
        # Catálogo; o duplo espelha o mínimo para exercitar persistência da
        # proveniência (em claro) e a alimentação do baseline pessoal.
        corpo = {
            "rel_alpha": 0.33,
            "engine_version": "fake/1.0",
            "relative_band_powers": {},
            "features": {"rel_alpha": 0.33, "rel_beta": 0.10},
            "device": device,
            "montage": ["FP1"] if device else [],
        }
        # Espelha a regra da Analysis real: o engine só compara quando os DOIS
        # grupos têm amostras, então sem as duas fases a chave nem aparece. Sem
        # esta condição o duplo devolveria `comparison` mesmo com `labels=None`,
        # e o teste do `closed` passaria com a marcação desligada — um teste que
        # não discrimina.
        tem_as_duas = labels is not None and {"eyes_open", "eyes_closed"} <= set(labels)
        if self.comparison is not None and tem_as_duas:
            corpo["comparison"] = self.comparison
        return corpo


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


def test_stop_gera_result_persistido_com_consentimento(
    client_com_analysis: TestClient, analysis: AnalysisFake, db_session: Session
):
    """Aceite da #15: sessão encerrada gera relatório persistido (ADR-0026)."""
    token = _token(client_com_analysis)
    # Consentimento do titular — sem ele o gate impede a gravação.
    assert client_com_analysis.post(
        "/me/consent", headers={"Authorization": f"Bearer {token}"}
    ).status_code == 204

    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["result"]["persisted"] is True
    # A sessão inteira (1024) foi enviada para process_session.
    assert analysis.sessoes == [(1024, 512.0)]
    # Proveniência (ADR-0033): o device declarado no start chegou à Analysis...
    assert analysis.session_devices == ["mindwave-mobile-2"]
    # ...e foi persistido EM CLARO no Result (device + montagem serializada).
    from app.models import Result
    from sqlalchemy import select
    results = db_session.scalars(select(Result)).all()
    assert len(results) == 1
    assert results[0].device == "mindwave-mobile-2"
    assert results[0].montage == "FP1"


def test_baseline_pessoal_alimentado_pelos_results_anteriores(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """ADR-0032 (opção 1): a 2ª sessão recebe como histórico as features da 1ª."""
    token = _token(client_com_analysis)
    assert client_com_analysis.post(
        "/me/consent", headers={"Authorization": f"Bearer {token}"}
    ).status_code == 204

    def _uma_sessao():
        with client_com_analysis.websocket_connect("/stream") as ws:
            _abrir_sessao(ws, token)
            ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
            ws.receive_json()
            ws.send_json({"type": "stop"})
            ws.receive_json()

    _uma_sessao()  # persiste o 1º Result (com features)
    _uma_sessao()  # a 2ª deve receber o histórico do 1º

    # 1ª sessão: sem histórico. 2ª: histórico com as features da 1ª.
    assert analysis.session_histories[0] is None
    assert analysis.session_histories[1] == [{"rel_alpha": 0.33, "rel_beta": 0.10}]


def test_stop_devolve_o_relatorio_da_sessao(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """Aceite da #17: ao encerrar, o app recebe o **conteúdo** do relatório.

    Sem isto, a jornada "captar → ver o relatório" não fecha: as métricas eram
    calculadas e descartadas, sobrando só o status de persistência.
    """
    token = _token(client_com_analysis)
    assert client_com_analysis.post(
        "/me/consent", headers={"Authorization": f"Bearer {token}"}
    ).status_code == 204

    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["report"]["rel_alpha"] == 0.33
    assert fim["report"]["engine_version"] == "fake/1.0"
    # O status de armazenamento continua separado do conteúdo.
    assert fim["result"]["persisted"] is True


def test_relatorio_volta_ao_titular_mesmo_sem_persistir(
    client_com_analysis: TestClient, analysis: AnalysisFake, db_session: Session
):
    """Sem consentimento nada é gravado — mas o titular ainda vê a própria
    medição. Mostrar não é guardar."""
    token = _token(client_com_analysis)  # sem /me/consent

    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["report"]["rel_alpha"] == 0.33
    assert fim["result"]["persisted"] is False
    assert fim["result"]["reason"] == "sem consentimento"
    from app.models import Result
    assert db_session.scalars(__import__("sqlalchemy").select(Result)).all() == []


def test_stop_sem_consentimento_nao_persiste_mas_encerra(
    client_com_analysis: TestClient, analysis: AnalysisFake, db_session: Session
):
    """Gate ADR-0026: sem consentimento, a sessão encerra mas nada é gravado."""
    token = _token(client_com_analysis)  # sem /me/consent

    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 1024})
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["type"] == "closed"
    assert fim["result"]["persisted"] is False
    assert fim["result"]["reason"] == "sem consentimento"
    from app.models import Result
    assert db_session.scalars(__import__("sqlalchemy").select(Result)).all() == []


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


# -- eSense ao vivo (N6-c, ADR-0034) ------------------------------------


def test_esense_do_frame_e_relayado_rotulado(client: TestClient):
    """Attention/Meditation fornecidos pelo aparelho voltam numa chave própria,
    marcados como proprietários (ADR-0034)."""
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1, 2, 3],
             "attention": 57, "meditation": 42}
        )
        ack = ws.receive_json()

    assert ack["type"] == "ack"
    assert ack["esense"] == {"attention": 57, "meditation": 42, "proprietary": True}


def test_esense_independe_do_fechamento_de_janela(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """eSense é ~1 Hz e vem do device: chega mesmo sem a janela ter fechado
    (nenhuma feature ainda) e **não** passa pela Analysis."""
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        # Bloco curto: a janela (1024) não fecha, então não há features...
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1] * 10, "attention": 80}
        )
        ack = ws.receive_json()

    assert "features" not in ack           # janela não fechou
    assert ack["esense"] == {"attention": 80, "proprietary": True}
    assert analysis.janelas == []          # eSense nunca foi à Analysis


def test_esense_ausente_nao_inclui_a_chave(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1, 2, 3]})
        ack = ws.receive_json()

    assert ack["type"] == "ack"
    assert "esense" not in ack


def test_esense_parcial_relaya_so_o_que_veio(client: TestClient):
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1, 2], "meditation": 30}
        )
        ack = ws.receive_json()

    assert ack["esense"] == {"meditation": 30, "proprietary": True}


@pytest.mark.parametrize(
    "esense",
    [
        {"attention": 101},        # acima da faixa
        {"attention": -1},         # abaixo da faixa
        {"attention": "alto"},     # tipo errado
        {"attention": 50.0},       # float não é eSense (int 0..100)
        {"meditation": True},      # bool não conta como 1
    ],
)
def test_esense_malformado_e_ignorado_sem_derrubar(client: TestClient, esense: dict):
    """eSense é complemento: valor inválido some do relay, mas **não** encerra
    a captação (perder o complemento é aceitável; perder a sessão não)."""
    token = _token(client)
    with client.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1, 2], **esense})
        ack = ws.receive_json()
        assert ack["type"] == "ack"        # não virou erro
        assert "esense" not in ack         # o valor inválido não foi relayado
        # A sessão segue viva: o próximo bloco é aceito normalmente.
        ws.send_json({"type": "samples", "seq": 2, "data": [3, 4]})
        assert ws.receive_json()["type"] == "ack"


def test_esense_nao_se_mistura_as_features(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """Mesmo quando a janela fecha, o eSense fica fora de `features` — as
    features transparentes vêm da Analysis; o eSense é complemento à parte."""
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1.0] * 1024, "attention": 60}
        )
        ack = ws.receive_json()

    # A janela fechou: há features da Analysis...
    assert ack["features"]["rel_alpha"] == 0.42
    assert "attention" not in ack["features"]
    # ...e o eSense veio separado, marcado como proprietário.
    assert ack["esense"] == {"attention": 60, "proprietary": True}


def test_erro_nao_detalha_o_motivo_da_recusa(client: TestClient):
    """A mensagem não distingue token expirado, inválido ou de outro papel."""
    with client.websocket_connect("/stream") as ws:
        ws.send_json({"type": "auth", "token": "invalido"})
        detalhe = ws.receive_json()["detail"]
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()

    assert "invalido" in detalhe
    assert "expir" not in detalhe.lower()


# -- fase do protocolo guiado (ADR-0053) --------------------------------------


def test_fase_do_protocolo_vira_labels_para_a_analysis(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """As duas fases marcadas chegam à Analysis como vetor paralelo ao sinal.

    É o elo que faltava: cliente e Analysis já falavam de `labels`, e a chamada
    do gateway não passava nada. A asserção que **discrimina** é a contagem por
    rótulo — um `labels` não-nulo, sozinho, passaria mesmo com a marcação
    embaralhada.
    """
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1.0] * 600, "phase": "eyes_open"}
        )
        ws.receive_json()
        ws.send_json(
            {"type": "samples", "seq": 2, "data": [2.0] * 400, "phase": "eyes_closed"}
        )
        ws.receive_json()
        ws.send_json({"type": "stop"})
        ws.receive_json()

    labels = analysis.session_labels[0]
    assert labels is not None
    assert len(labels) == 1000, "o vetor tem de ser paralelo às amostras"
    assert labels.count("eyes_open") == 600
    assert labels.count("eyes_closed") == 400
    # E na ordem em que o sinal chegou, não só na quantidade certa.
    assert labels[599] == "eyes_open"
    assert labels[600] == "eyes_closed"


def test_sinal_fora_do_protocolo_fica_de_fora_do_contraste(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """O que foi captado antes/depois do protocolo não entra na comparação.

    O engine só agrupa os rótulos que conhece; `unlabeled` não casa com nenhum
    dos dois conjuntos, então essas amostras existem no sinal e ficam fora do
    contraste — que é o desejado: comparam-se as duas fases, não a sessão toda.
    """
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 100})
        ws.receive_json()
        ws.send_json(
            {"type": "samples", "seq": 2, "data": [1.0] * 200, "phase": "eyes_open"}
        )
        ws.receive_json()
        ws.send_json(
            {"type": "samples", "seq": 3, "data": [1.0] * 200, "phase": "eyes_closed"}
        )
        ws.receive_json()
        ws.send_json({"type": "stop"})
        ws.receive_json()

    labels = analysis.session_labels[0]
    assert labels is not None
    assert labels.count("unlabeled") == 100
    assert labels.count("eyes_open") == 200
    assert labels.count("eyes_closed") == 200
    assert labels[:100] == ["unlabeled"] * 100


def test_sessao_sem_protocolo_nao_manda_labels(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """Captação comum não paga por uma marcação que ninguém pediu."""
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json({"type": "samples", "seq": 1, "data": [1.0] * 512})
        ws.receive_json()
        ws.send_json({"type": "stop"})
        ws.receive_json()

    assert analysis.session_labels[0] is None


def test_protocolo_pela_metade_nao_manda_labels(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """Uma fase só não é contraste.

    Sem as duas o engine não compararia nada, e expandir o vetor gastaria
    memória proporcional ao sinal para ser descartado do outro lado.
    """
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1.0] * 512, "phase": "eyes_open"}
        )
        ws.receive_json()
        ws.send_json({"type": "stop"})
        ws.receive_json()

    assert analysis.session_labels[0] is None


@pytest.mark.parametrize(
    "fase", ["olhos_fechados", "", "EYES_OPEN", 42, None, ["eyes_open"]]
)
def test_fase_invalida_e_ignorada_sem_derrubar_a_captacao(
    client_com_analysis: TestClient, analysis: AnalysisFake, fase
):
    """Precedente do eSense (ADR-0034): valor malformado não mata a sessão.

    Perder a marcação custa o contraste de uma captação; recusar o frame
    custaria a captação inteira. O frame segue valendo e as amostras entram.
    """
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1.0] * 300, "phase": fase}
        )
        resposta = ws.receive_json()
        assert resposta["type"] == "ack", "fase inválida não pode derrubar o frame"
        assert resposta["received"] == 300
        ws.send_json(
            {"type": "samples", "seq": 2, "data": [1.0] * 300, "phase": "eyes_closed"}
        )
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["type"] == "closed"
    # Só uma fase válida sobrou, então não há contraste a pedir.
    assert analysis.session_labels[0] is None


def test_intervalos_se_agrupam_em_vez_de_um_por_frame(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """Frames seguidos da mesma fase estendem o intervalo corrente.

    Isto é o que torna a estrutura barata: uma sessão de 60 s manda ~120 frames
    por fase e guarda **dois** intervalos, não 240. A prova é indireta — o vetor
    expandido tem de sair idêntico ao de um único frame por fase.
    """
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        for seq in range(1, 5):
            ws.send_json(
                {"type": "samples", "seq": seq, "data": [1.0] * 50, "phase": "eyes_open"}
            )
            ws.receive_json()
        ws.send_json(
            {"type": "samples", "seq": 5, "data": [1.0] * 50, "phase": "eyes_closed"}
        )
        ws.receive_json()
        ws.send_json({"type": "stop"})
        ws.receive_json()

    labels = analysis.session_labels[0]
    assert labels == ["eyes_open"] * 200 + ["eyes_closed"] * 50


def test_contraste_da_analysis_chega_ao_app_no_closed(
    client_com_analysis: TestClient, analysis: AnalysisFake
):
    """O `comparison` viaja de graça: o `closed` já devolve o relatório inteiro.

    Fecha a jornada da ADR-0053 do lado do servidor — o que a tela mostra é a
    fatia seguinte.
    """
    analysis.comparison = {
        "eyes_closed_rel_alpha": 0.29,
        "eyes_open_rel_alpha": 0.17,
        "ratio": 1.74,
        "p_value": 2.2e-11,
        "verdict": "PASSOU (OF > OA, significativo)",
        "passed": True,
    }
    token = _token(client_com_analysis)
    with client_com_analysis.websocket_connect("/stream") as ws:
        _abrir_sessao(ws, token)
        ws.send_json(
            {"type": "samples", "seq": 1, "data": [1.0] * 300, "phase": "eyes_open"}
        )
        ws.receive_json()
        ws.send_json(
            {"type": "samples", "seq": 2, "data": [1.0] * 300, "phase": "eyes_closed"}
        )
        ws.receive_json()
        ws.send_json({"type": "stop"})
        fim = ws.receive_json()

    assert fim["report"]["comparison"]["ratio"] == 1.74
    assert fim["report"]["comparison"]["passed"] is True
