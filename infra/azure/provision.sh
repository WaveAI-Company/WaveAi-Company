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
JOB_MIGRACAO="${WAVEAI_AZ_JOB_MIGRATE:-caj-waveai-migrate}"
JOB_EXPURGO="${WAVEAI_AZ_JOB_PURGE:-caj-waveai-purge}"
# 04:00 UTC = 01:00 no horário de Brasília. O expurgo apaga registro com um ano
# de idade: a hora exata não importa, mas a madrugada evita disputar CPU com
# quem estiver usando o produto.
CRON_EXPURGO="${WAVEAI_AZ_PURGE_CRON:-0 4 * * *}"

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

# Um app recém-criado leva alguns segundos até sair de "InProgress". Mexer nele
# antes disso devolve `(InternalServerError) Internal server error occurred` —
# erro opaco que não diz o que houve. Aconteceu na segunda execução real, em
# 2026-08-24, no `secret set` logo após o `create`.
aguardar_app() {
  local app="$1" estado=""
  for _ in $(seq 1 60); do
    estado="$(az containerapp show --name "${app}" --resource-group "${GRUPO}" --query properties.provisioningState -o tsv 2>/dev/null || echo "")"
    if [ "${estado}" = "Succeeded" ]; then
      echo "    ${app}: pronto"
      return 0
    fi
    if [ "${estado}" = "Failed" ]; then
      echo "ERRO: ${app} está em estado Failed. Veja no portal o que houve antes de rodar de novo." >&2
      return 1
    fi
    sleep 5
  done
  echo "ERRO: ${app} não ficou pronto em 5 minutos (último estado: ${estado:-desconhecido})" >&2
  return 1
}

