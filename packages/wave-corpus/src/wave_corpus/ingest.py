"""Ingestão no corpus — **idempotente por conteúdo** (ADR-0030).

O identificador do dataset é o hash de conteúdo do `Frame` (imutável). Reingerir
o mesmo conteúdo **reusa** a sessão/artefato existentes em vez de duplicar — o
store já deduplica os bytes; aqui a idempotência sobe para o nível da sessão.
"""
from __future__ import annotations

from typing import Optional, Tuple

from .frame import Frame
from .index import CorpusIndex


def ingest_frame(
    index: CorpusIndex,
    frame: Frame,
    *,
    device: str,
    condition: Optional[str] = None,
    poor_signal: Optional[float] = None,
) -> Tuple[str, str]:
    """Ingere `frame` no corpus. Retorna `(session_id, dataset_version)`.

    `dataset_version` é o hash de conteúdo (id imutável). Se o conteúdo já está
    no corpus, devolve a sessão existente sem criar nada novo (idempotente).
    """
    content_hash = frame.content_hash()
    existing = index.artifact_by_hash(content_hash)
    if existing is not None:
        return existing.session_id, content_hash

    session_id = index.add_session(
        device=device,
        montage=frame.montage,
        fs=frame.fs,
        experimental_condition=condition,
        poor_signal=poor_signal,
    )
    index.add_frame(session_id, frame)
    return session_id, content_hash
