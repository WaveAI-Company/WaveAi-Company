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
        #: Filas do próprio titular: recebem sempre (é o dado dele).
        self._titulares: dict[uuid.UUID, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        #: Filas de espectador (profissional): só recebem se compartilhado.
        self._espectadores: dict[uuid.UUID, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._fila_max = fila_max

    @staticmethod
    def _entregar(filas: set[asyncio.Queue[dict[str, Any]]], event: dict[str, Any]) -> None:
        for fila in list(filas):
            try:
                fila.put_nowait(event)
            except asyncio.QueueFull:
                # Assinante lento perde a janela; a captação segue intacta.
                pass

    def publish(
        self, patient_id: uuid.UUID, event: dict[str, Any], *, compartilhado: bool = False
    ) -> None:
        """Entrega o evento aos assinantes do paciente. Não bloqueia.

        `compartilhado` vem de quem publica, que tem a sessão em mãos (ADR-0045).
        **Falso por padrão de propósito:** um chamador que esqueça o parâmetro
        deixa de compartilhar, em vez de compartilhar sem autorização.
        """
        self._entregar(self._titulares.get(patient_id, set()), event)
        if compartilhado:
            self._entregar(self._espectadores.get(patient_id, set()), event)

    def publicar_compartilhamento(self, patient_id: uuid.UUID, compartilhado: bool) -> None:
        """Avisa **só os espectadores** que a chave do titular mudou (ADR-0045).

        Ao receber `shared: false`, o stream do profissional encerra. O do
        titular não é afetado — e por isso este evento nunca entra na fila dele.
        """
        self._entregar(
            self._espectadores.get(patient_id, set()),
            {"type": "share", "shared": compartilhado},
        )

    @asynccontextmanager
    async def subscribe(
        self, patient_id: uuid.UUID, *, espectador: bool = False
    ) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        """Assina o canal do paciente; remove a fila ao sair do contexto."""
        registro = self._espectadores if espectador else self._titulares
        fila: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self._fila_max)
        registro[patient_id].add(fila)
        try:
            yield fila
        finally:
            restantes = registro.get(patient_id)
            if restantes is not None:
                restantes.discard(fila)
                if not restantes:
                    registro.pop(patient_id, None)

    def subscriber_count(self, patient_id: uuid.UUID) -> int:
        """Assinantes de qualquer classe (diagnóstico e testes)."""
        return len(self._titulares.get(patient_id, ())) + len(
            self._espectadores.get(patient_id, ())
        )


def publicar_janela(
    bus: LiveBus,
    patient_id: uuid.UUID,
    session_id: uuid.UUID,
    resposta: dict[str, Any],
    *,
    compartilhado: bool = False,
) -> None:
    """Traduz a resposta do gateway em eventos ao vivo e publica (ADR-0039).

    Publica **o mesmo** que já foi ao capturador: features transparentes e/ou
    eSense rotulado; no `stop`, o `closed` com o relatório e o status de
    armazenamento. **Nunca** o raw.
    """
    sid = str(session_id)
    if "features" in resposta:
        bus.publish(
            patient_id,
            {"type": "features", "session_id": sid, "features": resposta["features"]},
            compartilhado=compartilhado,
        )
    if "esense" in resposta:
        bus.publish(
            patient_id,
            {"type": "esense", "session_id": sid, "esense": resposta["esense"]},
            compartilhado=compartilhado,
        )
    if resposta.get("type") == "closed":
        bus.publish(
            patient_id,
            {
                "type": "closed",
                "session_id": sid,
                "report": resposta.get("report"),
                "result": resposta.get("result"),
            },
            compartilhado=compartilhado,
        )


def publicar_encerrada(
    bus: LiveBus,
    patient_id: uuid.UUID,
    session_id: uuid.UUID,
    *,
    compartilhado: bool = False,
) -> None:
    """Sinaliza que a captação parou sem `stop` (queda).

    Chega ao espectador **só se a sessão estava compartilhada**: quem não podia
    ver a captação também não precisa saber que ela caiu.
    """
    bus.publish(
        patient_id,
        {"type": "ended", "session_id": str(session_id)},
        compartilhado=compartilhado,
    )


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
