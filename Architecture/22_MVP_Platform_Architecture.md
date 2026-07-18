# 22 · Arquitetura da Plataforma (MVP) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho — base para especificação do MVP |
| Data | 2026-07-18 |
| Documentos relacionados | [20_System_Architecture_Overview](20_System_Architecture_Overview.md), [21_NeuroSky_Integration_and_Capture](21_NeuroSky_Integration_and_Capture.md), [Documentation/11_MVP_Work_Breakdown](../Documentation/11_MVP_Work_Breakdown.md), [05_Decisions](../05_Decisions.md) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**. Objetivo: um **"esqueleto que anda"** (walking skeleton) ponta a ponta — login, UI por papel, captação, servidor de análise — com dados de teste, **sem claims clínicas**.

---

## 1. Princípio-guia: esqueleto agora, ciência depois — sem acoplar
**[OPINIÃO/RECOMENDAÇÃO]** Construir a plataforma antes de fechar os experimentos é válido **desde que** a análise fique **plugável** atrás de uma interface versionada (como o `DeviceReader` já faz para o dispositivo). Assim, os parâmetros de DSP/limiar evoluem **no servidor** sem tocar no app, e nada de clínico é prometido na UI (só rótulos exploratórios; ver [Medical/71](../Medical/71_Intended_Use_and_Regulatory_Positioning.md)).

**Guarda-corpos do MVP:**
- Análise atrás de `AnalysisEngine` (interface) → hoje = `wave_eeg`; amanhã = versão evoluída, sem mudar contrato.
- **Nenhuma claim clínica** na UI; dados de teste podem ser fictícios (rotulados como tal).
- **LGPD:** nada de dado real de pessoa identificável em ambiente de teste; segredos fora do Git.

---

## 2. Decisões que fundam o MVP (ver ADRs 0016–0019)
| # | Decisão | Status |
|---|---|---|
| ADR-0016 | **Cliente único React universal (Expo)** → iOS, Android e Web, com UI por papel (paciente/médico) | Aceita (confirmada) |
| ADR-0017 | **Análise no servidor**: app envia raw → serviço Python (reusa `wave_eeg`) → devolve resultado | Recomendada (confirmar) |
| ADR-0018 | **Backend FastAPI + JWT** (papéis), PostgreSQL | Recomendada (confirmar) |
| ADR-0019 | **Transporte:** WebSocket (ao vivo) + REST (auth/CRUD/relatórios) | Recomendada (confirmar) |

**Por que análise no servidor [RECOMENDAÇÃO]:** o fluxo raw é minúsculo (~1 KB/s a 512 Hz × 2 bytes), então banda não é problema; centralizar o algoritmo em Python o torna **atualizável sem republicar o app**, **rastreável** (futuro IEC 62304) e **reusa** o código já validado. Edge exigiria reescrever DSP em JS. Trade-off aceito: exige conectividade para a análise ao vivo (histórico funciona offline).

---

## 3. Componentes (lógicos)
```
                         ┌─────────────────────────────────────────────┐
                         │      App WaveAI (Expo: iOS/Android/Web)      │
                         │  UI por papel:  Paciente        Médico       │
                         │  • captação (mobile)   • lista de pacientes  │
                         │  • estado ao vivo      • dashboards/relatórios│
                         └───────┬───────────────────────┬─────────────┘
                    WS (raw+JWT) │                        │ REST (JWT)
                                 ▼                        ▼
                         ┌───────────────┐        ┌──────────────────┐
                         │  API (FastAPI)│◀──────▶│  Auth (JWT/papéis)│
                         │  gateway+REST │        └──────────────────┘
                         └───┬───────┬───┘
              stream raw     │       │ CRUD (pacientes, sessões, resultados)
                             ▼       ▼
                   ┌──────────────┐  ┌───────────────────────────┐
                   │ Analysis svc │  │ PostgreSQL (+ TimescaleDB) │
                   │ (wave_eeg)   │  │ users, patients, sessions, │
                   │ WS + batch   │  │ results                    │
                   └──────────────┘  └───────────────────────────┘
```
- **App (Expo universal):** um código React para web+mobile; renderiza UI conforme papel. Captação de EEG é uma **capability**: presente no mobile (módulo nativo BLE/SPP) e opcionalmente no desktop/Chrome (Web Serial); no web puro, o app funciona para login/visualização, e a captura fica "indisponível neste dispositivo".
- **API (FastAPI):** autenticação (JWT), autorização por papel, CRUD de domínio, e o **gateway WebSocket** que encaminha o raw à análise.
- **Analysis service (Python):** embrulha o pacote `wave_eeg` atrás de `AnalysisEngine`; modo **streaming** (features ao vivo) e **batch** (relatório por sessão).
- **Banco:** PostgreSQL para domínio; TimescaleDB (ou tabela particionada) para séries/feature; blobs de sessão em objeto cifrado.

