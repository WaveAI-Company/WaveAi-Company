# 07 · Stack Tecnológico (Candidato) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Candidato — **nada travado** |
| Data | 2026-07-18 |

> **[HIPÓTESE/RECOMENDAÇÃO]** Tudo aqui é **proposta**, não decisão. Cada escolha vira ADR em [05_Decisions](05_Decisions.md) somente após a pergunta em aberto correspondente ser resolvida. O objetivo é registrar candidatos com trade-offs, não comprometer prematuramente.

---

## Princípios norteadores
1. **LGPD-first:** dados sensíveis exigem residência, cifragem e auditoria adequadas.
2. **Escopo enxuto para time pequeno:** preferir serviços gerenciados a operar infra própria.
3. **Portabilidade regulatória:** não acoplar a arquitetura a um único país/nuvem.
4. **Rastreabilidade (IEC 62304):** versionar código, dados, modelos e documentos.

---

## Integração com dispositivo (NeuroSky)
- **Candidato:** SDK ThinkGear (Bluetooth) no app móvel.
- **Trade-off:** SDK maduro, porém proprietário e possivelmente desatualizado para OS recentes → **risco a validar na Fase 1 (Q-TEC-05)**.

## Aplicativo Móvel (paciente)
| Opção | Vantagens | Desvantagens |
|---|---|---|
| **React Native** | Ecossistema amplo, reuso com web (React), time único | Ponte Bluetooth/BLE pode exigir módulos nativos |
| **Flutter** | Ótima performance de UI, boa BLE | Dart (outra linguagem), menos reuso com web |
| **Nativo (Kotlin/Swift)** | Máximo controle de Bluetooth e desempenho | Dobra o esforço (2 bases), pesado p/ time pequeno |
**[RECOMENDAÇÃO preliminar]** React Native, **condicionado** a validar a integração Bluetooth com o NeuroSky (spike da Fase 1).

## Web / Portal do Médico
- **Candidato:** React + Next.js (SSR, bom para portais), TypeScript.
- **Alternativa:** Angular (mais opinativo). **[OPINIÃO]** React alinha com RN e mercado.

## Backend / APIs
| Opção | Vantagens | Desvantagens |
|---|---|---|
| **Python (FastAPI)** | Mesma linguagem de DSP/ML, async, rápido de desenvolver | Menos "corporativo" para alguns |
| **Node.js (NestJS)** | Reuso de TS com front, ecossistema | Separa do mundo DSP/ML |
**[RECOMENDAÇÃO preliminar]** Python/FastAPI para serviços de sinal/IA; possível BFF em Node para o front. Confirmar em ADR.

## Ingestão & Streaming
| Opção | Uso | Observação |
|---|---|---|
| **WebSocket** | Fluxo cliente→servidor em tempo quase real | Simples; bom para MVP |
| **MQTT** | Telemetria de dispositivos, leve | Ótimo para IoT/EEG contínuo |
| **Kafka** | Backbone de eventos em escala | **[OPINIÃO]** provável over-engineering no início p/ time pequeno |
**[RECOMENDAÇÃO]** Começar simples (WebSocket/MQTT); adotar Kafka só quando o volume justificar (ADR-0011).

## Processamento de Sinais
- **Candidato:** Python — `numpy`, `scipy`, `mne`, `pywavelets`. Ver [DataScience/30_EEG_Signal_Processing_Strategy](DataScience/30_EEG_Signal_Processing_Strategy.md).

## IA / ML
- **Candidato:** `scikit-learn` para baseline; `PyTorch` se/quando deep learning se justificar.
- **[RECOMENDAÇÃO]** Começar por **heurísticas de DSP + ML clássico** (mais explicável, menos dados) antes de deep learning — coerente com necessidade de explicabilidade clínica.

## Armazenamento
| Tipo | Candidato | Observação |
|---|---|---|
| Série temporal (EEG/features) | **TimescaleDB** ou InfluxDB | Timescale = Postgres + séries temporais |
| Relacional (usuários, clínico) | **PostgreSQL** | Maduro, transacional |
| Objetos (raw, relatórios) | Bucket com cifragem | Retenção conforme LGPD |
**[RECOMENDAÇÃO]** PostgreSQL + TimescaleDB reduz superfície tecnológica (um só motor).

## MLOps & Dados
- **Candidato:** MLflow (experimentos/modelos), DVC ou lakeFS (versionamento de dados), pipelines reprodutíveis.

## Infraestrutura & Nuvem
- **Restrição:** LGPD → preferir **região no Brasil** (ADR-0008 pendente).
- **Candidatos:** AWS (região São Paulo), GCP (São Paulo) ou Azure (Brasil Sul).
- **[RECOMENDAÇÃO]** Serviços gerenciados (bancos, filas, auth) para poupar o time pequeno.

## Segurança & Identidade
- Auth: OAuth2/OIDC (ex.: Keycloak self-host ou provedor gerenciado).
- Cifragem em trânsito (TLS) e em repouso; segregação de dados clínicos; trilha de auditoria imutável.

## Observabilidade
- Logs/metrics/tracing (ex.: OpenTelemetry + stack gerenciada). Auditoria clínica separada da observabilidade técnica.

---

## Resumo dos "não travar ainda"
Edge vs nuvem (ADR-0005), mobile framework (ADR-0006), banco de série temporal (ADR-0007), nuvem/região (ADR-0008), abordagem de IA (ADR-0009), streaming (ADR-0011). Todos dependem do de-risking da Fase 1.
