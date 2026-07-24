"""wave-corpus — corpus de pesquisa do WaveAI (ADR-0030).

Store Parquet content-addressed (raw + janelas) + índice de metadados,
**fisicamente separado** da produção. Alimentado só por sintético e
autocaptação do dev (ADR-0028); nunca recebe dado de terceiro sem novo
protocolo. A tétrade de proveniência (commit/DVC/engine/hiperparâmetros) e a
ingestão entram na N4-b.
"""
from __future__ import annotations

from .config import CorpusSettings
from .dvc import DvcLocalRepo, LocalRemote, dvc_available
from .frame import Frame
from .gitref import current_commit
from .index import CorpusIndex
from .ingest import ingest_frame
from .models import Artifact, Base, ResearchResult, ResearchSession
from .provenance import Provenance
from .store import ContentAddressedStore

__all__ = [
    "Frame",
    "ContentAddressedStore",
    "CorpusIndex",
    "CorpusSettings",
    "Base",
    "ResearchSession",
    "Artifact",
    "ResearchResult",
    "Provenance",
    "ingest_frame",
    "current_commit",
    "LocalRemote",
    "DvcLocalRepo",
    "dvc_available",
]
