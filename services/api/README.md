# services/api — WaveAI API (FastAPI)

Serviço de API do WaveAI. Nesta fase (M0) é um **esqueleto** que expõe apenas o
health check. Auth (JWT/papéis), CRUD de domínio e o gateway WebSocket entram
nas issues seguintes (ver `Documentation/11_MVP_Work_Breakdown.md`).

## Instalação

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

## Rodar

```bash
uvicorn app.main:app --reload      # http://127.0.0.1:8000
```

- `GET /health` → `200 {"status":"ok"}`
- Docs interativas: `http://127.0.0.1:8000/docs`

## Banco e migrations (Alembic)

O schema é versionado em `migrations/`. Suba o Postgres e aplique:

```bash
docker compose -f ../../infra/docker-compose.yml up -d postgres
alembic upgrade head          # cria users, patient_profiles, doctor_profiles
alembic downgrade base        # desfaz (remove inclusive o tipo enum user_role)
alembic revision --autogenerate -m "descricao"   # nova migration
```

As migrations **não** rodam sozinhas ao subir o container — aplique
explicitamente (`docker compose exec api alembic upgrade head`).

## Modelo de identidade

`User(id, email, password_hash, role ∈ {patient,doctor}, is_active,
token_version, timestamps)` + `PatientProfile` / `DoctorProfile`
(`user_id` PK/FK, `display_name`). Perfis são mínimos de propósito: campos
pessoais/clínicos entram quando especificados pelo produto.

- **Senha:** Argon2id via `PasswordHasher` (ADR-0020). A senha em claro nunca
  chega ao banco; `verify_password` regrava o hash automaticamente quando os
  parâmetros endurecem (`needs_rehash`).
- **E-mail:** normalizado (minúsculas, sem espaços) com índice único.
- **`token_version`:** permite invalidar refresh tokens já emitidos (logout
  global, ADR-0021). A rotação por token chega na #7.

## Testes

```bash
pytest -q
```

Os testes de persistência rodam contra **PostgreSQL real** (o schema vem das
próprias migrations), não SQLite — o esquema usa enum nativo, UUID e
`timestamptz`. Sem banco acessível eles são **pulados**; no CI a variável
`WAVEAI_TEST_REQUIRE_DB=1` transforma o skip em **falha**, para o CI nunca
passar "verde por omissão".

## Configuração (por ambiente)

Config lida de variáveis de ambiente com prefixo `WAVEAI_API_` (ver
`.env.example`). Copie para `.env` para desenvolvimento local — o `.env` real
**não** é versionado (segredos fora do Git).

| Variável | Padrão | Descrição |
|---|---|---|
| `WAVEAI_API_APP_NAME` | `waveai-api` | Nome exibido do serviço |
| `WAVEAI_API_APP_ENV` | `development` | Ambiente lógico |

## Docker

```bash
docker build -t waveai-api .
docker run --rm -p 8000:8000 waveai-api
```

A orquestração com os demais serviços (`docker-compose`) chega na Issue #5.
