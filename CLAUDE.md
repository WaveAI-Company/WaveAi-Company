# CLAUDE.md — WaveAI

Contexto do repositório para o Claude Code. **Leia antes de codar.** Fonte de verdade das decisões: `05_Decisions.md` (ADRs). Guia mestre: `MASTER_PLAN.md`.

## O que é
Plataforma de captação e análise de EEG de consumo (NeuroSky MindWave Mobile 2, canal único, FP1, 512 Hz) com IA de apoio, dois papéis (paciente e médico). **Fase atual = MVP "esqueleto que anda"** com dados de teste.

## Posicionamento e REGRAS RÍGIDAS (não violar)
- **Não-clínico / não-diagnóstico** nesta fase (ver `Medical/71_Intended_Use_and_Regulatory_Positioning.md`). **Nenhuma claim clínica** na UI, textos ou marketing. Termos ok: bem-estar, tendências, estados mentais, exploratório.
- **Análise plugável:** toda análise fica atrás da interface `AnalysisEngine`; hoje = pacote `wave_eeg`. Não espalhar DSP pela API/UI.
- **Sem dado real de pessoa** em testes/dev (LGPD). Dados fictícios devem ser rotulados como tal. **Fixtures, seeds e testes automatizados são sempre 100% sintéticos — isto não tem exceção.** Única exceção, estreita e condicionada: a **autocaptação do próprio desenvolvedor** em banco local descartável, nos termos da **ADR-0028** (titular = operador; consentimento pelo fluxo real; nada commitado; captar terceiros segue proibido).
- **Segredos** só via variáveis de ambiente; nunca commitar `.env`/chaves (`.gitignore` cobre).
- Gravar sempre a `engine_version` em cada resultado (rastreabilidade).

## Arquitetura (resumo — ver `Architecture/22_MVP_Platform_Architecture.md`)
- **App** `apps/wave-app` — Expo (React Native + Web): iOS/Android/Web, UI por papel. Captura de EEG é capability por plataforma (mobile via módulo nativo BLE/SPP; web sem suporte mostra aviso).
- **API** `services/api` — FastAPI: auth JWT (papéis patient/doctor), CRUD de domínio, gateway WebSocket `/stream`.
- **Analysis** `services/analysis` — FastAPI: `AnalysisEngine` embrulhando `packages/wave-eeg` (streaming + batch).
- **DB** PostgreSQL (Timescale depois). Fluxo: app captura → WS raw → API → Analysis → resultado ao vivo + `Result` persistido → dashboards.

## Monorepo
```
apps/wave-app  services/api  services/analysis  packages/wave-eeg  infra/  + docs (00–09, Architecture/, DataScience/, Medical/, Documentation/)
```

## Como rodar (preencher conforme as issues criam os scripts)
- API: `uvicorn` em `services/api` (ver README do serviço).
- Analysis: idem em `services/analysis`.
- App: `npm run web` / Expo em `apps/wave-app`.
- Tudo junto: `docker compose up` em `infra/`.
- Testes Python: `pytest` em cada serviço/pacote.
- Bootstrap de issues/milestones no GitHub: `bash infra/scripts/bootstrap_github.sh` (ver `Documentation/11_MVP_Work_Breakdown.md`).

## Convenções
- **GitHub Flow** (`Documentation/10_Git_Workflow.md`): `main` protegida, branch por issue, PR + CI verde, Conventional Commits.
- **Uma issue por PR** (issues em `Documentation/11_MVP_Work_Breakdown.md`). Critérios de aceite viram testes.
- Python: type hints, `pytest`. TS/React: componentes tipados, testes quando fizer sentido.
- Idioma do projeto: PT-BR (docs e comentários podem ser PT-BR; código em inglês).

## O que NÃO fazer
- Não decidir claim clínica, parâmetros clínicos ou produto — isso vive nos docs/ADRs; se faltar, pare e registre em `04_Open_Questions.md`.
- Não fazer PRs gigantes; não commitar segredos/dados reais; não acoplar a análise fora do `AnalysisEngine`.
