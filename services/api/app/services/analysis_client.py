"""Cliente do serviço de Analysis (#14).

O gateway **não analisa nada**: encaminha a janela e devolve o resultado. Toda
a ciência vive atrás do `AnalysisEngine`, no outro serviço (regra rígida: não
espalhar DSP pela API).

Falha aqui **não derruba a captação**. Se a Analysis estiver fora, a sessão
continua gravando metadados e o cliente é avisado de que as features estão
indisponíveis — perder o "ao vivo" é aceitável; perder a sessão do paciente não.
"""

from __future__ import annotations

from typing import Any, Protocol

import httpx


class AnalysisUnavailableError(Exception):
    """Analysis fora do ar, lenta ou respondendo erro."""


class AnalysisClient(Protocol):
    """Contrato do cliente — permite substituir por um duplo nos testes."""

    def analyze_window(self, samples: list[float], fs: float) -> dict[str, Any]:
        ...

    def analyze_session(
        self, samples: list[float], fs: float, labels: list[str] | None = None
    ) -> dict[str, Any]:
        ...


class HttpAnalysisClient:
    def __init__(self, *, base_url: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    def analyze_window(self, samples: list[float], fs: float) -> dict[str, Any]:
        return self._post("/analyze/window", {"samples": samples, "fs": fs})

    def analyze_session(
        self, samples: list[float], fs: float, labels: list[str] | None = None
    ) -> dict[str, Any]:
        # Timeout maior: a análise de sessão inteira é mais pesada que a janela.
        return self._post(
            "/analyze/session",
            {"samples": samples, "fs": fs, "labels": labels},
            timeout=self._timeout * 6,
        )

    def _post(
        self, path: str, payload: dict[str, Any], timeout: float | None = None
    ) -> dict[str, Any]:
        try:
            resposta = httpx.post(
                f"{self._base_url}{path}",
                json=payload,
                timeout=timeout or self._timeout,
            )
            resposta.raise_for_status()
            return resposta.json()
        except httpx.HTTPError as exc:
            raise AnalysisUnavailableError(str(exc)) from exc
