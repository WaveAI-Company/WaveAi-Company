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

## Backend em produção — Azure Container Apps, com data de validade

Decidido na emenda à ADR-0049 de 2026-08-23. API e Analysis rodam como
containers na Azure, plano Consumption, escala a zero, **uma réplica no máximo**;
o Postgres é o **Neon**, fora da assinatura da Azure.

O crédito é Azure for Students e **expira no final de 2026** (informado pelo
fundador em 2026-08-23; a data exata está no portal, em Subscriptions). Quando
isso acontece, a assinatura é desabilitada e os recursos, descomissionados. Duas
consequências práticas:

- **Renovar ou migrar é tarefa de novembro de 2026**, não de um futuro distante:
  restam cerca de quatro meses. A emenda à ADR-0049 foi escrita supondo horizonte
  de doze — o horizonte real é menor, e é isso que vale. Data de desligamento
  conhecida que ninguém anotou é queda surpresa.
- **A saída está escrita em [RUNBOOK_PORTABILIDADE.md](RUNBOOK_PORTABILIDADE.md)** —
  contrato de configuração, invariantes e procedimento de mudança. O banco estar
  no Neon é o que torna a queda um problema de disponibilidade, e não de dado.

Nada de serviço proprietário além do runtime de container e do agendador: é essa
disciplina que mantém a saída barata.

### Provisionar

`bash infra/azure/provision.sh`, do Azure Cloud Shell ou de uma máquina com `az`.
É **idempotente** e **não contém segredo nenhum** — recusa-se a rodar sem as
variáveis de ambiente, do mesmo jeito que o `docker compose` recusa sem o segredo
do JWT. O cabeçalho do script lista quais são e como gerar cada uma.

| Recurso | Nome |
|---|---|
| Grupo de recursos | `rg-waveai-prod` |
| Região | `brazilsouth` — dado de EEG em território brasileiro (decisão 9 da ADR-0049) |
| Ambiente | `cae-waveai-prod` |
| API (ingress **externo**) | `ca-waveai-api`, porta 8000 |
| Analysis (ingress **interno**) | `ca-waveai-analysis`, porta 8001 |

Duas escolhas que não são detalhe:

- **Imagens no GHCR, não no Azure Container Registry.** O ACR Basic custaria por
  volta de US$ 5/mês — mais da metade do que o crédito representa por mês. O GHCR
  é gratuito, já é do GitHub que hospeda código e CI, e qualquer nuvem puxa de lá.
- **A Analysis não é alcançável de fora.** Ela não tem autenticação própria: o que
  a protege é o ingress interno. No `docker compose` isso vale por acidente de
  topologia; aqui é configuração explícita.

### Deploy automático

`.github/workflows/deploy.yml` roda a cada push na `main` e também sob demanda
(`workflow_dispatch`, para reverter sem precisar mexer na `main` sob pressão).

A ordem é a decisão: **constrói as imagens → migra o banco → só então troca as
imagens dos apps.** Se a migração falhar, o workflow para e a produção continua
na versão anterior — código novo contra schema velho é o modo de falha que a
decisão 4 da ADR-0049 existe para evitar.

Publicar no GHCR usa o `GITHUB_TOKEN` do próprio workflow. O PAT que o Container
Apps usa serve só para **puxar** a imagem e não entra no CI.

#### Autenticação na Azure por OIDC

Sem segredo de longa duração: o GitHub troca um token efêmero, válido só para
este repositório. Rode uma vez, no Cloud Shell:

```bash
APP_ID=$(az ad app create --display-name waveai-github-deploy --query appId -o tsv)
az ad sp create --id "$APP_ID"
ASSINATURA=$(az account show --query id -o tsv)
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/${ASSINATURA}/resourceGroups/rg-waveai-prod"
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:WaveAI-Company/WaveAi-Company:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$ASSINATURA"
```

O papel `Contributor` é dado **apenas sobre `rg-waveai-prod`**, não sobre a
assinatura: o pipeline não tem por que poder criar recursos fora do que opera.

