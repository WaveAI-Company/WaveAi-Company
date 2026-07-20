"""Camada HTTP."""

from .auth import router as auth_router
from .care_links import router as care_links_router
from .results import router as results_router
from .stream import router as stream_router

__all__ = ["auth_router", "care_links_router", "results_router", "stream_router"]
