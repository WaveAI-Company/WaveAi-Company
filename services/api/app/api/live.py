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

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db.session import get_session
from ..models.live_share import LiveShareEvent
from ..models.session import SessionStatus
from ..models.user import User, UserRole
from ..repositories.session import CaptureSessionRepository
from ..services.live_bus import LiveBus, get_live_bus
from ..services.live_view import LiveViewService
from .deps import require_active_care_link, require_role
from .schemas import LiveSharingRequest

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
    bus: LiveBus,
    patient_id: uuid.UUID,
    request: Request,
    ativa: bool,
    *,
    espectador: bool = False,
    compartilhado: bool = True,
) -> AsyncIterator[str]:
    """Gera o stream SSE: status inicial, depois as janelas do paciente.

    Para o **espectador** (ADR-0045), o `status` leva também `shared`, e um
    evento `share` com `shared: false` **encerra** o stream: o titular desligou
    no meio, e a transmissão para na hora. O titular nunca recebe esse evento —
    a chave não governa o acesso dele ao próprio dado.
    """
    async with bus.subscribe(patient_id, espectador=espectador) as fila:
        # Evento inicial: quem assiste já sabe se há captação agora — e, sendo
        # espectador, se ela está sendo compartilhada.
        inicial: dict[str, Any] = {"live": ativa}
        if espectador:
            inicial["shared"] = compartilhado
        yield _sse("status", inicial)
        while True:
            if await request.is_disconnected():
                return
            try:
                evento = await asyncio.wait_for(fila.get(), timeout=KEEPALIVE_SEGUNDOS)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue
            yield _sse(str(evento.get("type", "message")), evento)
            if espectador and evento.get("type") == "share" and not evento.get("shared"):
                return


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


@router.put("/me/sessions/{session_id}/live-sharing")
def definir_compartilhamento(
    session_id: uuid.UUID,
    payload: LiveSharingRequest,
    user: User = Depends(require_role(UserRole.PATIENT)),
    session: Session = Depends(get_session),
    bus: LiveBus = Depends(get_live_bus),
) -> dict:
    """Titular liga/desliga o compartilhamento ao vivo **desta** sessão (ADR-0045).

    Só o dono da sessão decide, e só enquanto ela está **ativa**: compartilhar
    uma captação encerrada não significaria nada, e permitir isso abriria a
    porta para "autorizar depois" algo que já aconteceu.

    Desligar **corta na hora**: os espectadores recebem o aviso e o stream deles
    encerra, sem esperar a próxima janela.
    """
    sessao = CaptureSessionRepository(session).get(session_id)
    if sessao is None or sessao.patient_user_id != user.id:
        # Mesma resposta para "não existe" e "não é sua": nada de virar oráculo
        # de sessões alheias (ADR-0024).
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="sessao nao encontrada"
        )
    if sessao.status is not SessionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="sessao nao esta ativa"
        )

    if sessao.live_sharing_enabled != payload.enabled:
        sessao.live_sharing_enabled = payload.enabled
        # Cada gesto vira linha na trilha — não só o estado final (ADR-0045).
        session.add(
            LiveShareEvent(
                patient_user_id=user.id, session_id=sessao.id, enabled=payload.enabled
            )
        )
        session.commit()
        bus.publicar_compartilhamento(user.id, payload.enabled)

    return {"session_id": str(sessao.id), "live_sharing_enabled": sessao.live_sharing_enabled}


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
    # Auditoria (ADR-0039): registra que o profissional abriu a transmissão —
    # inclusive quando não há compartilhamento, porque a **tentativa** de olhar
    # também é informação da trilha.
    LiveViewService(session).registrar_acesso(
        patient_id=paciente.id,
        actor_id=ator.id,
        session_id=ativa.id if ativa is not None else None,
    )
    session.commit()
    return StreamingResponse(
        _transmitir(
            bus,
            paciente.id,
            request,
            ativa is not None,
            espectador=True,
            # Sem captação ativa não há o que compartilhar; com ela, quem manda é
            # a chave que o titular ligou nesta sessão (ADR-0045).
            compartilhado=ativa is not None and ativa.live_sharing_enabled,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
