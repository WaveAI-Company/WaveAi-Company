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

## Testes

```bash
pytest -q
```

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
