"""Protocolo do gateway de streaming (#13).

Separado da camada WebSocket de propósito: aqui está a **máquina de estados**,
testável sem abrir socket. `app/api/stream.py` só faz o transporte.

Protocolo (JSON, cliente → servidor):
    1. {"type": "auth",    "token": "<access token>"}
    2. {"type": "start",   "device": "mindwave-mobile-2", "sample_rate": 512}
    3. {"type": "samples", "seq": 1, "data": [ints...]}   (repetido)
    4. {"type": "stop"}

**Por que o token vem numa mensagem e não na URL (ADR-0025):** query strings
vazam em log de servidor, proxy e histórico. Navegador não deixa definir
cabeçalho em WebSocket, então a primeira mensagem é o lugar seguro (ADR-0021:
nada de credencial em lugar registrável). Nenhum frame de dados é processado
antes do `auth`, e a sessão criada pertence sempre ao usuário autenticado.

Em produção o transporte é **wss://** (TLS) — sem isso o token trafega em claro.

TODO(ADR-0025): access token que expira **no meio** de uma captação longa.
As capturas do MVP são curtas (minutos) e o access dura 15 min, então o caso
não aparece ainda; quando aparecer, a saída é um frame de re-auth no protocolo.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from ..config import Settings
from ..models.session import CaptureSession, SessionStatus
from ..models.user import User, UserRole
from ..repositories.session import CaptureSessionRepository
from ..repositories.user import UserRepository
from ..security.password import PasswordHasher
from ..security.tokens import InvalidTokenError, decode_access_token
from .analysis_client import AnalysisClient, AnalysisUnavailableError
from .results import ConsentRequiredError, ResultService


class CloseCode(int, enum.Enum):
    """Códigos de fechamento (faixa 4000+ é de uso da aplicação)."""

    POLICY_VIOLATION = 1008
    NAO_AUTENTICADO = 4001
    PAPEL_INVALIDO = 4003
    PROTOCOLO_INVALIDO = 4400
    LIMITE_EXCEDIDO = 4413


class StreamError(Exception):
    """Encerra o stream com um código e um motivo genérico."""

    def __init__(self, code: CloseCode, reason: str) -> None:
        super().__init__(reason)
        self.code = code
        self.reason = reason


@dataclass
class StreamState:
    user: User | None = None
    session: CaptureSession | None = None
    encerrada: bool = False
    #: Sinal acumulado desde a última análise ao vivo (não é persistido).
    buffer: list[float] = field(default_factory=list)
    #: Sessão inteira, para o relatório em batch no `stop`. Vive **só em
    #: memória** durante a captação — nunca é gravado em disco (ADR-0025). É
    #: descartado ao encerrar; o que persiste é o Result derivado.
    session_samples: list[float] = field(default_factory=list)


class StreamProtocol:
    """Máquina de estados de uma conexão de stream."""

    def __init__(
        self,
        *,
        db: Session,
        settings: Settings,
        hasher: PasswordHasher,
        analysis: AnalysisClient | None = None,
        results: "ResultService | None" = None,
    ) -> None:
        self._db = db
        self._settings = settings
        self._users = UserRepository(db, hasher)
        self._sessions = CaptureSessionRepository(db)
        self._analysis = analysis
        self._results = results
        self.state = StreamState()

    # -- entrada ---------------------------------------------------------

    def handle(self, message: Any) -> dict[str, Any]:
        """Processa uma mensagem e devolve a resposta a enviar."""
        if not isinstance(message, dict):
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "mensagem invalida")

        tipo = message.get("type")
        if self.state.user is None:
            # Nada além de `auth` antes de autenticar.
            if tipo != "auth":
                raise StreamError(CloseCode.NAO_AUTENTICADO, "autenticacao requerida")
            return self._auth(message)

        if tipo == "start":
            return self._start(message)
        if tipo == "samples":
            return self._samples(message)
        if tipo == "stop":
            return self._stop()
        if tipo == "auth":
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "ja autenticado")
        raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "tipo desconhecido")

    # -- passos ----------------------------------------------------------

    def _auth(self, message: dict[str, Any]) -> dict[str, Any]:
        token = message.get("token")
        if not isinstance(token, str) or not token:
            raise StreamError(CloseCode.NAO_AUTENTICADO, "token ausente")
        try:
            claims = decode_access_token(token, self._settings)
        except InvalidTokenError:
            raise StreamError(CloseCode.NAO_AUTENTICADO, "token invalido") from None

        user = self._users.get_by_id(claims.user_id)
        if user is None or not user.is_active:
            raise StreamError(CloseCode.NAO_AUTENTICADO, "token invalido")
        if user.role is not UserRole.PATIENT:
            # Só o paciente capta o próprio sinal; um médico não abre sessão
            # em nome de ninguém.
            raise StreamError(CloseCode.PAPEL_INVALIDO, "papel sem permissao")

        # Nota deliberada: **não** há checagem de CareLink aqui. O consentimento
        # (ADR-0024) governa a *leitura pelo médico*, não o direito do paciente
        # de captar o próprio sinal. Exigir vínculo para capturar impediria a
        # pessoa de usar os próprios dados — não "corrigir" isso adicionando um
        # require_active_care_link.

        self.state.user = user
        return {"type": "auth_ok"}

    def _start(self, message: dict[str, Any]) -> dict[str, Any]:
        if self.state.session is not None:
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "sessao ja iniciada")

        device = message.get("device")
        if not isinstance(device, str) or not device.strip():
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "device ausente")

        sample_rate = message.get("sample_rate")
        if not isinstance(sample_rate, int) or not (
            0 < sample_rate <= self._settings.stream_max_sample_rate
        ):
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "sample_rate invalido")

        assert self.state.user is not None
        sessao = self._sessions.abrir(
            patient=self.state.user,
            device=device.strip()[:64],
            sample_rate=sample_rate,
        )
        self._db.commit()
        self.state.session = sessao
        return {"type": "session", "session_id": str(sessao.id)}

    def _samples(self, message: dict[str, Any]) -> dict[str, Any]:
        sessao = self.state.session
        if sessao is None:
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "sessao nao iniciada")

        data = message.get("data")
        if not isinstance(data, list) or not data:
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "bloco vazio")
        if len(data) > self._settings.stream_max_block_samples:
            # Sem teto, um cliente enche a memória do servidor num bloco só.
            raise StreamError(CloseCode.LIMITE_EXCEDIDO, "bloco grande demais")
        if not all(isinstance(v, (int, float)) for v in data):
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "amostras nao numericas")

        if sessao.sample_count + len(data) > self._settings.stream_max_session_samples:
            raise StreamError(CloseCode.LIMITE_EXCEDIDO, "sessao longa demais")

        self._sessions.somar_amostras(sessao, len(data))
        self._db.commit()

        # Guarda a sessão inteira em memória para o relatório em batch do stop.
        # O teto já foi validado acima (sessão longa demais é recusada).
        if self._results is not None:
            self.state.session_samples.extend(float(v) for v in data)

        resposta: dict[str, Any] = {
            "type": "ack",
            "seq": message.get("seq"),
            "received": len(data),
            "total": sessao.sample_count,
        }

        features = self._analisar_se_completou_janela(data, sessao.sample_rate)
        if features is not None:
            resposta["features"] = features
        return resposta

    def _analisar_se_completou_janela(
        self, data: list[float], sample_rate: int
    ) -> dict[str, Any] | None:
        """Acumula e, ao fechar uma janela, pede as features à Analysis.

        O buffer guarda apenas o sinal **desde a última leitura**: janelas não
        se sobrepõem e nada de raw fica retido além do necessário.
        """
        if self._analysis is None:
            return None

        self.state.buffer.extend(float(v) for v in data)
        janela = int(sample_rate * self._settings.stream_window_seconds)
        if janela <= 0 or len(self.state.buffer) < janela:
            return None

        amostras = self.state.buffer[:janela]
        del self.state.buffer[:janela]

        try:
            return self._analysis.analyze_window(amostras, float(sample_rate))
        except AnalysisUnavailableError:
            # Perder o "ao vivo" é aceitável; perder a sessão do paciente não.
            # A captação segue e o cliente fica sabendo que não há features.
            return {"unavailable": True}

    def _stop(self) -> dict[str, Any]:
        sessao = self.state.session
        if sessao is None:
            raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "sessao nao iniciada")

        report = self._gerar_e_persistir_result(sessao)

        self._sessions.encerrar(sessao, status=SessionStatus.COMPLETED)
        self._db.commit()
        self.state.encerrada = True
        # Descarta o raw da memória assim que o Result (derivado) foi tratado.
        self.state.session_samples = []

        resposta = {
            "type": "closed",
            "session_id": str(sessao.id),
            "sample_count": sessao.sample_count,
            "result": report,
        }
        return resposta

    def _gerar_e_persistir_result(self, sessao: CaptureSession) -> dict[str, Any]:
        """Ao encerrar: process_session sobre a sessão inteira → Result cifrado.

        Nunca deixa a falha aqui abortar o encerramento da sessão — o relatório
        é um extra sobre a captação, não pré-requisito dela.
        """
        if self._results is None or self._analysis is None:
            return {"persisted": False, "reason": "indisponivel"}
        if self.state.user is None or not self.state.session_samples:
            return {"persisted": False, "reason": "sem amostras"}

        try:
            metrics = self._analysis.analyze_session(
                self.state.session_samples, float(sessao.sample_rate)
            )
        except AnalysisUnavailableError:
            return {"persisted": False, "reason": "analise indisponivel"}

        try:
            result = self._results.persistir(
                patient=self.state.user, session_id=sessao.id, metrics=metrics
            )
        except ConsentRequiredError:
            # Gate ADR-0026: sem consentimento, o dado derivado não é gravado.
            return {"persisted": False, "reason": "sem consentimento"}

        if result is None:
            return {"persisted": False, "reason": "persistencia desligada"}
        return {"persisted": True, "result_id": str(result.id)}

    # -- desconexão ------------------------------------------------------

    def abortar(self) -> None:
        """Conexão caiu sem `stop`: a sessão não pode ficar eternamente ativa."""
        sessao = self.state.session
        if sessao is None or self.state.encerrada:
            return
        self._sessions.encerrar(sessao, status=SessionStatus.ABORTED)
        self._db.commit()
