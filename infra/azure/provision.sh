#!/usr/bin/env bash
#
# Provisiona a infraestrutura do WaveAI na Azure (ADR-0049 + emenda de 2026-08-23).
#
# POR QUE UM SCRIPT E NÃO CLIQUES NO PORTAL: o crédito expira e um dia isto vai
# precisar ser refeito — aqui ou em outra nuvem. Cliques não se versionam, não se
# revisam em PR e não dizem por que foram dados. Ver `infra/RUNBOOK_PORTABILIDADE.md`.
#
# IDEMPOTENTE: rodar de novo não duplica nada. Cada recurso é criado apenas se
# ainda não existir; o que já existe é atualizado.
#
# NÃO CONTÉM SEGREDO NENHUM. Tudo o que é sigiloso vem do ambiente e o script
# recusa-se a rodar sem — mesmo fail-closed do `docker-compose` (ADR-0023/0026).
#
# COMO RODAR (sem instalar nada): abra o Azure Cloud Shell no portal, em modo
# Bash, envie este arquivo e execute. Localmente, exige `az` e `az login`.
#
#   export WAVEAI_API_JWT_SECRET='...'            # openssl rand -hex 32
#   export WAVEAI_API_RESULT_ENCRYPTION_KEY='...' # Fernet.generate_key()
#   export WAVEAI_API_DATABASE_URL='...'          # string do Neon
#   export WAVEAI_API_SMTP_PASSWORD='...'         # senha de app do Gmail
#   export GHCR_USER='...' GHCR_TOKEN='...'       # PAT com read:packages
#   bash infra/azure/provision.sh
#
set -euo pipefail

# -- Nomes e região ----------------------------------------------------------
# `brazilsouth` não é preferência: mantém dado derivado de EEG em território
# brasileiro (decisão 9 da ADR-0049), e a Política de Privacidade declara isso.
LOCALIZACAO="${WAVEAI_AZ_LOCATION:-brazilsouth}"
GRUPO="${WAVEAI_AZ_RESOURCE_GROUP:-rg-waveai-prod}"
AMBIENTE="${WAVEAI_AZ_ENVIRONMENT:-cae-waveai-prod}"
APP_API="${WAVEAI_AZ_APP_API:-ca-waveai-api}"
APP_ANALYSIS="${WAVEAI_AZ_APP_ANALYSIS:-ca-waveai-analysis}"

# Registro de imagens no GHCR e não no Azure Container Registry: o ACR Basic
# custaria por volta de US$5/mês, mais da metade do que o crédito representa por
# mês. O GHCR é gratuito, já é do GitHub que hospeda código e CI, e qualquer
# nuvem puxa de lá — o que mantém barata a saída que o runbook descreve.
REGISTRO="${WAVEAI_GHCR_HOST:-ghcr.io}"
IMAGEM_API="${WAVEAI_IMAGE_API:-ghcr.io/waveai-company/waveai-api:latest}"
IMAGEM_ANALYSIS="${WAVEAI_IMAGE_ANALYSIS:-ghcr.io/waveai-company/waveai-analysis:latest}"

# Imagem de partida enquanto o pipeline ainda não publicou a nossa. Os apps
# precisam de ALGUMA imagem para existir; o primeiro deploy real as substitui.
IMAGEM_PROVISORIA="mcr.microsoft.com/k8se/quickstart:latest"

# Domínio do app web (Cloudflare Pages), já no ar. É a origem que o CORS libera
# e a base dos links que vão nos e-mails.
APP_URL="${WAVEAI_APP_URL:-https://waveai.tec.br}"

# -- Conferências antes de tocar em qualquer coisa ---------------------------

falta=()
for obrigatoria in \
  WAVEAI_API_JWT_SECRET \
  WAVEAI_API_RESULT_ENCRYPTION_KEY \
  WAVEAI_API_DATABASE_URL \
  WAVEAI_API_SMTP_PASSWORD \
  GHCR_USER \
  GHCR_TOKEN
do
  if [ -z "${!obrigatoria:-}" ]; then falta+=("$obrigatoria"); fi
done