---

## 4. Fluxo de dados (dois caminhos)
**Ao vivo (streaming):** paciente conecta o MindWave (mobile) → app abre WS autenticado → envia amostras raw em blocos → API encaminha à Analysis → Analysis devolve **features/estado ao vivo** (ex.: alfa relativa, qualidade) → app exibe. Sessão é persistida.

**Histórico/relatório (batch):** ao encerrar a sessão, a Analysis gera um **relatório** (potências de banda, qualidade, gráficos) salvo no banco → médico e paciente veem via REST nos dashboards.

**[HIPÓTESE]** latência-alvo do "ao vivo": ~1–2 s é suficiente (não é aplicação de milissegundos). Confirmar em teste (Q-TEC-02).

---

## 5. Abstração de análise (o contrato que protege o futuro)
```
AnalysisEngine (interface):
  process_window(samples[], fs) -> {quality, band_powers, rel_alpha, flags...}
  process_session(samples[], fs, labels?) -> SessionReport
Implementações: WaveEegEngine (v0, atual)  ->  (futuras versões evoluídas)
```
A UI e a API dependem só do **contrato**, nunca da implementação. Trocar/evoluir a ciência = nova versão do engine, sem tocar app/API. Mitiga o risco de "construir sobre análise não finalizada".

---

## 6. Modelo de dados (núcleo do MVP)
`User(id, email, hash, role)` · `PatientProfile(user_id, ...)` · `DoctorProfile(user_id, ...)` · `CareLink(doctor_id, patient_id, status)` · `Session(id, patient_id, started_at, device, status)` · `Sample`/`SessionBlob` (série/He blob) · `Result(session_id, engine_version, metrics_json, created_at)`.
**[RECOMENDAÇÃO]** separar identidade de dados de sinal; versão do engine sempre gravada no `Result` (rastreabilidade).

---

## 7. Segurança & privacidade (MVP)
JWT curto + refresh; RBAC por papel; TLS; segredos via variáveis de ambiente/secret manager (nunca no Git); médico só acessa pacientes com `CareLink` ativo; trilha de auditoria mínima (quem viu o quê). Dados de teste fictícios; consentimento e LGPD entram de verdade antes de qualquer pessoa real.

---

## 8. Monorepo alvo (código + docs)
```
WaveAI/
├── CLAUDE.md                 # contexto p/ o Claude Code
├── apps/wave-app/            # Expo universal (iOS/Android/Web), UI por papel
├── services/api/             # FastAPI: auth, domínio, gateway WS
├── services/analysis/        # FastAPI/worker: AnalysisEngine (wave_eeg)
├── packages/wave-eeg/        # lib de análise (migra de experiments/eeg-capture-spike)
├── infra/                    # docker-compose, CI, env de exemplo
├── (docs atuais: 00–09, Architecture/, DataScience/, Medical/, ...)
└── experiments/              # spikes (permanece)
```
Migração de `experiments/eeg-capture-spike` → `packages/wave-eeg` é a **primeira issue** (via `git mv`, feita por você/Claude Code na máquina — aqui não movemos para não quebrar nada).

---

## 9. Atributos de qualidade priorizados
Segurança/privacidade > rastreabilidade (versão de engine) > simplicidade (time pequeno) > reuso (um código React; um Python de análise) > experiência (UI bonita por papel).

---

## 10. Perguntas em aberto
Confirmar ADR-0017/0018/0019. Qual módulo nativo de Bluetooth para a captura no mobile (Android SPP vs iOS BLE) — detalhar na issue de captura (ref. [21](21_NeuroSky_Integration_and_Capture.md)). Timescale já no MVP ou Postgres puro primeiro? (recomendo Postgres puro no M0–M3).