# Um segredo por chamada, e não os quatro de uma vez: quando a Azure devolve um
# erro genérico, saber QUAL falhou é a diferença entre corrigir e adivinhar.
# O retry existe porque erro interno aqui costuma ser transitório.
definir_segredo() {
  local nome="$1" valor="$2" tentativa
  for tentativa in 1 2 3 4 5; do
    if az containerapp secret set \
        --name "${APP_API}" --resource-group "${GRUPO}" \
        --secrets "${nome}=${valor}" --only-show-errors >/dev/null 2>&1; then
      echo "    ${nome}: definido"
      return 0
    fi
    echo "    ${nome}: tentativa ${tentativa} falhou; nova tentativa em $((tentativa * 10))s"
    sleep $((tentativa * 10))
  done
  echo "ERRO: não consegui definir o segredo '${nome}' após 5 tentativas." >&2
  echo "      O valor NÃO é impresso aqui de propósito. Confira se ele tem quebra de linha." >&2
  return 1
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

# Esperar os dois antes de qualquer alteração: é o app que precisa estar
# estável, e a Analysis também será atualizada pelo pipeline depois.
echo "==> aguardando os apps ficarem prontos"
aguardar_app "${APP_ANALYSIS}"
aguardar_app "${APP_API}"

echo "==> segredos da API"
definir_segredo jwt-secret "${WAVEAI_API_JWT_SECRET}"
definir_segredo result-encryption-key "${WAVEAI_API_RESULT_ENCRYPTION_KEY}"
definir_segredo database-url "${WAVEAI_API_DATABASE_URL}"
definir_segredo smtp-password "${WAVEAI_API_SMTP_PASSWORD}"

echo "==> variáveis da API"
aguardar_app "${APP_API}"
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

# -- Job de migração ---------------------------------------------------------
# A migração é passo do PIPELINE, nunca do boot (decisão 4 da ADR-0049): migrar
# no boot faria duas instâncias rodarem a mesma migração ao mesmo tempo no dia
# em que houver duas. Como Job de gatilho manual, quem decide quando rodar é o
# workflow — e ele aborta o deploy se isto falhar.
#
# Usa a MESMA imagem da API: `alembic.ini` e `migrations/` já estão lá dentro.
#
# SEM SHELL, e isto não é preferência de estilo. A primeira tentativa foi
# `--command "/bin/sh" "-c" "alembic upgrade head"` e a CLI recusou com
# `unrecognized arguments: -c alembic upgrade head` (2026-08-24): o parser para
# de consumir valores ao encontrar `-c`, porque **parece uma flag**. Chamar o
# executável direto, com argumentos que não começam por hífen, contorna isso e
# ainda dispensa um shell no meio do caminho. O mesmo cuidado vale para
# qualquer job futuro — inclusive o do expurgo.
echo "==> job ${JOB_MIGRACAO}"
if ! az containerapp job show --name "${JOB_MIGRACAO}" --resource-group "${GRUPO}" >/dev/null 2>&1; then
  az containerapp job create \
    --name "${JOB_MIGRACAO}" \
    --resource-group "${GRUPO}" \
    --environment "${AMBIENTE}" \
    --trigger-type Manual \
    --replica-timeout 600 \
    --replica-retry-limit 0 \
    --replica-completion-count 1 \
    --parallelism 1 \
    --image "${IMAGEM_PROVISORIA}" \
    --cpu 0.5 --memory 1.0Gi \
    --command "alembic" \
    --args "upgrade" "head" \
    --registry-server "${REGISTRO}" \
    --registry-username "${GHCR_USER}" \
    --registry-password "${GHCR_TOKEN}" \
    --only-show-errors >/dev/null
  echo "    criado — o pipeline troca a imagem antes de cada execução"
else
  echo "    (já existe)"
fi

# `--replica-retry-limit 0` é deliberado: migração que falhou não deve ser
# repetida sozinha. Alembic é transacional, mas repetir às cegas esconde a causa
# — e o pipeline precisa PARAR, não insistir.
echo "==> segredos do job de migração"
for par in \
  "jwt-secret=${WAVEAI_API_JWT_SECRET}" \
  "result-encryption-key=${WAVEAI_API_RESULT_ENCRYPTION_KEY}" \
  "database-url=${WAVEAI_API_DATABASE_URL}"
do
  az containerapp job secret set \
    --name "${JOB_MIGRACAO}" --resource-group "${GRUPO}" \
    --secrets "${par}" --only-show-errors >/dev/null
  echo "    ${par%%=*}: definido"
done

# O job carrega JWT e chave de cifra porque o `Settings` os valida ao ser
# importado — fail-closed (ADR-0023/0026). Ele não os usa para migrar; sem eles,
# o processo nem chega ao Alembic.
az containerapp job update \
  --name "${JOB_MIGRACAO}" --resource-group "${GRUPO}" \
  --set-env-vars \
    WAVEAI_API_APP_ENV=production \
    WAVEAI_API_JWT_SECRET=secretref:jwt-secret \
    WAVEAI_API_RESULT_ENCRYPTION_KEY=secretref:result-encryption-key \
    WAVEAI_API_DATABASE_URL=secretref:database-url \
  --only-show-errors >/dev/null

# -- Job do expurgo ----------------------------------------------------------
# É ESTE job que faz a Política de Privacidade parar de dever prazo: ela promete
# apagar em até 12 meses a trilha de leitura que perdeu o dono, e sem alguém
# executando a rotina o texto publicado afirma o que o produto não faz
# (ADR-0027 e a emenda à ADR-0047).
#
# `python scripts/purge_audit_trail.py` com `PYTHONPATH=/app`, e NÃO
# `python -m scripts.purge_audit_trail`: o `-m` esbarraria no mesmo parser que
# recusou o `-c` do job de migração. Verificado dentro da imagem em 2026-08-24 —
# sem `PYTHONPATH` o import de `app` falha; com ele, o script roda chamado por
# caminho, sem hífen nenhum no comando.
echo "==> job ${JOB_EXPURGO} (cron: ${CRON_EXPURGO})"
if ! az containerapp job show --name "${JOB_EXPURGO}" --resource-group "${GRUPO}" >/dev/null 2>&1; then
  az containerapp job create \
    --name "${JOB_EXPURGO}" \
    --resource-group "${GRUPO}" \
    --environment "${AMBIENTE}" \
    --trigger-type Schedule \
    --cron-expression "${CRON_EXPURGO}" \
    --replica-timeout 600 \
    --replica-retry-limit 1 \
    --replica-completion-count 1 \
    --parallelism 1 \
    --image "${IMAGEM_PROVISORIA}" \
    --cpu 0.25 --memory 0.5Gi \
    --command "python" \
    --args "scripts/purge_audit_trail.py" \
    --registry-server "${REGISTRO}" \
    --registry-username "${GHCR_USER}" \
    --registry-password "${GHCR_TOKEN}" \
    --only-show-errors >/dev/null
  echo "    criado — o pipeline troca a imagem a cada deploy"
else
  echo "    (já existe)"
fi

# Diferente da migração, aqui uma repetição é segura: apagar o que já venceu é
# idempotente, e a falha mais provável é conexão intermitente com o banco.
echo "==> segredos do job de expurgo"
for par in \
  "jwt-secret=${WAVEAI_API_JWT_SECRET}" \
  "result-encryption-key=${WAVEAI_API_RESULT_ENCRYPTION_KEY}" \
  "database-url=${WAVEAI_API_DATABASE_URL}"
do
  az containerapp job secret set \
    --name "${JOB_EXPURGO}" --resource-group "${GRUPO}" \
    --secrets "${par}" --only-show-errors >/dev/null
  echo "    ${par%%=*}: definido"
done

az containerapp job update \
  --name "${JOB_EXPURGO}" --resource-group "${GRUPO}" \
  --set-env-vars \
    PYTHONPATH=/app \
    WAVEAI_API_APP_ENV=production \
    WAVEAI_API_JWT_SECRET=secretref:jwt-secret \
    WAVEAI_API_RESULT_ENCRYPTION_KEY=secretref:result-encryption-key \
    WAVEAI_API_DATABASE_URL=secretref:database-url \
    WAVEAI_API_AUDIT_PSEUDONYM_RETENTION_DAYS=365 \
  --only-show-errors >/dev/null

FQDN_API="$(az containerapp show --name "${APP_API}" --resource-group "${GRUPO}" --query properties.configuration.ingress.fqdn -o tsv)"

cat <<FIM

==========================================================================
Provisionado.

  API (endereço provisório do provedor): https://${FQDN_API}
  Analysis (interno, sem acesso externo): ${ANALYSIS_URL}

O QUE AINDA NÃO ESTÁ FEITO:
  - Numa assinatura nova, as imagens são PROVISÓRIAS até o primeiro deploy.
    O pipeline publica as nossas e troca a dos dois jobs também.
  - Nenhuma migration roda aqui. É passo do pipeline, nunca do boot.
  - O domínio api.waveai.tec.br é vinculado por
    'bash infra/azure/vincular-dominio.sh' — precisa de registros no DNS.

NÃO USE o endereço acima como produção: ele é de outro domínio registrável,
e o cookie de sessão SameSite=Lax não viaja — o login no web não funcionaria.
Ele serve para conferir /health e nada mais.
==========================================================================
FIM
