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

## Resultado por sessão e direitos do titular (ADR-0026 / Medical/72)

Ao encerrar o stream, o gateway pede à Analysis o relatório em batch
(`process_session`) e persiste um **`Result`** vinculado ao paciente. O sinal
**raw não é gravado** (ADR-0025) — vive só em memória durante a captação e é
descartado; o que persiste é o dado **derivado**.

**Tratado como dado sensível:**
- **Cifragem em repouso:** as métricas ficam num campo binário cifrado (Fernet);
  só `engine_version` fica em claro (rastreabilidade). Chave via
  `WAVEAI_API_RESULT_ENCRYPTION_KEY`, **fail-closed** (a app não sobe sem ela).
- **Gate de consentimento:** sem `consent_given_at` no titular, **nada é
  gravado** — a sessão encerra, mas o `Result` não. `WAVEAI_API_RESULT_PERSISTENCE_ENABLED`
  é o gate de produção (fica `false` até o consentimento no fluxo, #29).
- **Auditoria:** `result_access_events` registra quem acessou dados de qual
  titular (`created`/`read`/`exported`/`deleted`). O rastro **sobrevive à
  exclusão** dos Result.

**Direitos do titular (LGPD):**
| Rota | Direito |
|---|---|
| `POST` / `DELETE` / `GET /me/consent` | Consentimento (dar, revogar, consultar) |
| `GET /me/results` | **Acesso** — vê os próprios (decifrados) |
| `GET /me/results/export` | **Portabilidade** — exporta tudo em JSON |
| `DELETE /me/results` | **Exclusão** — apaga TODOS os próprios Result |
| `GET /patients/{id}/results` | Médico lê, **só com CareLink `active`** (403 sem), auditado |

Revogar consentimento **interrompe** novas coletas mas **não apaga** o que
existe — a exclusão é direito explícito, para revogar não destruir dado por
engano. A política de retenção pós-revogação fica em aberto (Medical/72, §5).

## Vínculo médico-paciente (ADR-0024)

| Rota | O que faz |
|---|---|
| `POST /care-links` | Solicita vínculo pelo e-mail da contraparte (`202` **sempre**) |
| `GET /care-links` | Vínculos vivos do usuário (só a contraparte é exposta) |
| `POST /care-links/{id}/accept` | **Paciente** consente (`pending` → `active`) |
| `POST /care-links/{id}/revoke` | Qualquer uma das partes revoga |
| `GET /patients/{id}` | Dados do paciente — **403 sem vínculo ativo** |

**Invariante:** nenhum acesso aos dados de um paciente sem um ato de
autorização *desse* paciente. Um convite de médico nasce `pending` e **não
concede nada**; só o aceite do paciente (ou o vínculo iniciado por ele) leva a
`active`.

A regra vive na **camada de autorização** (`require_active_care_link` em
`app/api/deps.py`), não na UI — a rota não tem como servir dados sem passar por
ela.

**Revogação** é imediata e definitiva (`revoked`). Re-vincular cria uma **linha
nova**, exigindo novo consentimento: nada de reativação silenciosa. Um índice
parcial garante no máximo um vínculo vivo por par, preservando os revogados
como histórico.

**Auditoria:** `care_link_events` registra `requested` / `accepted` / `revoked`
com quem praticou o ato e quando.

**Anti-enumeração:** o convite responde igual exista ou não a conta, e o `403`
de `/patients/{id}` não distingue "paciente inexistente" de "não autorizado".

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

## Gateway de streaming — `WS /stream` (ADR-0025)

Recebe blocos de sinal bruto de um **paciente autenticado** e mantém a
`CaptureSession`.

```
cliente -> {"type":"auth",    "token":"<access>"}      servidor -> {"type":"auth_ok"}
        -> {"type":"start",   "device":"mindwave-mobile-2", "sample_rate":512}
                                                       <- {"type":"session","session_id":...}
        -> {"type":"samples", "seq":1, "data":[...]}   <- {"type":"ack","received":n,"total":N}
        -> {"type":"stop"}                             <- {"type":"closed","sample_count":N}
```

**Token na primeira mensagem, nunca na URL.** Query string vaza em log de
servidor, proxy e histórico; navegador não permite cabeçalho customizado em
WebSocket. Nenhum frame de dados é processado antes do `auth`, que tem **10 s**
de prazo. Em produção o transporte é **`wss://`** — sem TLS o token iria em claro.

**Papéis:** só `patient` abre stream (a pessoa transmite o próprio sinal). O
**consentimento (ADR-0024) não é exigido aqui**: ele governa a leitura pelo
médico, não o direito do paciente de captar o próprio sinal.

**Ciclo de vida:** `active` → `completed` (com `stop`) ou `aborted` (queda sem
`stop`) — uma conexão perdida nunca deixa sessão ativa para sempre.

**Limites** (config por env): amostras por bloco, por sessão e taxa máxima. Sem
teto, um cliente enche a memória do servidor num único frame.

| Código | Motivo |
|---|---|
| `4001` | Não autenticado (token ausente/inválido ou prazo esgotado) |
| `4003` | Papel sem permissão |
| `4400` | Protocolo inválido |
| `4413` | Limite excedido |

**O sinal bruto não é persistido.** Pelo fluxo da ADR-0017 persiste-se o
`Result` (features + `engine_version`); guardar raw está **fora do escopo do
MVP** até haver necessidade concreta (Q-TEC-04 / ADR-0005 seguem abertos).

### Features ao vivo (#14)

A cada `stream_window_seconds` de sinal acumulado, o gateway encaminha a janela
para `POST /analyze/window` da Analysis e devolve o resultado junto do `ack`:

```json
{"type":"ack","seq":3,"received":256,"total":1024,
 "features":{"rel_alpha":0.94,"relative_band_powers":{...},"quality":{...},
             "engine_version":"WaveEegEngine/0.1.0+wave_eeg/0.1.0"}}
```

O gateway **não analisa nada** — só encaminha (regra rígida: nada de DSP na
API). A janela é decisão de **cadência**; a semântica de época do sinal vive no
`AnalysisEngine`.

**Analysis fora do ar não derruba a captação:** o bloco continua sendo aceito, a
sessão segue registrada e o cliente recebe `"features":{"unavailable":true}`.
Perder o "ao vivo" é aceitável; perder a sessão do paciente não.

## Dados de desenvolvimento (seed)

Cria um médico e três pacientes **fictícios** com vínculos `active`, para
exercitar as telas sem passar pelo fluxo de convite (que é a #20):

```bash
python -m scripts.seed_dev
# Medico de teste: dra.ficticia@example.com / senha-de-teste-bem-longa
```

É idempotente (rodar duas vezes não duplica) e **recusa-se a rodar** com
`app_env` diferente de `development` — semear um banco real com contas de senha
conhecida seria uma porta dos fundos. Todos os dados são inventados, em
`example.com` (LGPD: nenhum dado de pessoa real).

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
