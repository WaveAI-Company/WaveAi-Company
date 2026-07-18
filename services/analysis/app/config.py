"""Configuração do serviço via variáveis de ambiente.

Regras rígidas: segredos só via ambiente; nunca commitar `.env`/chaves.
Ver `.env.example` para as variáveis suportadas.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações lidas do ambiente (prefixo WAVEAI_ANALYSIS_)."""

    model_config = SettingsConfigDict(
        env_prefix="WAVEAI_ANALYSIS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "waveai-analysis"
    app_env: str = "development"
    demo_seconds: float = 30.0


def get_settings() -> Settings:
    """Retorna as configurações do serviço."""
    return Settings()