Os três valores impressos ao final viram *secrets* do repositório
(Settings → Secrets and variables → Actions): `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. Nenhum deles é segredo de verdade —
são identificadores —, mas ficam como secret por convenção e para não vazarem em
log de execução.

O `subject` amarra a credencial à branch `main` deste repositório. Deploy a
partir de outra branch **não** autentica, e isso é proposital.

**Se `az ad app create` falhar por permissão**, a conta educacional restringe o
Entra ID. O plano B é um service principal com senha
(`az ad sp create-for-rbac --sdk-auth`), guardada como secret e usada com
`creds:` no `azure/login` — funciona, mas é credencial permanente, e por isso é
plano B e não escolha.

### Domínio da API

`api.waveai.tec.br` é vinculado por `bash infra/azure/vincular-dominio.sh`, em
duas etapas — sem argumento ele **mostra** os dois registros de DNS a criar; com
`--vincular` ele valida e emite o certificado.

Não é estética: o refresh token é cookie `SameSite=Lax`, e entre `waveai.tec.br`
e um endereço `azurecontainerapps.io` o navegador não o envia — **o login no web
para de funcionar**. Sob `api.waveai.tec.br` é o mesmo site registrável.

**O CNAME precisa ficar em "DNS only" (nuvem cinza), não "Proxied".** Com o proxy
da Cloudflare ligado, quem responde no endereço é a Cloudflare, e a Azure não
alcança o Container App para validar o domínio nem emitir o certificado.

### Expurgo da trilha pseudonimizada — agendado

A Política de Privacidade 1.2 promete apagar em **até 12 meses** os registros de
leitura que perderam o dono. Quem cumpre isso é o job `caj-waveai-purge`, criado
pelo `provision.sh` com gatilho **cron diário às 04:00 UTC** (01:00 em Brasília).

Diário é frequência de sobra — o que ele apaga tem um ano de idade —, e a
madrugada evita disputar CPU com quem estiver usando o produto. O comando sai com
código 0 quando não há nada a apagar, de propósito: um agendador que trate "nada
vencido" como falha vira alarme falso diário.

O mesmo comando roda à mão, sem precisar da API no ar — só do banco:

```
cd services/api
python -m scripts.purge_audit_trail --simular   # conta, não apaga
python -m scripts.purge_audit_trail             # apaga
```

Prazo em `WAVEAI_API_AUDIT_PSEUDONYM_RETENTION_DAYS` (padrão 365); aumentar esse
valor sem mudar o texto da Política seria guardar dado além do prometido.

**Detalhe que parece capricho e não é:** dentro do job o comando é
`python scripts/purge_audit_trail.py` com `PYTHONPATH=/app`, e **não**
`python -m scripts.purge_audit_trail`. O parser da CLI da Azure para de consumir
argumentos ao encontrar um que começa com hífen — foi o que recusou o `-c` do job
de migração. Sem hífen, não há ambiguidade.

#### Como conferir que o expurgo está mesmo rodando

As execuções agendadas:

```
az containerapp job execution list -n caj-waveai-purge -g rg-waveai-prod -o table
```

**`Succeeded` não basta como prova, e a razão importa.** Com a retenção em 365
dias, uma execução correta apaga **zero** registros hoje — e sair 0 sem apagar
nada é o comportamento desejado. Um job que subisse com a imagem errada também
sairia 0. Para separar os dois casos, confira **o que o job está configurado para
rodar**:

```
az containerapp job show -n caj-waveai-purge -g rg-waveai-prod --query "properties.template.containers[].{nome:name, imagem:image, comando:command, args:args}" -o json
```

A `imagem` tem de ser `ghcr.io/waveai-company/waveai-api:<sha>` — se ainda for a
provisória com que o `provision.sh` cria o job, o passo "Atualizar o job do
expurgo" do pipeline não pegou e o cron dispara todo dia sem cumprir nada.
Atenção ao alcance da resposta: ela descreve a configuração **de agora**, não a
que cada execução passada usou.

Para o log — a prova direta, com a linha `expurgo da trilha pseudonimizada: N
registros apagados (retenção 365 dias, corte em …)`:

```
az monitor log-analytics query -w "$(az containerapp env show -n cae-waveai-prod -g rg-waveai-prod --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv)" --analytics-query "ContainerAppConsoleLogs_CL | where Log_s contains 'expurgo' | project TimeGenerated, ContainerAppName_s, Log_s | order by TimeGenerated desc | take 30" -o table
```

**Três armadilhas, todas medidas em 2026-08-29:**

1. **`az containerapp job logs show` não serve para execução passada.** Ele lê a
   réplica **viva**, e réplica de execução encerrada é reciclada — a resposta é
   `No replicas found for execution`. Ele também exige `--container`, que não é
   opcional (foi este defeito, no `deploy.yml`, que a conferência revelou).
2. **A consulta filtra pelo TEXTO do log, e não pelo nome do app, de propósito.**
   Nas linhas de job a coluna `ContainerAppName_s` vem **vazia** — um
   `where ContainerAppName_s == 'caj-waveai-purge'` devolveria zero linhas e
   pareceria "o expurgo não rodou". Filtrar pela frase que o script imprime
   procura diretamente a asserção que interessa.
3. **A extensão `log-analytics` é preview** e a CLI pede confirmação para
   instalá-la na primeira vez.

Saída esperada hoje — uma linha por execução, com o corte exatamente 365 dias
antes:

```
2026-08-29T04:00:17Z  expurgo da trilha pseudonimizada: 0 registros apagados (retenção 365 dias, corte em 2025-08-29T04:00:15…)
```

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
