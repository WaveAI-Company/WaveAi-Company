"""Camada HTTP."""

from .annotations import router as annotations_router
from .auth import router as auth_router
from .care_links import router as care_links_router
from .live import router as live_router
from .profile_photos import router as profile_photos_router
from .results import router as results_router
from .stream import router as stream_router

__all__ = [
    "annotations_router",
    "auth_router",
    "care_links_router",
    "live_router",
    "profile_photos_router",
    "results_router",
    "stream_router",
]
