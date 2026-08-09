"""Gateway WebSocket de captação (#13, ADR-0025).

Só transporte: a máquina de estados vive em `services/streaming.py`.

Em produção este endpoint é servido sob **wss://** (TLS). Sem TLS o token da
primeira mensagem trafegaria em claro, o que anularia o cuidado de mantê-lo
fora da URL.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.session import get_session
from ..security.password import PasswordHasher
from ..services.analysis_client import AnalysisClient
from ..services.live_bus import (
    LiveBus,
    get_live_bus,
    publicar_encerrada,
    publicar_janela,
)
from ..services.results import ResultService
from ..services.streaming import CloseCode, StreamError, StreamProtocol
from .deps import get_analysis_client, get_hasher, get_result_service

router = APIRouter(tags=["stream"])


def _publicar_ao_vivo(bus: LiveBus, protocolo: StreamProtocol, resposta: dict) -> None:
    """Espelha a resposta do gateway para os espectadores ao vivo (ADR-0039).

    Quem publica informa se a sessão está **compartilhada** (ADR-0045): o objeto
    da sessão está aqui, e é ele a fonte da verdade — o barramento não guarda
    espelho do estado, para um reinício da API não decidir sozinho.
    """
    user = protocolo.state.user
    sessao = protocolo.state.session
    if user is None or sessao is None:
        return
    publicar_janela(
        bus, user.id, sessao.id, resposta, compartilhado=sessao.live_sharing_enabled
    )


def _publicar_encerrada_se_ativa(bus: LiveBus, protocolo: StreamProtocol) -> None:
    """Avisa os espectadores que a captação parou (queda sem `stop`)."""
    user = protocolo.state.user
    sessao = protocolo.state.session
    if user is None or sessao is None:
        return
    publicar_encerrada(
        bus, user.id, sessao.id, compartilhado=sessao.live_sharing_enabled
    )


@router.websocket("/stream")
async def stream(
    websocket: WebSocket,
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    hasher: PasswordHasher = Depends(get_hasher),
    analysis: AnalysisClient = Depends(get_analysis_client),
    results: ResultService = Depends(get_result_service),
    bus: LiveBus = Depends(get_live_bus),
) -> None:
    """Recebe blocos de sinal bruto de um paciente autenticado.

    Aceita a conexão e **exige autenticação na primeira mensagem**, dentro de
    `stream_auth_timeout_seconds` — conexão anônima parada é recurso preso.
    """
    await websocket.accept()
    protocolo = StreamProtocol(
        db=db, settings=settings, hasher=hasher, analysis=analysis, results=results
    )

    try:
        while True:
            # Antes de autenticar vale o timeout; depois, o cliente pode ficar
            # em silêncio entre blocos sem ser derrubado.
            if protocolo.state.user is None:
                bruto = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=settings.stream_auth_timeout_seconds,
                )
            else:
                bruto = await websocket.receive_text()

            try:
                mensagem = json.loads(bruto)
            except json.JSONDecodeError:
                raise StreamError(CloseCode.PROTOCOLO_INVALIDO, "json invalido") from None

            resposta = protocolo.handle(mensagem)
            await websocket.send_json(resposta)
            # Espelha a janela (features/eSense) ou o `closed` aos espectadores.
            _publicar_ao_vivo(bus, protocolo, resposta)

            if protocolo.state.encerrada:
                await websocket.close()
                return

    except StreamError as erro:
        # Motivo genérico: não diz se o token expirou, é de outro papel etc.
        await websocket.send_json({"type": "error", "detail": erro.reason})
        await websocket.close(code=erro.code.value, reason=erro.reason)
        protocolo.abortar()
        _publicar_encerrada_se_ativa(bus, protocolo)
    except asyncio.TimeoutError:
        await websocket.close(
            code=CloseCode.NAO_AUTENTICADO.value, reason="autenticacao expirou"
        )
        protocolo.abortar()
        _publicar_encerrada_se_ativa(bus, protocolo)
    except WebSocketDisconnect:
        # Queda no meio da captação: a sessão não pode ficar ativa para sempre.
        protocolo.abortar()
        _publicar_encerrada_se_ativa(bus, protocolo)
