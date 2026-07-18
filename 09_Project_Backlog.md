# 09 · Backlog do Projeto — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo |
| Data | 2026-07-18 |

Backlog de **alto nível** (épicos e itens estruturantes), não de sprint. Alimenta-se de [04_Open_Questions](04_Open_Questions.md) e [06_Master_Roadmap](06_Master_Roadmap.md). Priorização MoSCoW por fase.

---

## Épicos por eixo

### E1 · Concepção & Documentação (Fase 0)
- **[Must]** Popular documentos fundacionais 01–09 ✔ (em andamento)
- **[Must]** Plano Diretor e taxonomia documental ✔
- **[Must]** Sementes: Regulatório, Arquitetura, Sinais ✔
- **[Should]** Definir claim clínica preliminar (Q-CLN-01)
- **[Should]** Recrutar/consultar neurologista (Q-CLN-04)

### E2 · De-risking (Fase 1)
- **[Must]** Protocolo e execução do **estudo de fidelidade de sinal**
- **[Must]** Spike de integração NeuroSky (BLE, iOS/Android)
- **[Must]** Análise formal de classificação de risco (ANVISA)
- **[Must]** Parecer LGPD (residência de dados, consentimento)
- **[Should]** PoC de detectores de evento
- **[Could]** Estudo de on-ramp de bem-estar

### E3 · Arquitetura & Design (Fase 2)
- **[Must]** Arquitetura de referência detalhada + ADRs estruturais
- **[Must]** Modelo de dados e contratos de API
- **[Must]** Design de segurança e privacidade (LGPD)
- **[Should]** Design system + fluxos UX (paciente e médico)

### E4 · Plataforma de Sinal & Dados
- **[Must]** Pipeline de ingestão (dispositivo → nuvem)
- **[Must]** Pipeline de processamento de sinal (filtragem, artefatos, features)
- **[Must]** Armazenamento de série temporal + retenção
- **[Should]** Camada de features para IA

### E5 · IA / Apoio à Decisão
- **[Must]** Estratégia de dados e rotulagem
- **[Must]** Detectores baseline (heurística/ML clássico)
- **[Should]** Explicabilidade (XAI) para o médico
- **[Could]** Correlação contexto × sinal

### E6 · Aplicativos (Paciente & Médico)
- **[Must]** App paciente: coleta, status de sinal, anotações contextuais
- **[Must]** Portal médico: gestão de pacientes, dashboards, relatórios, vereditos
- **[Should]** Notificações contextuais inteligentes

### E7 · Segurança, Conformidade & Qualidade
- **[Must]** IAM, cifragem, trilha de auditoria
- **[Must]** Modelagem de ameaças + LGPD (RIPD/DPIA)
- **[Should]** QMS proporcional (ISO 13485), IEC 62304, ISO 14971
- **[Should]** Usabilidade IEC 62366

### E8 · Infra & Operação
- **[Must]** Nuvem (região BR) + IaC
- **[Must]** CI/CD com rastreabilidade
- **[Should]** Observabilidade + auditoria clínica separada
- **[Could]** Otimização de custo

### E9 · Validação Clínica & Regulatório (Fases 4–5)
- **[Must]** Plano e execução de validação clínica
- **[Must]** Dossiê técnico e submissão ANVISA
- **[Should]** Piloto com clínicas parceiras

---

## Primeiros itens acionáveis (próxima rodada)
1. Definir a **claim clínica preliminar** (destrava classe de risco e arquitetura de IA).
2. Escrever o **protocolo do estudo de fidelidade de sinal**.
3. Detalhar a **análise de classificação de risco** ANVISA.
4. Fechar **ADR-0005 (edge vs nuvem)** após spike de latência.

---

## Atualizações (2026-07-18)
- **E2 iniciado:** spike de captação/análise em `experiments/eeg-capture-spike/` — parser ThinkGear, simulador, `DeviceReader`, análise (Exp. B) e CLI, com **10/10 testes verdes** e CI. Ref.: ADR-0013/0014/0015.
- **Próximo:** executar o parser com o dispositivo real (Exp. A/B do doc 31) e evoluir para o Catálogo de Features.

---

## Atualização (2026-07-18) — início do MVP de plataforma (E3/E6)
Arquitetura do MVP definida (app Expo universal web+mobile; análise no servidor; FastAPI+JWT; WS+REST). Trabalho segmentado em marcos **M0–M5** e issues no [Documentation/11](Documentation/11_MVP_Work_Breakdown.md), prontos para o Claude Code (guia em [Documentation/12](Documentation/12_Claude_Code_Guide.md); contexto em [CLAUDE.md](CLAUDE.md)). **Guarda-corpo:** análise plugável, sem claim clínica, sem dado real (paralelo aos experimentos de sinal).
