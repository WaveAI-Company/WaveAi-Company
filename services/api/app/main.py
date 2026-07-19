"""Aplicação FastAPI da API do WaveAI (esqueleto do MVP).

Nesta fase (M0) expõe apenas o health check. Auth (JWT/papéis), CRUD de
domínio e o gateway WebSocket entram nas issues seguintes.
"""

from __future__ import annotations

from fastapi import FastAPI

from . import __version__
from .api import auth_router
from .config import get_settings

# Fail-closed: sem WAVEAI_API_JWT_SECRET válido a app nem sobe (ADR-0023).
settings = get_settings()

app = FastAPI(title=settings.app_name, version=__version__)
app.include_router(auth_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Health check do serviço. Não expõe dado sensível."""
    return {"status": "ok"}
