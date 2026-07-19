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

## Autenticação (ADR-0020/0021/0023)

| Rota | O que faz |
|---|---|
| `POST /auth/register` | Cria usuário + perfil do papel (`201`; `409` se e-mail já existe) |
| `POST /auth/login` | Emite access + refresh (`401` genérico; `429` se exceder tentativas) |
| `POST /auth/refresh` | **Rotaciona** o refresh |
| `POST /auth/logout` | Revoga a família do dispositivo (`204`) |
| `GET /auth/me` | Usuário autenticado (exige Bearer) |

**Access token:** JWT HS256, **15 min**, claims mínimas (`sub`, `role`, `exp`,
`iat`, `jti`, `typ`) — nunca dado sensível, pois JWT é apenas base64.

**Refresh token:** valor **opaco** (não JWT), **7 dias**, guardado só como
hash SHA-256. Cada login abre uma **família**; cada rotação cria um novo token
na família e marca o anterior como usado.

> **Detecção de reuso:** se um refresh **já rotacionado** reaparecer, assume-se
> roubo e a **família inteira** é revogada — atacante e vítima perdem acesso, e
> o dono refaz login.

**Onde o cliente guarda o refresh** (o `client` no corpo decide):
- `client=web` → cookie `httpOnly` + `Secure` + `SameSite`; **não** vai no corpo.
- `client=mobile` → vem no corpo, para o app salvar em `expo-secure-store`.

Nunca em `localStorage`.

### Segredo (fail-closed)

`WAVEAI_API_JWT_SECRET` é **obrigatório e sem default**: a app não sobe se
faltar ou tiver menos de 32 bytes, em **qualquer** ambiente. Gere com
`openssl rand -hex 32`. O `docker compose` também recusa subir sem ele.

### Rate limiting

Janela deslizante por **IP** e por **(IP + e-mail)**, aplicada **antes** do
Argon2 — senão cada tentativa custaria ~19 MiB ao servidor e o hash forte
viraria vetor de DoS. Erros genéricos e custo de CPU uniforme mesmo para
e-mail inexistente (anti-enumeração).

**Limitação conhecida:** o limiter é in-memory (por processo). Com réplicas,
cada uma conta em separado — o endurecimento completo (Redis, lockout,
backoff, auditoria) é a **issue #19**.

### Cookie em desenvolvimento

`Secure` só trafega sob HTTPS. Em dev local (HTTP) use
`WAVEAI_API_REFRESH_COOKIE_SECURE=false`, senão o navegador descarta o cookie.

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
