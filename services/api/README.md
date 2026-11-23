# services/api — API do WaveAI (FastAPI)

API de produção do WaveAI: autenticação JWT com papéis (`patient` / `doctor`,
este último é o "profissional de bem-estar" nos textos de produto), CRUD de
domínio, gateway WebSocket de captação, transmissão ao vivo por SSE e
persistência em PostgreSQL. Uso **exploratório de bem-estar — não-clínico e
não-diagnóstico** (`Medical/71_Intended_Use_and_Regulatory_Positioning.md`).

Fontes de verdade (este README não as duplica): decisões em `05_Decisions.md`
(ADRs — auth 0020/0021/0023, streaming 0025, espectador ao vivo 0039/0045,
foto de perfil 0050), arquitetura em `Architecture/22_MVP_Platform_Architecture.md`
e infra/deploy em `infra/README.md`.

## O que tem

- **Auth** (`app/api/auth.py`): cadastro, verificação de e-mail por código,
  login, refresh com **rotação**, logout, recuperação e troca de senha, troca de
  e-mail, exclusão de conta. Argon2id; respostas anti-enumeração.
- **Domínio**: vínculos paciente-profissional (`care_links`), consentimento,
  resultados (métricas cifradas em repouso), anotações de sessão, relatório
  longitudinal, foto de perfil (re-codificada no servidor).
- **`WS /stream`** (`app/api/stream.py`): recebe blocos de EEG bruto do app,
  encaminha ao serviço de análise por janelas e devolve resultado ao vivo.
- **SSE de transmissão ao vivo** (`app/api/live.py`): o titular liga/desliga o
  compartilhamento; o profissional vinculado assiste.
- **E-mail** (`app/services/email.py`): SMTP configurável por ambiente.
- **Narrativa opcional** (`app/services/narrator.py`): desligada por padrão;
  sem ela vale o sumário determinístico do `wave_eeg`.
- `GET /health` e docs interativas em `/docs`.

## Rodar localmente

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env     # defina os dois segredos obrigatórios (abaixo)

docker compose -f ../../infra/docker-compose.yml up -d postgres
alembic upgrade head
uvicorn app.main:app --reload      # http://127.0.0.1:8000
```

Para a stack completa (postgres + api + analysis): `docker compose up --build`
em `infra/` (ver `infra/README.md`). As migrations **não** rodam sozinhas ao
subir o container: `docker compose exec api alembic upgrade head`.

## Migrations (Alembic)

Schema versionado em `migrations/versions/` (`0001`…`0019`).

```bash
alembic upgrade head
alembic downgrade base
alembic revision --autogenerate -m "descricao"
```

## Variáveis de ambiente

Prefixo `WAVEAI_API_`; definição e defaults em `app/config.py`, exemplo em
`.env.example`. **Nunca** commitar valores de segredo.

| Grupo | Variáveis (sufixo) |
|---|---|
| Ambiente / banco | `APP_ENV`, `DATABASE_URL` |
| Segredos (obrigatórios) | `JWT_SECRET`, `RESULT_ENCRYPTION_KEY` |
| Tokens e cookie | `JWT_ALGORITHM`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `REFRESH_COOKIE_NAME`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAMESITE` |
| Rate limit | `LOGIN_RATE_LIMIT_*`, `REGISTER_RATE_LIMIT_*`, `TRUSTED_PROXY_HOPS` |
| Streaming / análise | `ANALYSIS_URL`, `ANALYSIS_TIMEOUT_SECONDS`, `STREAM_*`, `RESULT_PERSISTENCE_ENABLED` |
| Narrativa (opcional) | `NARRATIVE_ENABLED`, `NARRATIVE_MODEL` |
| E-mail | `EMAIL_FROM`, `EMAIL_LINK_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `EMAIL_VERIFICATION_REQUIRED` |
| Retenção | `AUDIT_PSEUDONYM_RETENTION_DAYS`, `UNVERIFIED_ACCOUNT_TTL_DAYS` |
| CORS | `CORS_ORIGINS` (em produção, a origem do app é obrigatória) |

## Scripts

```bash
python -m scripts.seed_dev                       # dados 100% fictícios; recusa rodar fora de development
python -m scripts.purge_audit_trail [--simular]  # expurgo da trilha pseudonimizada vencida (job agendado)
```

O seed usa o domínio reservado `example.com`; as contas de teste estão em
`scripts/seed_dev.py`. Dados de teste são sempre sintéticos.

## Estrutura

```
app/main.py        # app FastAPI, CORS, routers
app/config.py      # Settings (WAVEAI_API_*)
app/api/           # rotas: auth, care_links, results, annotations, live, profile_photos, stream
app/services/      # regras de negócio (auth, streaming, e-mail, narrativa, retenção...)
app/repositories/  # acesso a dados
app/models/        # modelos SQLAlchemy
app/security/      # senha (Argon2id), tokens, cifra, rate limit
migrations/        # Alembic
scripts/           # seed_dev, purge_audit_trail
tests/             # pytest
```

## Testes e lint

```bash
pytest -q          # em services/api; apenas dados sintéticos
ruff check .       # config no ruff.toml da raiz; o CI roda da raiz
```

O CI (`.github/workflows/ci.yml`) roda `pytest -q` neste serviço. A imagem
(`Dockerfile`) sobe `uvicorn app.main:app` na porta 8000, sem segredos embutidos.
