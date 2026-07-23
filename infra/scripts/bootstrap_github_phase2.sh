#!/usr/bin/env bash
#
# bootstrap_github_phase2.sh — cria o milestone e as issues da FASE 2
# (Motor de Analise & Ciencia de Dados) do WaveAI.
#
# Irmao do bootstrap_github.sh (que cria M0-M5 do MVP). Foi separado de
# proposito: NAO recria os milestones/issues do MVP, entao pode rodar sem
# risco de duplicar aquilo. Ainda assim, NAO rode este DUAS vezes (duplicaria
# as issues da Fase 2).
#
# Requisitos: GitHub CLI (gh) autenticado (`gh auth login`) e executar no repo.
# Uso:  bash infra/scripts/bootstrap_github_phase2.sh [owner/repo]
#
# A especificacao completa (objetivo, criterios de aceite como testes
# sinteticos e ADRs/docs que cada issue concretiza) esta em
# Documentation/13_Analysis_Phase_Work_Breakdown.md.

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
DOC="Documentation/13_Analysis_Phase_Work_Breakdown.md"
MS="Fase 2 - Analise e Ciencia"
echo "Repositorio: $REPO"

# --- Milestone (idempotente: ignora se ja existir) ---
if gh api "repos/$REPO/milestones" \
     -f title="$MS" \
     -f description="Motor de analise aprofundado, validacao de sinal e corpus de pesquisa (ver $DOC)." \
     >/dev/null 2>&1; then
  echo "  milestone criado: $MS"
else
  echo "  milestone ja existe/ignorado: $MS"
fi

# --- Issues ---
issue () { # $1=titulo  $2=corpo-extra
  gh issue create --repo "$REPO" --milestone "$MS" --title "$1" \
    --body "$2"$'\n\n'"Especificacao completa (objetivo, criterios de aceite como testes sinteticos e ADRs/docs): $DOC. Regras rigidas: analise atras de AnalysisEngine (versionada; engine_version + device/montagem no Result, ADR-0033); testes/CI 100% sinteticos; ciencia so sintetico/autocaptacao do dev (ADR-0028); corpus de pesquisa separado da producao, unico com raw (ADR-0025/0030); sem claim clinica (Medical/71); termo 'anomalia' proibido (ADR-0032)." \
    >/dev/null && echo "  issue: $1"
}
echo "Criando issues da Fase 2..."

# N4 — Engenharia de dados / pipeline de pesquisa (pre-requisito p/ armazenar a recoleta)
issue "corpus de pesquisa: store Parquet content-addressed + indice Postgres (N4-a)" \
  "Substrato de pesquisa fisicamente separado da producao (ADR-0030): raw 512 Hz + janelas em Parquet content-addressed em disco; Postgres so como indice/metadados (sessao, device, montagem, condicao experimental, poor_signal, ponteiros de arquivo). Corpus gitignored; nunca vira fixture/seed (ADR-0028). Aceite (testes sinteticos): escrita retorna hash do conteudo e deduplica conteudo identico; round-trip raw->Parquet->leitura preserva amostras e fs; linha de indice grava device/montagem/condicao e resolve ponteiros; separacao fisica do banco de producao (teste falha se apontarem para o mesmo); indice aceita montagem canais x amostras com NeuroSky preenchendo N=1 (ADR-0033)."

issue "corpus de pesquisa: DVC + tetrade de proveniencia + CLI de ingestao (N4-b)" \
  "Git+DVC para datasets/artefatos (ADR-0030). Todo Result de pesquisa amarra a TETRADE: commit Git, versao DVC do dataset, engine_version, hiperparametros (doc 31 §12). CLI 'research ingest' move sintetico/autocaptacao ao corpus e registra a proveniencia. Aceite (testes sinteticos): gravar Result sem um dos 4 campos -> erro (nao persiste); ingestao cria id imutavel e e idempotente por conteudo; determinismo (mesma entrada + mesmo engine_version + mesmos hiperparametros -> hash de saida identico); remote DVC local/descartavel (nunca push de autocaptacao, ADR-0028)."

# N1 — Estudo de fidelidade executado (de-risking existencial)
issue "estudo de fidelidade: recoleta Exp. B pre-registrada + Relatorio (N1)" \
  "Executar a coleta INTERCALADA OF/OA/OF/OA/OF/OA de 60s em uma unica colocacao (autocaptacao do dev, ADR-0028), armazenar no corpus (N4) com proveniencia, rodar o pipeline TRAVADO (doc 31 §12) e escrever o Relatorio de Fidelidade (H-SIG-01). A captacao real e passo MANUAL do titular=operador (nao e teste de CI). Aceite (testes sinteticos + entregavel): regressao do pipeline travado (detrend -> passa-banda 1-45 -> notch 60 -> epocas 4s -> Welch -> alfa RELATIVA) com alfa OF injetada maior -> passed=True; teste ANTI-FALSO-POSITIVO (OF ~ OA -> nao passa; nenhum estimador forca significancia); fs calculado por bloco pelo tempo real (regressao do bug de §8.1); cada sessao grava poor_signal + condicao + tetrade; entregavel Relatorio de Fidelidade + atualizacao de H-SIG-01."

# N2 — Catalogo de Features (pre-requisito de D3/ADR-0032)
issue "catalogo de features: DataScience/32 + implementacao no wave_eeg (N2)" \
  "Formalizar cada feature (nome, formula, faixa, interpretacao, dependencia de montagem) em DataScience/32 e implementar no wave_eeg com testes. NAO define evento (ordem ADR-0032: evento vem DEPOIS do catalogo). Aceite (testes sinteticos): cada feature catalogada tem teste com valor esperado conhecido (seno puro 10 Hz -> alfa domina; potencias relativas somam 1; absolutas >= 0; sinal plano e definido, sem NaN/divisao por zero); todo resultado carrega engine_version (retrocompativel com o Result atual); nenhuma feature usa/expoe o termo 'anomalia'."

# Doc — alinhar §E6 a ADR-0032
issue "docs: reescrever DataScience/30 §E6 sem 'anomalia' (alinhar ADR-0032)" \
  "Substituir 'pico/estabilizacao/anomalia' por vocabulario defensavel: contrastes de estado + desvio de baseline pessoal (N sigma); explicitar cold-start populacional -> individual e transparencia do que e pessoal vs populacional + nivel de confianca (ADR-0032, Medical/71). Sem tocar em codigo de produto. Aceite (teste-como-contrato): guard de CI garante ausencia de 'anomal*' em codigo/UI (packages, services, apps) e no DataScience/30; §E6 referencia ADR-0032 e distingue populacional vs pessoal."

echo "Concluido. Verifique em: https://github.com/$REPO/milestones e /issues"
