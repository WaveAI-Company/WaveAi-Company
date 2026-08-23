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

## Publicação estática do app web (Cloudflare Pages)

Decidido na **ADR-0049** e na sua emenda de 2026-08-23. Esta é a camada que
**nunca dorme**: a Política de Privacidade e os Termos precisam responder numa
URL pública, sem login, mesmo com a API escalada a zero. Por isso ela é servida
de CDN e **não depende da API para renderizar**.

| Item | Valor |
|---|---|
| Comando de build | `npm run build:web` (em `apps/wave-app`) |
| Diretório publicado | `apps/wave-app/dist` |
| Domínio | `waveai.tec.br` |
| Variável de build | `EXPO_PUBLIC_API_URL=https://api.waveai.tec.br` |

### Os endereços não são intercambiáveis

O app **tem** de ficar em `waveai.tec.br` e a API em `api.waveai.tec.br`. Usar
os endereços gratuitos dos provedores (`*.pages.dev`, `*.a.run.app`) **quebra o
login no web**: o refresh token é cookie `httpOnly` com `SameSite=Lax`, que o
navegador só envia quando o site (domínio registrável) coincide. Subdomínios do
mesmo domínio são o mesmo site; `pages.dev` e `run.app` não são. Use-os apenas
para conferir um deploy isolado, nunca como endereço de produção.

Como consequência, `WAVEAI_API_CORS_ORIGINS=https://waveai.tec.br` é
**obrigatória** no ambiente da API. Sem ela o navegador recusa toda chamada, e
curinga não resolve: com `allow_credentials` ligado, o padrão CORS o proíbe.

### Fallback de rota — sem ele a URL da loja dá 404

`expo export --platform web` gera **um** `index.html` e resolve as rotas no
cliente. Pedir `/legal/privacidade` direto na barra de endereços devolveria 404.
A regra vive versionada em `apps/wave-app/public/_redirects` (`/* /index.html
200`), e não num painel, para não depender de alguém lembrar de configurá-la.
`public/_headers` acompanha, com os cabeçalhos de segurança — e sem CSP, pelo
motivo explicado lá dentro.

**Verificado em 2026-08-23:** servindo `dist` sem fallback, `/legal/privacidade`
responde **404**; com fallback, **200** e a página certa.

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
