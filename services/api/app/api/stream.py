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
from ..models import CaptureSession
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


def _compartilhamento_agora(db: Session, sessao: CaptureSession) -> bool:
    """Relê `live_sharing_enabled` **do banco**, e não do objeto em memória.

    O objeto da sessão é carregado uma única vez, no `start` do stream, e vive
    pela conexão WebSocket inteira. Quem liga o compartilhamento é **outra**
    requisição — `PUT /me/sessions/{id}/live-sharing` —, com outra sessão do
    SQLAlchemy: sem expirar o campo, esta conexão segue enxergando o valor de
    quando a captação começou.

    E esse valor é sempre `False`: toda sessão nasce sem compartilhamento
    (ADR-0045), então ligar **durante** a captação é o único caminho que
    existe. Na prática o espectador recebia o `status` dizendo `shared: true`
    (esse vem do banco, por outra rota) e nunca recebia uma janela sequer —
    ficava preso em "aguardando a primeira leitura".

    O custo é um `SELECT` de uma coluna por janela publicada (uma a cada ~2 s
    por captação em curso), contra a alternativa de o barramento guardar um
    espelho do estado — que é justamente o que a ADR-0045 evita, para um
    reinício da API não decidir sozinho quem vê o quê.
    """
    db.expire(sessao, ["live_sharing_enabled"])
    return sessao.live_sharing_enabled


def _publicar_ao_vivo(
    bus: LiveBus, protocolo: StreamProtocol, resposta: dict, db: Session
) -> None:
    """Espelha a resposta do gateway para os espectadores ao vivo (ADR-0039).

    Quem publica informa se a sessão está **compartilhada** (ADR-0045): a
    fonte da verdade é a linha da sessão no banco, relida a cada janela.
    """
    user = protocolo.state.user
    sessao = protocolo.state.session
    if user is None or sessao is None:
        return
    publicar_janela(
        bus,
        user.id,
        sessao.id,
        resposta,
        compartilhado=_compartilhamento_agora(db, sessao),
    )


def _publicar_encerrada_se_ativa(
    bus: LiveBus, protocolo: StreamProtocol, db: Session
) -> None:
    """Avisa os espectadores que a captação parou (queda sem `stop`)."""
    user = protocolo.state.user
    sessao = protocolo.state.session
    if user is None or sessao is None:
        return
    publicar_encerrada(
        bus, user.id, sessao.id, compartilhado=_compartilhamento_agora(db, sessao)
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
            _publicar_ao_vivo(bus, protocolo, resposta, db)

            if protocolo.state.encerrada:
                await websocket.close()
                return

    except StreamError as erro:
        # Motivo genérico: não diz se o token expirou, é de outro papel etc.
        await websocket.send_json({"type": "error", "detail": erro.reason})
        await websocket.close(code=erro.code.value, reason=erro.reason)
        protocolo.abortar()
        _publicar_encerrada_se_ativa(bus, protocolo, db)
    except TimeoutError:
        await websocket.close(
            code=CloseCode.NAO_AUTENTICADO.value, reason="autenticacao expirou"
        )
        protocolo.abortar()
        _publicar_encerrada_se_ativa(bus, protocolo, db)
    except WebSocketDisconnect:
        # Queda no meio da captação: a sessão não pode ficar ativa para sempre.
        protocolo.abortar()
        _publicar_encerrada_se_ativa(bus, protocolo, db)
