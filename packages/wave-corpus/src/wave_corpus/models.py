"""Modelos do índice do corpus (SQLAlchemy 2.0).

O banco guarda **apenas metadados e ponteiros** (ADR-0030): quem/como captou
(`device`, `montagem`, `fs`, `condição`, `poor_signal`) e onde o sinal está
(`content_hash` + `path` no store Parquet). O **sinal nunca** é gravado no banco.

Dialeto-agnóstico: roda em Postgres (deployment) e SQLite (local/testes).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy import JSON, DateTime
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ResearchSession(Base):
    """Uma sessão de captação de pesquisa (sintético ou autocaptação do dev)."""

    __tablename__ = "research_session"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    #: Aparelho de origem (comparabilidade entre devices — ADR-0033).
    device: Mapped[str] = mapped_column(String(120))
    #: Rótulos de canal, em ordem (ex.: ["FP1"] no NeuroSky). NeuroSky = N=1.
    montage: Mapped[list] = mapped_column(JSON)
    fs: Mapped[float] = mapped_column(Float)
    #: Condição experimental (ex.: "olhos_fechados"); opcional.
    experimental_condition: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    #: Indicador de qualidade nativo agregado da sessão; opcional.
    poor_signal: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    artifacts: Mapped[List["Artifact"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class Artifact(Base):
    """Ponteiro para um `Frame` no store (raw / janela / features)."""

    __tablename__ = "artifact"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("research_session.id"))
    #: Tipo do artefato: "raw" | "window" | "features".
    kind: Mapped[str] = mapped_column(String(32))
    #: Endereço de conteúdo no store Parquet (ver ContentAddressedStore).
    content_hash: Mapped[str] = mapped_column(String(64))
    path: Mapped[str] = mapped_column(String(500))
    n_channels: Mapped[int] = mapped_column(Integer)
    n_samples: Mapped[int] = mapped_column(Integer)

    session: Mapped["ResearchSession"] = relationship(back_populates="artifacts")
