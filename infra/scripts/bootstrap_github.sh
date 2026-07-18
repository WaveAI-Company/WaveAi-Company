#!/usr/bin/env bash
#
# bootstrap_github.sh — cria os milestones (M0–M5) e as 18 issues do MVP do WaveAI.
# Requisitos: GitHub CLI (gh) autenticado (`gh auth login`) e executar dentro do repo.
# Uso:  bash infra/scripts/bootstrap_github.sh [owner/repo]
#
# A especificação completa (escopo, aceite, testes) de cada issue está em
# Documentation/11_MVP_Work_Breakdown.md. Este script cria issues enxutas que
# apontam para lá. NÃO rode duas vezes (duplicaria as issues).

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
DOC="Documentation/11_MVP_Work_Breakdown.md"
echo "Repositório: $REPO"

# --- Milestones (idempotente: ignora se já existir) ---
create_ms () {
  if gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1; then
    echo "  milestone criado: $1"
  else
    echo "  milestone já existe/ignorado: $1"
  fi
}
echo "Criando milestones..."
create_ms "M0 - Esqueleto que anda"      "Monorepo, CI, health checks, wave-eeg migrado."
create_ms "M1 - Autenticacao"            "Cadastro/login paciente e medico, JWT, rotas por papel."
create_ms "M2 - Dominio e Medico"        "Pacientes, vinculo medico-paciente, telas (dados de teste)."
create_ms "M3 - Captacao e Streaming"    "App conecta o dispositivo, envia raw por WS, estado ao vivo."
create_ms "M4 - Analise e Dashboards"    "Servico de analise (wave_eeg), relatorio por sessao, graficos."
create_ms "M5 - Polimento de UI"         "Identidade visual por papel, responsividade, acessibilidade."

# --- Issues ---
issue () { # $1=milestone  $2=titulo  $3=corpo-extra
  gh issue create --repo "$REPO" --milestone "$1" --title "$2" \
    --body "$3"$'\n\n'"Especificacao completa (escopo, criterios de aceite e testes): $DOC. Restricoes: analise plugavel (AnalysisEngine); sem claim clinica; sem dado real; segredos fora do Git." \
    >/dev/null && echo "  issue: $2"
}
echo "Criando issues..."

# M0
issue "M0 - Esqueleto que anda" "monorepo: reestruturar e migrar wave-eeg (#1)" \
  "Criar apps/ services/ packages/ infra/ e migrar experiments/eeg-capture-spike -> packages/wave-eeg via git mv. Aceite: pytest de packages/wave-eeg verde no novo caminho; CI atualizado."
issue "M0 - Esqueleto que anda" "api: FastAPI esqueleto + GET /health (#2)" \
  "services/api em FastAPI com GET /health -> 200 {status:ok}, config por env, Dockerfile e teste."
issue "M0 - Esqueleto que anda" "analysis: FastAPI + /health + POST /analyze/demo (#3)" \
  "services/analysis importa packages/wave-eeg; POST /analyze/demo retorna rel_alpha e verdict do Exp. B sintetico."
issue "M0 - Esqueleto que anda" "app: Expo universal boot + navegacao (#4)" \
  "apps/wave-app (Expo RN + Web): roda em web (npm run web) e mobile; tela placeholder por papel."
issue "M0 - Esqueleto que anda" "infra: docker-compose + CI unificado (#5)" \
  "infra/docker-compose.yml (api, analysis, postgres); CI roda testes de api, analysis, wave-eeg e lint do app."

# M1
issue "M1 - Autenticacao" "api: modelo de usuario + migrations (#6)" \
  "User(email, hash, role em {patient,doctor}) + perfis; migrations (Alembic); hash forte (bcrypt/argon2)."
issue "M1 - Autenticacao" "api: registro + login + JWT por papel (#7)" \
  "POST /auth/register e /auth/login -> JWT (access+refresh) com role; middleware de autorizacao; papel errado -> 403."
issue "M1 - Autenticacao" "app: fluxo de auth (web+mobile) + rotas por papel (#8)" \
  "Telas de login/registro; guarda de rota; ao logar direciona UI de paciente ou medico; token persistido com seguranca."

# M2
issue "M2 - Dominio e Medico" "api: pacientes e vinculo medico-paciente (RBAC) (#9)" \
  "CareLink(doctor,patient); medico lista/adiciona pacientes vinculados; medico A nao acessa paciente de B (403)."
issue "M2 - Dominio e Medico" "app: telas do medico (lista + detalhe, mock) (#10)" \
  "Lista de pacientes e detalhe com sessoes (dados ficticios rotulados); navega no web e mobile."
issue "M2 - Dominio e Medico" "app: telas do paciente (home + historico, mock) (#11)" \
  "Home do paciente, historico de sessoes (mock) e perfil; UI responsiva."

# M3
issue "M3 - Captacao e Streaming" "app: captura de EEG (capability por plataforma) (#12)" \
  "DeviceConnection no cliente (espelha DeviceReader); impl. mobile (BLE/SPP, ver Architecture/21); web sem suporte mostra aviso."
issue "M3 - Captacao e Streaming" "api: gateway WebSocket + envio de raw autenticado (#13)" \
  "WS /stream autenticado por JWT; app envia blocos de raw; API cria Session e encaminha a Analysis."
issue "M3 - Captacao e Streaming" "analysis: analise em streaming (features ao vivo) (#14)" \
  "AnalysisEngine.process_window devolve {quality, rel_alpha, ...}; app mostra estado ao vivo (testar com simulador do wave_eeg)."

# M4
issue "M4 - Analise e Dashboards" "analysis: relatorio por sessao (batch) (#15)" \
  "AnalysisEngine.process_session gera Result (bandas, qualidade, alfa) com engine_version; REST retorna o relatorio."
issue "M4 - Analise e Dashboards" "app: dashboards (graficos) por papel (#16)" \
  "Paciente ve tendencias pessoais; medico ve dashboards por paciente/sessao; graficos a partir de Result; web e mobile."
issue "M4 - Analise e Dashboards" "e2e: integracao real com o dispositivo (#17)" \
  "Jornada unica: capturar do MindWave -> stream -> analise -> dashboard. Demo: 60 s e ver features/relatorio. Sem claim clinica."

# M5
issue "M5 - Polimento de UI" "app: design system + identidade por papel (#18)" \
  "Tema, componentes e tipografia; visual distinto para paciente e medico; acessibilidade basica; responsivo."

echo "Concluido. Verifique em: https://github.com/$REPO/issues"
