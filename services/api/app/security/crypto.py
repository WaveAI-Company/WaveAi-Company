"""Cifragem em repouso do `Result` (ADR-0026).

Dados biométricos derivados são tratados como **sensíveis** mesmo no
enquadramento não-clínico (Medical/71). As métricas são cifradas antes de
tocar o banco: vazar o dump não entrega o conteúdo.

Fernet (AES-128-CBC + HMAC, da lib `cryptography`) — autenticado, com chave
única via ambiente. A chave é **fail-closed**: sem ela, a app não sobe.

TODO(rotação de chave): Fernet suporta MultiFernet para rotacionar sem
reprocessar tudo; entra quando houver operação real.
"""

from __future__ import annotations

import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from ..config import Settings, get_settings


class MetricsCipher:
    """Cifra/decifra o dict de métricas de um `Result`."""

    def __init__(self, key: str) -> None:
        # Levanta se a chave não for um Fernet key válido (base64 urlsafe, 32B).
        self._fernet = Fernet(key.encode("utf-8"))

    def encrypt(self, metrics: dict[str, Any]) -> bytes:
        bruto = json.dumps(metrics, ensure_ascii=False, sort_keys=True).encode("utf-8")
        return self._fernet.encrypt(bruto)

    def decrypt(self, blob: bytes) -> dict[str, Any]:
        try:
            bruto = self._fernet.decrypt(blob)
        except InvalidToken as exc:  # pragma: no cover - corrupção/chave errada
            raise ValueError("nao foi possivel decifrar o Result") from exc
        return json.loads(bruto.decode("utf-8"))


def get_metrics_cipher(settings: Settings | None = None) -> MetricsCipher:
    settings = settings or get_settings()
    return MetricsCipher(settings.result_encryption_key)
