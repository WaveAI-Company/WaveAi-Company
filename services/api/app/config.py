"""Configuração do serviço via variáveis de ambiente.

Regras rígidas: segredos só via ambiente; nunca commitar `.env`/chaves.
Ver `.env.example` para as variáveis suportadas.
"""

from __future__ import annotations

from pydantic import Field, field_validator, model_validator
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
    #: Se **não** vier explícito, segue o ambiente (ver validador abaixo):
    #: `False` em `development` (http local sem TLS recusa cookie `Secure`),
    #: `True` fora dele. Override por env sempre vence.
    refresh_cookie_secure: bool = True
    refresh_cookie_samesite: str = "lax"

    # -- Streaming (#13) ------------------------------------------------------
    #: Segundos para o cliente autenticar após conectar. Sem isso, conexões
    #: anônimas ficariam abertas consumindo recursos.
    stream_auth_timeout_seconds: float = 10.0
    #: Teto de amostras por bloco (evita estourar memória num único frame).
    stream_max_block_samples: int = 4096
    #: Teto de amostras por sessão (~2 h a 512 Hz).
    stream_max_session_samples: int = 4_000_000
    stream_max_sample_rate: int = 2000

    #: URL do serviço de Analysis (o gateway apenas encaminha as janelas).
    analysis_url: str = "http://localhost:8001"
    #: Timeout por janela. Curto de propósito: análise ao vivo atrasada não
    #: tem valor, e travar aqui seguraria o stream inteiro.
    analysis_timeout_seconds: float = 5.0
    #: Cadência do "ao vivo": de quantos em quantos segundos de sinal pedimos
    #: uma leitura. É decisão de **cadência**, não de DSP — a semântica de
    #: janela/época do sinal vive no AnalysisEngine (ADR-0017).
    stream_window_seconds: float = 2.0

    # -- Persistência de Result (ADR-0026 / Medical/72) ----------------------
    #: Chave de cifragem em repouso das métricas. **Sem default, obrigatória**
    #: (fail-closed): a app não sobe sem ela. Gere com:
    #:   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    result_encryption_key: str = Field(...)
    #: GATE de produção (ADR-0026): quando `False`, nenhum Result de pessoa
    #: real é persistido. Fica desligado em produção até o consentimento no
    #: fluxo (#29). Em dev/test, ligado — mas só com dados sintéticos.
    result_persistence_enabled: bool = True

    # -- Narrativa-LLM aterrada (N6-b, ADR-0035) -----------------------------
    #: Liga a camada de linguagem por LLM sobre o relatório longitudinal.
    #: **Desligada por padrão.** Mesmo ligada, só age se houver `ANTHROPIC_API_KEY`
    #: no ambiente (lida pelo SDK da Anthropic, fora do prefixo WAVEAI_API_ de
    #: propósito). Sem os dois, o app mostra o sumário determinístico (N5-c).
    narrative_enabled: bool = False
    #: Modelo do sumarizador aterrado. Haiku é barato e sobra para template→prosa
    #: (ADR-0035 pondera custo). Trocar de tier é só mudar esta constante.
    narrative_model: str = "claude-haiku-4-5"

    # -- Fluxos por e-mail (ADR-0044) ----------------------------------------
    #: Remetente dos e-mails transacionais. O provedor real (P5) costuma exigir
    #: domínio verificado; até lá isto só aparece no adapter de console.
    email_from: str = "WaveAI <nao-responda@waveai.local>"
    #: Base dos links que vão no e-mail. Aponta para o **app web** (ADR-0044,
    #: item 5): não há deep link nativo nesta fase — quem está no celular
    #: verifica no navegador, e universal links dependem do domínio do P5.
    email_link_base_url: str = "http://localhost:8081"
    #: Prazo do código/token, igual para os dois propósitos (emenda à ADR-0044):
    #: o design verifica **com a pessoa na tela**, então prazo longo não teria
    #: função. `Design/round1/criar-conta.html` diz "vale por 10 minutos".
    single_use_token_ttl_minutes: int = 10
    #: Tentativas erradas antes de o código **queimar**. É esta a defesa contra
    #: adivinhação de 6 dígitos — e ela mora no banco, então vale com N réplicas
    #: (diferente do rate limiter em memória, ADR-0023).
    single_use_token_max_attempts: int = 5
    #: Espera entre reenvios, por (usuário, propósito). O protótipo mostra 42 s
    #: (valor de demonstração); 60 s é o número redondo.
    verification_resend_cooldown_seconds: int = 60

    # -- Verificação de e-mail (fatia P9-e, ligada na P11-c) -----------------
    #: GATE: quando `True`, conta não verificada **não faz login**. Nasceu
    #: desligado para o backend ir para `main` antes das telas; **ligado desde
    #: a fatia P11-c**, que trouxe a tela de código de 6 dígitos.
    #:
    #: O padrão vive aqui, e não numa variável de ambiente, porque é o valor
    #: que a suíte inteira passa a exercitar: com o gate desligado nos testes,
    #: nenhum deles atravessaria o login que o produto de fato tem.
    #:
    #: Contas anteriores não são afetadas — a migration 0012 marcou como
    #: verificadas todas as que já existiam.
    email_verification_required: bool = True
    #: Prazo até uma conta **não verificada** poder ser reciclada, devolvendo o
    #: e-mail. Sem isto a verificação sozinha não impede o banco de acumular
    #: cadastros mortos segurando endereços.
    unverified_account_ttl_days: int = 7

    # -- Rate limiting do cadastro (fatia P9-e) ------------------------------
    #: Por **IP apenas**: pôr o e-mail na chave transformaria a própria chave
    #: num oráculo de existência, que é o que este fluxo evita.
    register_rate_limit_attempts: int = 10
    register_rate_limit_window_seconds: int = 3600

    # -- CORS ----------------------------------------------------------------
    #: Origens permitidas (separadas por vírgula) para o app web.
    #: Em produção o MVP assume **same-origin** (app e API atrás do mesmo
    #: domínio/proxy), então CORS não é necessário; isto atende o dev, em que
    #: o Expo serve na 8081 e a API na 8000.
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origem.strip() for origem in self.cors_origins.split(",") if origem.strip()]

    @model_validator(mode="after")
    def _default_cookie_secure_por_ambiente(self) -> Settings:
        """Sem override explícito, o cookie `Secure` segue o ambiente.

        Em `development` o app roda sobre **http** local, e navegadores recusam
        guardar cookie `Secure` sem TLS — o que derrubava a sessão no reload
        (o refresh não voltava). Aqui isso passa a ser automático em vez de
        depender de lembrar `WAVEAI_API_REFRESH_COOKIE_SECURE=false`. Em produção
        (same-origin sob TLS) o default continua `True`.
        """
        if "refresh_cookie_secure" not in self.model_fields_set:
            self.refresh_cookie_secure = self.app_env != "development"
        return self

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

    @field_validator("result_encryption_key")
    @classmethod
    def _validar_chave_cifragem(cls, value: str) -> str:
        """Fail-closed: a chave precisa ser um Fernet key válido."""
        from cryptography.fernet import Fernet

        try:
            Fernet(value.strip().encode("utf-8"))
        except Exception as exc:
            raise ValueError(
                "WAVEAI_API_RESULT_ENCRYPTION_KEY invalida (gere com: "
                "python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\")"
            ) from exc
        return value.strip()


def get_settings() -> Settings:
    """Retorna as configurações do serviço."""
    return Settings()
