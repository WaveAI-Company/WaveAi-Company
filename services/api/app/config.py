"""Configuração do serviço via variáveis de ambiente.

Regras rígidas: segredos só via ambiente; nunca commitar `.env`/chaves.
Ver `.env.example` para as variáveis suportadas.
"""

from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Tamanho mínimo do segredo de assinatura, em bytes (ADR-0023).
JWT_SECRET_MIN_BYTES = 32


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

    # -- JWT (ADR-0021 / ADR-0023) -------------------------------------------
    #: Segredo de assinatura. **Sem default, obrigatório em todo ambiente**:
    #: a app não sobe sem ele (fail-closed). Gere com `openssl rand -hex 32`.
    jwt_secret: str = Field(...)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7

    # -- Rate limiting do login (ADR-0023) -----------------------------------
    #: Tentativas permitidas por janela, por (IP + e-mail) e por IP.
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 60

    # -- Cookie do refresh no web (ADR-0021) ---------------------------------
    refresh_cookie_name: str = "waveai_refresh"
    #: `False` apenas para desenvolvimento local sem TLS.
    refresh_cookie_secure: bool = True
    refresh_cookie_samesite: str = "lax"

    # -- CORS ----------------------------------------------------------------
    #: Origens permitidas (separadas por vírgula) para o app web.
    #: Em produção o MVP assume **same-origin** (app e API atrás do mesmo
    #: domínio/proxy), então CORS não é necessário; isto atende o dev, em que
    #: o Expo serve na 8081 e a API na 8000.
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origem.strip() for origem in self.cors_origins.split(",") if origem.strip()]

    @field_validator("jwt_secret")
    @classmethod
    def _validar_segredo(cls, value: str) -> str:
        """Fail-closed: segredo ausente, vazio ou curto impede a app de subir."""
        if len(value.strip().encode("utf-8")) < JWT_SECRET_MIN_BYTES:
            raise ValueError(
                "WAVEAI_API_JWT_SECRET deve ter ao menos "
                f"{JWT_SECRET_MIN_BYTES} bytes (gere com: openssl rand -hex 32)"
            )
        return value


def get_settings() -> Settings:
    """Retorna as configurações do serviço."""
    return Settings()
