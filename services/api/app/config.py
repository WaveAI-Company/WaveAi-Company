"""Configuração do serviço via variáveis de ambiente.

Regras rígidas: segredos só via ambiente; nunca commitar `.env`/chaves.
Ver `.env.example` para as variáveis suportadas.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações lidas do ambiente (prefixo WAVEAI_API_)."""

    model_config = SettingsConfigDict(
        env_prefix="WAVEAI_API_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "waveai-api"
    app_env: str = "development"

    #: URL do PostgreSQL. O default serve ao compose local; em qualquer
    #: ambiente compartilhado vem do ambiente/secret manager.
    database_url: str = "postgresql+psycopg://waveai:waveai_dev@localhost:5432/waveai"

    # -- Argon2id (ADR-0020) — mínimos OWASP: m=19 MiB, t=2, p=1 -------------
    #: Memória em KiB (19456 KiB = 19 MiB).
    argon2_memory_cost: int = 19456
    argon2_time_cost: int = 2
    argon2_parallelism: int = 1


def get_settings() -> Settings:
    """Retorna as configurações do serviço."""
    return Settings()
