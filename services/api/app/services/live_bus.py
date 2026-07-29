"""Fan-out das janelas ao vivo, por paciente (ADR-0039).

O gateway `/stream` é 1:1 — as features/eSense de cada janela voltam só ao socket
que capta. Para o **espectador ao vivo** (titular em outra tela; profissional via
CareLink), o gateway **publica** cada janela aqui, e os endpoints SSE assinam.

**Interface pequena de propósito:** `publish` (do gateway) e `subscribe` (do SSE).
A implementação é **in-process** (`asyncio.Queue`). Em nuvem multi-instância, a
troca por **Redis pub/sub** entra atrás desta mesma interface (P5/ADR-0005) — os
chamadores não mudam.

Nunca trafega **raw** (ADR-0025): só o que já vai ao capturador — features
transparentes e eSense rotulado `proprietary` (ADR-0034).
"""

from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

#: Teto da fila por espectador. Cheia = espectador lento; o evento é **descartado**
#: (nunca se trava a captação do paciente por causa de quem assiste).
FILA_MAX = 64


class LiveBus:
    """Publicação/assinatura em processo, com chave por `patient_id`."""

    def __init__(self, *, fila_max: int = FILA_MAX) -> None:
        self._assinantes: dict[uuid.UUID, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._fila_max = fila_max

    def publish(self, patient_id: uuid.UUID, event: dict[str, Any]) -> None:
        """Entrega o evento a todos os assinantes do paciente. Não bloqueia."""
        for fila in list(self._assinantes.get(patient_id, ())):
            try:
                fila.put_nowait(event)
            except asyncio.QueueFull:
                # Espectador lento perde a janela; a captação segue intacta.
                pass

    @asynccontextmanager
    async def subscribe(
        self, patient_id: uuid.UUID
    ) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        """Assina o canal do paciente; remove a fila ao sair do contexto."""
        fila: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self._fila_max)
        self._assinantes[patient_id].add(fila)
        try:
            yield fila
        finally:
            restantes = self._assinantes.get(patient_id)
            if restantes is not None:
                restantes.discard(fila)
                if not restantes:
                    self._assinantes.pop(patient_id, None)

    def subscriber_count(self, patient_id: uuid.UUID) -> int:
        return len(self._assinantes.get(patient_id, ()))


def publicar_janela(
    bus: LiveBus,
    patient_id: uuid.UUID,
    session_id: uuid.UUID,
    resposta: dict[str, Any],
) -> None:
    """Traduz a resposta do gateway em eventos ao vivo e publica (ADR-0039).

    Publica **o mesmo** que já foi ao capturador: features transparentes e/ou
    eSense rotulado; no `stop`, o `closed` com o relatório e o status de
    armazenamento. **Nunca** o raw.
    """
    sid = str(session_id)
    if "features" in resposta:
        bus.publish(patient_id, {"type": "features", "session_id": sid, "features": resposta["features"]})
    if "esense" in resposta:
        bus.publish(patient_id, {"type": "esense", "session_id": sid, "esense": resposta["esense"]})
    if resposta.get("type") == "closed":
        bus.publish(
            patient_id,
            {
                "type": "closed",
                "session_id": sid,
                "report": resposta.get("report"),
                "result": resposta.get("result"),
            },
        )


def publicar_encerrada(bus: LiveBus, patient_id: uuid.UUID, session_id: uuid.UUID) -> None:
    """Sinaliza aos espectadores que a captação parou sem `stop` (queda)."""
    bus.publish(patient_id, {"type": "ended", "session_id": str(session_id)})


#: Barramento único do processo. Uma instância só serve todos os streams e SSE.
_bus: LiveBus | None = None


def get_live_bus() -> LiveBus:
    global _bus
    if _bus is None:
        _bus = LiveBus()
    return _bus


def reset_live_bus() -> None:
    """Usado pelos testes para isolar cenários."""
    global _bus
    _bus = None
