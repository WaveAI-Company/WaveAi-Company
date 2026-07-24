"""Referência ao commit atual, para a tétrade de proveniência (ADR-0030)."""
from __future__ import annotations

import subprocess


def current_commit(default: str = "unknown") -> str:
    """Hash do commit HEAD, ou `default` se não houver git (corpus descartável)."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
        return out.stdout.strip() or default
    except Exception:
        return default