if [ ${#falta[@]} -gt 0 ]; then
  echo "ERRO: variáveis de ambiente obrigatórias ausentes:" >&2
  printf '  - %s\n' "${falta[@]}" >&2
  echo "" >&2
  echo "Nenhuma delas pode viver neste arquivo nem no repositório." >&2
  echo "Ver o cabeçalho deste script para como gerar cada uma." >&2
  exit 1
fi

command -v az >/dev/null 2>&1 || { echo "ERRO: 'az' não encontrado. Use o Azure Cloud Shell ou instale a CLI." >&2; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERRO: sem sessão. Rode 'az login'." >&2; exit 1; }

echo "==> assinatura: $(az account show --query name -o tsv)"
echo "==> grupo: ${GRUPO} | região: ${LOCALIZACAO}"

# -- Extensão e provedores ---------------------------------------------------
# Necessários na PRIMEIRA vez em qualquer assinatura nova.
#
# `--wait` NÃO é zelo excessivo: sem ele, `az provider register` devolve o
# controle imediatamente enquanto o registro corre de forma ASSÍNCRONA, e o
# `containerapp env create` logo abaixo falha com "Subscription is not
# registered for the Microsoft.OperationalInsights resource provider".
# Aconteceu na primeira execução real, em 2026-08-24.
#
# A consulta antes evita esperar de novo quando já está pronto — é o que mantém
# o script idempotente sem custar minutos a cada rodada.
registrar_provider() {
  local ns="$1" estado
  estado="$(az provider show --namespace "${ns}" --query registrationState -o tsv 2>/dev/null || echo NotRegistered)"
  if [ "${estado}" = "Registered" ]; then
    echo "    ${ns}: já registrado"
    return
  fi
  echo "    ${ns}: registrando — leva alguns minutos na primeira vez, aguarde"
  az provider register --namespace "${ns}" --wait --only-show-errors >/dev/null
  echo "    ${ns}: pronto"
}

echo "==> garantindo extensão e provedores"
az extension add --name containerapp --upgrade --only-show-errors >/dev/null
registrar_provider Microsoft.App
registrar_provider Microsoft.OperationalInsights

# -- Grupo de recursos -------------------------------------------------------
# Tudo num grupo só: apagar o grupo apaga o ambiente inteiro, que é o que torna
# "recomeçar do zero" uma operação de um comando.
echo "==> grupo de recursos"
az group create --name "${GRUPO}" --location "${LOCALIZACAO}" --only-show-errors >/dev/null

# -- Ambiente do Container Apps ----------------------------------------------
echo "==> ambiente ${AMBIENTE}"
if ! az containerapp env show --name "${AMBIENTE}" --resource-group "${GRUPO}" >/dev/null 2>&1; then
  az containerapp env create \
    --name "${AMBIENTE}" \
    --resource-group "${GRUPO}" \
    --location "${LOCALIZACAO}" \
    --only-show-errors >/dev/null
else
  echo "    (já existe)"
fi

# O domínio interno só é conhecido depois que o ambiente existe; é dele que sai
# o endereço pelo qual a API fala com a Analysis sem passar pela internet.
DOMINIO_INTERNO="$(az containerapp env show --name "${AMBIENTE}" --resource-group "${GRUPO}" --query properties.defaultDomain -o tsv)"
ANALYSIS_URL="https://${APP_ANALYSIS}.internal.${DOMINIO_INTERNO}"
echo "==> Analysis responderá em ${ANALYSIS_URL}"

# -- Analysis ----------------------------------------------------------------
# INGRESS INTERNO, e isto é decisão e não detalhe: a Analysis não tem
# autenticação própria — quem a protege é não estar alcançável de fora. No
# compose isso acontece por acidente de topologia; aqui é explícito.
#
# maxReplicas 1 NÃO é economia (decisão 3 da ADR-0049): o fan-out ao vivo e o
# rate limiter vivem na memória do processo. Com duas réplicas, o profissional
# deixa de ver a transmissão do paciente — sem erro e sem log.
echo "==> app ${APP_ANALYSIS} (interno)"
if ! az containerapp show --name "${APP_ANALYSIS}" --resource-group "${GRUPO}" >/dev/null 2>&1; then
  az containerapp create \
    --name "${APP_ANALYSIS}" \
    --resource-group "${GRUPO}" \
    --environment "${AMBIENTE}" \
    --image "${IMAGEM_PROVISORIA}" \
    --target-port 8001 \
    --ingress internal \
    --min-replicas 0 \
    --max-replicas 1 \
    --cpu 0.5 --memory 1.0Gi \
    --env-vars WAVEAI_ANALYSIS_APP_ENV=production \
    --registry-server "${REGISTRO}" \
    --registry-username "${GHCR_USER}" \
    --registry-password "${GHCR_TOKEN}" \
    --only-show-errors >/dev/null
  echo "    criado com imagem provisória — o pipeline publica ${IMAGEM_ANALYSIS}"
else
  echo "    (já existe)"
fi

# -- API ---------------------------------------------------------------------
# Segredos entram como `secrets` do Container Apps e são referenciados por nome
# (`secretref:`), nunca como valor literal em variável de ambiente: assim não
# aparecem em `az containerapp show` nem nos logs de deploy.
echo "==> app ${APP_API} (externo)"
if ! az containerapp show --name "${APP_API}" --resource-group "${GRUPO}" >/dev/null 2>&1; then
  az containerapp create \
    --name "${APP_API}" \
    --resource-group "${GRUPO}" \
    --environment "${AMBIENTE}" \
    --image "${IMAGEM_PROVISORIA}" \
    --target-port 8000 \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 1 \
    --cpu 0.5 --memory 1.0Gi \
    --registry-server "${REGISTRO}" \
    --registry-username "${GHCR_USER}" \
    --registry-password "${GHCR_TOKEN}" \
    --only-show-errors >/dev/null
  echo "    criado com imagem provisória — o pipeline publica ${IMAGEM_API}"
else
  echo "    (já existe)"
fi

echo "==> segredos da API"
az containerapp secret set \
  --name "${APP_API}" \
  --resource-group "${GRUPO}" \
  --secrets \
    jwt-secret="${WAVEAI_API_JWT_SECRET}" \
    result-encryption-key="${WAVEAI_API_RESULT_ENCRYPTION_KEY}" \
    database-url="${WAVEAI_API_DATABASE_URL}" \
    smtp-password="${WAVEAI_API_SMTP_PASSWORD}" \
  --only-show-errors >/dev/null

echo "==> variáveis da API"
az containerapp update \
  --name "${APP_API}" \
  --resource-group "${GRUPO}" \
  --set-env-vars \
    WAVEAI_API_APP_ENV=production \
    WAVEAI_API_JWT_SECRET=secretref:jwt-secret \
    WAVEAI_API_RESULT_ENCRYPTION_KEY=secretref:result-encryption-key \
    WAVEAI_API_DATABASE_URL=secretref:database-url \
    WAVEAI_API_SMTP_PASSWORD=secretref:smtp-password \
    WAVEAI_API_ANALYSIS_URL="${ANALYSIS_URL}" \
    WAVEAI_API_CORS_ORIGINS="${APP_URL}" \
    WAVEAI_API_EMAIL_LINK_BASE_URL="${APP_URL}" \
    WAVEAI_API_SMTP_HOST=smtp.gmail.com \
    WAVEAI_API_SMTP_PORT=587 \
    WAVEAI_API_SMTP_USER=waveai999.company@gmail.com \
    "WAVEAI_API_EMAIL_FROM=WaveAI <waveai999.company@gmail.com>" \
    WAVEAI_API_AUDIT_PSEUDONYM_RETENTION_DAYS=365 \
  --only-show-errors >/dev/null

FQDN_API="$(az containerapp show --name "${APP_API}" --resource-group "${GRUPO}" --query properties.configuration.ingress.fqdn -o tsv)"

cat <<FIM

==========================================================================
Provisionado.

  API (endereço provisório do provedor): https://${FQDN_API}
  Analysis (interno, sem acesso externo): ${ANALYSIS_URL}

O QUE AINDA NÃO ESTÁ FEITO:
  - As imagens são PROVISÓRIAS. O pipeline publica as nossas (fatia 3b).
  - Nenhuma migration rodou. É passo do pipeline, nunca do boot.
  - O expurgo não está agendado (fatia 3c) — e sem ele a Política promete
    um prazo que ninguém cumpre.
  - api.waveai.tec.br não aponta para cá (fatia 3c).

NÃO USE o endereço acima como produção: ele é de outro domínio registrável,
e o cookie de sessão SameSite=Lax não viaja — o login no web não funcionaria.
Ele serve para conferir /health e nada mais.
==========================================================================
FIM
