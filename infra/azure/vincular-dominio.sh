#!/usr/bin/env bash
#
# Vincula `api.waveai.tec.br` ao Container App da API e emite o certificado.
#
# POR QUE UM SCRIPT SEPARADO DO `provision.sh`: este processo tem um passo
# MANUAL no meio — criar dois registros no DNS da Cloudflare — e a Azure só
# consegue validar o domínio depois que eles existirem e propagarem. Misturar
# isso no provisionamento faria o script falhar em toda execução até alguém
# lembrar de mexer no DNS.
#
# POR QUE O DOMÍNIO PRÓPRIO É OBRIGATÓRIO, e não estética: o refresh token é
# cookie `SameSite=Lax` (emenda à ADR-0049). Entre `waveai.tec.br` e
# `algo.azurecontainerapps.io` o navegador NÃO envia o cookie, e o login no web
# para de funcionar. Sob `api.waveai.tec.br` é o mesmo site registrável.
#
# USO, em duas etapas:
#   bash infra/azure/vincular-dominio.sh            # mostra os registros
#   ...crie os registros na Cloudflare e espere propagar...
#   bash infra/azure/vincular-dominio.sh --vincular # valida e emite o certificado
#
set -euo pipefail

GRUPO="${WAVEAI_AZ_RESOURCE_GROUP:-rg-waveai-prod}"
AMBIENTE="${WAVEAI_AZ_ENVIRONMENT:-cae-waveai-prod}"
APP_API="${WAVEAI_AZ_APP_API:-ca-waveai-api}"
DOMINIO="${WAVEAI_API_HOSTNAME:-api.waveai.tec.br}"

command -v az >/dev/null 2>&1 || { echo "ERRO: 'az' não encontrado. Use o Azure Cloud Shell." >&2; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERRO: sem sessão. Rode 'az login'." >&2; exit 1; }

FQDN="$(az containerapp show --name "${APP_API}" --resource-group "${GRUPO}" --query properties.configuration.ingress.fqdn -o tsv)"
VERIFICACAO="$(az containerapp show --name "${APP_API}" --resource-group "${GRUPO}" --query properties.customDomainVerificationId -o tsv)"

if [ "${1:-}" != "--vincular" ]; then
  cat <<FIM
==========================================================================
ETAPA 1 — crie estes dois registros no DNS da Cloudflare

  Tipo   Nome         Conteúdo
  ----   ----------   ----------------------------------------------------
  CNAME  api          ${FQDN}
  TXT    asuid.api    ${VERIFICACAO}

O TXT é o que prova à Azure que o domínio é seu. Sem ele, a emissão do
certificado é recusada — e a mensagem de erro não diz que o problema é este.

>>> IMPORTANTE: o CNAME precisa ficar em "DNS only" (nuvem CINZA), não em
    "Proxied" (nuvem LARANJA).

Com o proxy ligado, quem responde no endereço é a Cloudflare, e a Azure não
consegue alcançar o Container App para validar o domínio nem para emitir o
certificado. Ligar o proxy depois é decisão à parte, que exige entender como
os dois certificados se sobrepõem — não faça isso agora.

Depois de criar os registros, confira a propagação antes de seguir:

  dig +short api.waveai.tec.br CNAME
  dig +short asuid.api.waveai.tec.br TXT

Quando os dois responderem, rode:

  bash infra/azure/vincular-dominio.sh --vincular
==========================================================================
FIM
  exit 0
fi

echo "==> conferindo o DNS antes de pedir o certificado"
# Conferir aqui evita o erro mais comum: pedir a validação cedo demais e
# receber uma mensagem que não explica o que faltou.
if command -v dig >/dev/null 2>&1; then
  cname="$(dig +short "${DOMINIO}" CNAME || true)"
  txt="$(dig +short "asuid.${DOMINIO}" TXT || true)"
  echo "    CNAME: ${cname:-(vazio)}"
  echo "    TXT:   ${txt:-(vazio)}"
  if [ -z "${cname}" ] || [ -z "${txt}" ]; then
    echo "ERRO: um dos registros ainda não responde. Espere a propagação e tente de novo." >&2
    exit 1
  fi
else
  echo "    (sem 'dig' aqui; seguindo sem conferir)"
fi

echo "==> registrando o hostname"
if ! az containerapp hostname list --name "${APP_API}" --resource-group "${GRUPO}" -o tsv 2>/dev/null | grep -q "${DOMINIO}"; then
  az containerapp hostname add \
    --name "${APP_API}" --resource-group "${GRUPO}" \
    --hostname "${DOMINIO}" --only-show-errors >/dev/null
else
  echo "    (já registrado)"
fi

echo "==> validando e emitindo o certificado gerenciado (pode levar alguns minutos)"
az containerapp hostname bind \
  --name "${APP_API}" --resource-group "${GRUPO}" \
  --hostname "${DOMINIO}" \
  --environment "${AMBIENTE}" \
  --validation-method CNAME \
  --only-show-errors >/dev/null

cat <<FIM

==========================================================================
Vinculado.

  https://${DOMINIO}

CONFIRA, nesta ordem:

  1. curl -s -o /dev/null -w '%{http_code}\n' https://${DOMINIO}/health
     Deve responder 200. Se responder 000 ou demorar muito, é cold start:
     tente de novo.

  2. Abra https://waveai.tec.br e faça login.
     É este o teste que prova o cookie de sessão viajando entre o app e a
     API — nenhum comando de linha consegue provar isso por você.
==========================================================================
FIM
