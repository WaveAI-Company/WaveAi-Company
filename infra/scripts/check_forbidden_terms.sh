#!/usr/bin/env bash
#
# check_forbidden_terms.sh — guarda o vocabulario nao-clinico (ADR-0032).
#
# O termo "anomalia"/"anomaly" foi ABANDONADO por soar clinico/diagnostico,
# nos lugares que a ADR-0032 rege: CODIGO, UI e a estrategia de sinal
# (DataScience/30). Registros de decisao (ADRs, perguntas em aberto, visao,
# objetivos) PODEM cita-lo para explicar o proprio abandono — por isso o
# escopo aqui e RESTRITO, nao o repositorio inteiro. Vocabulario defensavel:
# contraste de estado ou desvio de baseline pessoal (N sigma).
#
# Roda no CI (job lint-vocabulary) e reprova o PR se o termo reaparecer onde
# nao deve.  Uso:  bash infra/scripts/check_forbidden_terms.sh
set -euo pipefail

# `git grep` so varre arquivos versionados -> node_modules/build (gitignored)
# ficam de fora automaticamente. Flags: -n linha, -I ignora binarios,
# -i case-insensitive.
PATHS=(packages services apps DataScience/30_EEG_Signal_Processing_Strategy.md)

# git grep sai 0 quando ENCONTRA (ai reprovamos) e 1 quando nada acha.
if git grep -nIi -e 'anomal' -- "${PATHS[@]}"; then
  {
    echo ""
    echo "ERRO: termo proibido 'anomalia/anomaly' encontrado (ADR-0032)."
    echo "Use vocabulario defensavel: contraste de estado ou desvio de"
    echo "baseline pessoal (N sigma). Registros de decisao (05_Decisions,"
    echo "04_Open_Questions, etc.) estao fora deste escopo de proposito."
  } >&2
  exit 1
fi

echo "OK: nenhum termo proibido em ${PATHS[*]} (ADR-0032)."
