"""`CorpusIndex` — costura o índice SQL e o store Parquet (ADR-0030).

Um lado guarda **metadados/ponteiros** (banco); o outro, o **sinal**
(Parquet content-addressed). O banco nunca vê o sinal; o store nunca vê
metadados de sessão. `add_frame` grava nos dois de forma coerente.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Sequence

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from .frame import Frame
from .models import Artifact, Base, ResearchResult, ResearchSession
from .provenance import Provenance
from .store import ContentAddressedStore


class CorpusIndex:
    """Índice de metadados + store de frames do corpus de pesquisa."""

    def __init__(self, database_url: str, root: str | Path) -> None:
        self.engine = create_engine(database_url)
        # expire_on_commit=False: podemos ler atributos já carregados após o commit
        # (ex.: o id recém-gerado) sem um refresh que exigiria a sessão aberta.
        self._Session = sessionmaker(self.engine, expire_on_commit=False)
        self.store = ContentAddressedStore(root)

    def create_all(self) -> None:
        """Cria as tabelas do índice (idempotente)."""
        Base.metadata.create_all(self.engine)

    def add_session(
        self,
        *,
        device: str,
        montage: Sequence[str],
        fs: float,
        experimental_condition: Optional[str] = None,
        poor_signal: Optional[float] = None,
    ) -> str:
        """Registra uma sessão e devolve seu id."""
        with self._Session.begin() as s:
            row = ResearchSession(
                device=device,
                montage=list(montage),
                fs=float(fs),
                experimental_condition=experimental_condition,
                poor_signal=poor_signal,
            )
            s.add(row)
            s.flush()
            return row.id

    def add_frame(self, session_id: str, frame: Frame) -> str:
        """Grava o `frame` no store e registra o ponteiro. Retorna o content_hash."""
        content_hash = self.store.write(frame)
        path = str(self.store.path_for(content_hash))
        with self._Session.begin() as s:
            s.add(
                Artifact(
                    session_id=session_id,
                    kind=frame.kind,
                    content_hash=content_hash,
                    path=path,
                    n_channels=frame.n_channels,
                    n_samples=frame.n_samples,
                )
            )
        return content_hash

    def get_session(self, session_id: str) -> Optional[ResearchSession]:
        with self._Session() as s:
            return s.get(ResearchSession, session_id)

    def artifacts_for(self, session_id: str) -> List[Artifact]:
        with self._Session() as s:
            return list(
                s.scalars(select(Artifact).where(Artifact.session_id == session_id))
            )

    def artifact_by_hash(self, content_hash: str) -> Optional[Artifact]:
        """Primeiro artefato com este `content_hash` (base da ingestão idempotente)."""
        with self._Session() as s:
            return s.scalars(
                select(Artifact).where(Artifact.content_hash == content_hash)
            ).first()

    def add_result(
        self, session_id: str, output_hash: str, provenance: Provenance
    ) -> str:
        """Registra um `ResearchResult` — **só** com a tétrade completa (ADR-0030).

        `provenance` já é validada na construção (fail-closed): sem qualquer das
        quatro âncoras, o `Provenance` nem chega aqui, então nada é persistido.
        """
        with self._Session.begin() as s:
            row = ResearchResult(
                session_id=session_id,
                computation_id=provenance.computation_id(),
                output_hash=output_hash,
                git_commit=provenance.git_commit,
                dataset_version=provenance.dataset_version,
                engine_version=provenance.engine_version,
                hyperparameters=dict(provenance.hyperparameters),
            )
            s.add(row)
            s.flush()
            return row.id

    def results_for(self, session_id: str) -> List[ResearchResult]:
        with self._Session() as s:
            return list(
                s.scalars(
                    select(ResearchResult).where(
                        ResearchResult.session_id == session_id
                    )
                )
            )

    def read_frame(self, content_hash: str) -> Frame:
        """Resolve o ponteiro (hash) para o `Frame` guardado no store."""
        return self.store.read(content_hash)
