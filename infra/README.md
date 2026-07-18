# infra — orquestração e automação

## Stack local (docker compose)

Sobe `postgres`, `api` (8000) e `analysis` (8001):

```bash
cd infra
cp .env.example .env      # opcional: os defaults já funcionam
docker compose up --build
```

Conferir:

```bash
curl http://localhost:8000/health           # {"status":"ok"}
curl http://localhost:8001/health           # {"status":"ok"}
curl -X POST http://localhost:8001/analyze/demo   # Exp. B (dados sintéticos)
```

Derrubar (com volumes): `docker compose down -v`.

### Detalhes de build

| Serviço | Contexto de build | Porquê |
|---|---|---|
| `api` | `services/api` | Não depende do resto do monorepo |
| `analysis` | raiz do repositório | Precisa de `packages/wave-eeg` |

Os healthchecks usam o Python da própria imagem (`python:slim` não traz `curl`).
O `api` só inicia depois do `postgres` ficar *healthy*.

> O `postgres` já sobe no M0 para destravar o modelo de dados (#6); os serviços
> ainda não se conectam a ele.

### Segredos

Config vem do ambiente (`.env`, ignorado pelo Git — só `.env.example` é
versionado). Os valores do exemplo são **descartáveis, de desenvolvimento
local**. Em qualquer ambiente compartilhado, gere segredos próprios e injete-os
pelo ambiente/secret manager. Nunca comite `.env`.

## CI

`.github/workflows/ci.yml` roda em PR e push para `main`:

| Job | O que faz |
|---|---|
| `test-wave-eeg` | `pytest` do pacote de análise |
| `test-api` | `pytest` do serviço de API |
| `test-analysis` | `pytest` do serviço de análise (instala `wave-eeg` local) |
| `typecheck-app` | `tsc --noEmit` do app Expo |
| `compose-smoke` | sobe o stack com `docker compose` e valida os endpoints |

## Scripts

- `scripts/bootstrap_github.sh` — cria milestones e issues do MVP (rodar **uma
  vez**; ver `Documentation/11_MVP_Work_Breakdown.md`).
