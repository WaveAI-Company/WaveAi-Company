"""Espectador ao vivo (ADR-0039): assinatura SSE das janelas de uma captação.

O gateway `/stream` publica cada janela no `LiveBus`; aqui o **titular** assiste à
própria sessão e o **profissional** assiste via CareLink ativo (auditado). Só
features/eSense rotulado, **nunca raw** (ADR-0025/0034); sem veredito (ADR-0027).

**Transporte:** Server-Sent Events (só servidor→cliente). A autenticação usa o
**Bearer** que o app já emite (o único cookie do sistema é o refresh, escopado em
`/auth`); o cliente web lê o stream via `fetch` com o header `Authorization` — a
mesma intenção do ADR (SSE read-only, sem token na URL, reusando a auth do app).

TODO(nuvem): o SSE mantém a conexão do banco aberta durante a transmissão (a
sessão do request só fecha no fim). Aceitável para poucos espectadores por
instância; ao escalar, usar sessão de vida curta / driver assíncrono.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db.session import get_session
from ..models.user import User, UserRole
from ..repositories.session import CaptureSessionRepository
from ..services.live_bus import LiveBus, get_live_bus
from ..services.live_view import LiveViewService
from .deps import require_active_care_link, require_role

router = APIRouter(tags=["live"])

#: Cabeçalhos do stream SSE. `X-Accel-Buffering: no` desliga o buffering do nginx,
#: que senão seguraria os eventos.
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}
#: Sem evento por este tempo, manda um comentário de keepalive (mantém a conexão
#: viva através de proxies) e checa se o cliente ainda está ali.
KEEPALIVE_SEGUNDOS = 15.0


def _sse(evento: str, dados: dict[str, Any]) -> str:
    return f"event: {evento}\ndata: {json.dumps(dados)}\n\n"


async def _transmitir(
    bus: LiveBus, patient_id: uuid.UUID, request: Request, ativa: bool
) -> AsyncIterator[str]:
    """Gera o stream SSE: status inicial, depois as janelas do paciente."""
    async with bus.subscribe(patient_id) as fila:
        # Evento inicial: o espectador já sabe se há captação ao vivo agora.
        yield _sse("status", {"live": ativa})
        while True:
            if await request.is_disconnected():
                return
            try:
                evento = await asyncio.wait_for(fila.get(), timeout=KEEPALIVE_SEGUNDOS)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue
            yield _sse(str(evento.get("type", "message")), evento)


@router.get("/me/live")
async def minha_transmissao(
    request: Request,
    user: User = Depends(require_role(UserRole.PATIENT)),
    session: Session = Depends(get_session),
    bus: LiveBus = Depends(get_live_bus),
) -> StreamingResponse:
    """Titular assiste à **própria** captação ao vivo (sem CareLink — é seu dado)."""
    ativa = CaptureSessionRepository(session).ativa_do_paciente(user.id) is not None
    return StreamingResponse(
        _transmitir(bus, user.id, request, ativa),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.get("/patients/{patient_id}/live")
async def transmissao_do_paciente(
    patient_id: uuid.UUID,
    request: Request,
    paciente: User = Depends(require_active_care_link),
    ator: User = Depends(require_role(UserRole.DOCTOR)),
    session: Session = Depends(get_session),
    bus: LiveBus = Depends(get_live_bus),
) -> StreamingResponse:
    """Profissional assiste à captação ao vivo do paciente (CareLink + auditado)."""
    sessions = CaptureSessionRepository(session)
    ativa = sessions.ativa_do_paciente(paciente.id)
    # Auditoria (ADR-0039): registra que o profissional abriu a transmissão.
    LiveViewService(session).registrar_acesso(
        patient_id=paciente.id,
        actor_id=ator.id,
        session_id=ativa.id if ativa is not None else None,
    )
    session.commit()
    return StreamingResponse(
        _transmitir(bus, paciente.id, request, ativa is not None),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
