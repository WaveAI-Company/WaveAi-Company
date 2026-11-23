"""Cifragem em repouso do `Result` (ADR-0026).

Dados biométricos derivados são tratados como **sensíveis** mesmo no
enquadramento não-clínico (Medical/71). As métricas são cifradas antes de
tocar o banco: vazar o dump não entrega o conteúdo.

Fernet (AES-128-CBC + HMAC, da lib `cryptography`) — autenticado, com chave
via ambiente. A chave é **fail-closed**: sem ela, a app não sobe.

**Rotação (emenda à ADR-0026):** a chave atual (`result_encryption_key`) é a
única que cifra; as anteriores (`result_encryption_previous_keys`) só decifram,
por `MultiFernet`. Trocar a chave deixa de tornar ilegível tudo o que já foi
gravado, e `scripts/rotate_result_key.py` re-cifra o acervo com a atual para
que a anterior possa sair do ambiente.
"""

from __future__ import annotations

import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from ..config import Settings, get_settings


class MetricsCipher:
    """Cifra/decifra o dict de métricas de um `Result`."""

    def __init__(self, key: str, previous_keys: list[str] | None = None) -> None:
        # Levanta se alguma chave não for um Fernet key válido (base64 urlsafe,
        # 32B). A PRIMEIRA cifra; as demais só decifram.
        chaves = [key, *(previous_keys or [])]
        self._fernet = MultiFernet([Fernet(c.encode("utf-8")) for c in chaves])

    def encrypt(self, metrics: dict[str, Any]) -> bytes:
        bruto = json.dumps(metrics, ensure_ascii=False, sort_keys=True).encode("utf-8")
        return self._fernet.encrypt(bruto)

    def decrypt(self, blob: bytes) -> dict[str, Any]:
        try:
            bruto = self._fernet.decrypt(blob)
        except InvalidToken as exc:  # pragma: no cover - corrupção/chave errada
            raise ValueError("nao foi possivel decifrar o Result") from exc
        return json.loads(bruto.decode("utf-8"))

    def rotate(self, blob: bytes) -> bytes:
        """Re-cifra `blob` com a chave atual, seja qual for a que o cifrou."""
        try:
            return self._fernet.rotate(blob)
        except InvalidToken as exc:
            raise ValueError("nao foi possivel decifrar o Result para rotacionar") from exc


def get_metrics_cipher(settings: Settings | None = None) -> MetricsCipher:
    settings = settings or get_settings()
    return MetricsCipher(
        settings.result_encryption_key, settings.result_encryption_previous_key_list
    )
