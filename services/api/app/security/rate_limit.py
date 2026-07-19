"""Rate limiting do login (ADR-0023).

Janela deslizante **in-memory**. Aplicado **antes** do Argon2: sem isso, cada
tentativa custaria ~19 MiB de RAM ao servidor, transformando o hash forte num
vetor de DoS.

LIMITAÇÃO CONHECIDA (aceita no MVP): o estado é por processo. Com várias
réplicas cada uma conta em separado.
TODO(#19): migrar para Redis (limiter distribuído), lockout de conta, backoff
e auditoria de falhas.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    """Conta tentativas por chave dentro de uma janela deslizante."""

    def __init__(self, *, max_attempts: int, window_seconds: int) -> None:
        self._max_attempts = max_attempts
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        limite = now - self._window
        while hits and hits[0] <= limite:
            hits.popleft()
        return hits

    def is_allowed(self, key: str, *, now: float | None = None) -> bool:
        """Registra a tentativa e diz se ela pode prosseguir."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._prune(key, now)
            if len(hits) >= self._max_attempts:
                return False
            hits.append(now)
            return True

    def reset(self, key: str) -> None:
        """Limpa o histórico (ex.: após login bem-sucedido)."""
        with self._lock:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()
