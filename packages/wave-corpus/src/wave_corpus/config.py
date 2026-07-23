"""Configuração do corpus de pesquisa (prefixo `WAVEAI_CORPUS_`).

O corpus é **fisicamente separado** da produção (ADR-0030): banco e diretório
próprios, alimentados só por sintético/autocaptação do dev (ADR-0028). Aqui isso
é **fail-closed**: se `WAVEAI_CORPUS_DATABASE_URL` apontar para o mesmo banco da
produção (`WAVEAI_API_DATABASE_URL`), a configuração **recusa** carregar — o
mesmo padrão fail-closed dos segredos da API (ADR-0023).
"""
from __future__ import annotations

import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Env do banco de PRODUÇÃO (services/api). O corpus recusa reusá-la.
PRODUCTION_DB_ENV = "WAVEAI_API_DATABASE_URL"


class CorpusSettings(BaseSettings):
    """Config lida do ambiente. Deployment usa Postgres; local/testes, SQLite."""

    model_config = SettingsConfigDict(
        env_prefix="WAVEAI_CORPUS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: Diretório do store Parquet (content-addressed). Gitignored; descartável.
    root: str = "_corpus"
    #: Índice/metadados. Postgres em deployment (ADR-0030); SQLite em local/teste.
    database_url: str = "sqlite:///_corpus/index.db"

    @model_validator(mode="after")
    def _separado_da_producao(self) -> "CorpusSettings":
        prod = os.environ.get(PRODUCTION_DB_ENV)
        if prod and prod == self.database_url:
            raise ValueError(
                "WAVEAI_CORPUS_DATABASE_URL não pode ser o mesmo banco da produção "
                f"({PRODUCTION_DB_ENV}): o corpus de pesquisa é fisicamente separado "
                "(ADR-0030)."
            )
        return self
