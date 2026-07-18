# 01 · Objetivos do Projeto — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho (Fase 0) |
| Data | 2026-07-18 |
| Responsável | Arquitetura (cofundador técnico) |
| Documentos relacionados | [00_Project_Vision](00_Project_Vision.md), [MASTER_PLAN](MASTER_PLAN.md), [03_Assumptions](03_Assumptions.md) |

> Convenção de rótulos usada em todo o projeto: **[FATO]** conhecimento consolidado/verificável · **[HIPÓTESE]** suposição a validar · **[OPINIÃO]** juízo técnico · **[RECOMENDAÇÃO]** curso de ação sugerido.

---

## 1. Objetivo Geral

Construir uma plataforma multiplataforma (móvel + web) que capte sinais de EEG de forma contínua a partir de hardware acessível (NeuroSky), aplique processamento de sinais e IA para extrair padrões e eventos, e apresente esses achados em dashboards e relatórios que **apoiem — não substituam — a decisão de um médico** no acompanhamento de pacientes.

O sistema tem dois ambientes: **Paciente** (coleta, contexto, visualização pessoal) e **Médico** (gestão de pacientes, análise, emissão de vereditos e recomendações). A IA atua estritamente como **ferramenta de apoio à decisão clínica** (CDS), com o profissional sempre como autoridade final (*human-in-the-loop*).

> **[RECOMENDAÇÃO]** Como o projeto foi definido como **produto comercial SaMD** (ver [05_Decisions](05_Decisions.md), ADR-0001), o objetivo geral deve ser lido sob a ótica de *dispositivo médico regulado*, não de app de bem-estar. Isso muda o rigor exigido em validação, rastreabilidade e gestão de risco.

---

## 2. Objetivos Específicos

### 2.1 Clínicos
- Oferecer ao neurologista uma visão longitudinal e estruturada do sinal do paciente entre consultas.
- Sinalizar eventos de interesse (picos, estabilização, anomalias) para triagem, **sempre com o profissional validando**.
- Correlacionar contexto autorrelatado (anotações do paciente) com padrões do sinal ao longo do tempo. **[HIPÓTESE]** — o valor clínico dessa correlação com hardware de canal único ainda precisa ser demonstrado.

### 2.2 De Produto
- Experiência de coleta simples e confiável para o paciente (baixo atrito, boa adesão).
- Ambiente do médico com gestão de pacientes, dashboards e geração de relatórios.
- Notificações contextuais no momento certo (ex.: pedir contexto após um evento detectado).

### 2.3 Técnicos
- Pipeline de ingestão e processamento de sinal robusto, com tratamento de ruído e artefatos.
- Arquitetura escalável, segura e auditável, adequada a dados de saúde.
- MLOps: versionamento de modelos, dados e experimentos, com avaliação contínua.

### 2.4 Científicos
- Estabelecer, com honestidade metodológica, **o que o hardware de canal único consegue e não consegue medir** de forma válida.
- Definir protocolos de validação dos detectores de evento contra referência.

### 2.5 De Negócio
- Caminho regulatório viável (ANVISA) e sustentável economicamente.
- Modelo que gere confiança de médicos e conformidade com LGPD.

---

## 3. Não-Objetivos (fora de escopo — declarados explicitamente)

- **Não** substituir o diagnóstico ou a decisão médica por decisão autônoma da IA.
- **Não** prometer diagnóstico de doenças neurológicas específicas (ex.: epilepsia) a partir de EEG de canal único. **[FATO]** o hardware não suporta montagem clínica 10‑20.
- **Não** realizar, nesta fase, integração com outros dispositivos EEG além do NeuroSky (extensível depois).
- **Não** iniciar implementação de código antes de a engenharia da etapa correspondente estar suficientemente especificada.

---

## 4. Critérios de Sucesso (métricas por dimensão)

| Dimensão | Métrica candidata | Observação |
|---|---|---|
| Sinal | SNR utilizável; % de janelas descartadas por artefato; concordância com referência | Definir protocolo em [DataScience/30_EEG_Signal_Processing_Strategy](DataScience/30_EEG_Signal_Processing_Strategy.md) |
| IA | Sensibilidade/especificidade dos detectores; taxa de falso-positivo por hora | **[HIPÓTESE]** metas numéricas dependem do estudo de viabilidade |
| Produto | Adesão (dias de uso/semana); tempo até primeiro insight; NPS do médico | — |
| Clínico | Utilidade percebida pelo neurologista; concordância inter-avaliador | Requer validação com profissionais |
| Regulatório | Enquadramento de classe definido; dossiê técnico completo | Ver [Medical/70_Regulatory_Clinical_Strategy](Medical/70_Regulatory_Clinical_Strategy.md) |
| Negócio | CAC/LTV; custo por paciente monitorado | Fora do foco da Fase 0 |

> **[HIPÓTESE]** Os valores-alvo numéricos ainda **não** podem ser fixados: dependem do estudo de fidelidade de sinal (Fase 1). Fixá-los agora seria tratar hipótese como fato.

---

## 5. Horizonte e Faseamento (alto nível)

Ver o roadmap completo em [06_Master_Roadmap](06_Master_Roadmap.md). Em resumo: Fase 0 (engenharia/documentação) → Fase 1 (de-risking técnico e regulatório) → Fase 2 (arquitetura detalhada) → Fase 3 (MVP de plataforma) → Fase 4 (validação clínica + QMS) → Fase 5 (submissão ANVISA + piloto) → Fase 6 (lançamento e escala).

---

## 6. Perguntas em Aberto vinculadas a este documento
- Qual é a *claim* clínica exata do produto? (define a classe de risco) → ver [04_Open_Questions](04_Open_Questions.md), Q-CLN-01.
- Existe um caminho de bem-estar (não-SaMD) como on-ramp? → Q-REG-03.

---

> **Atualização (2026-07-18):** a *claim* do produto foi refinada e reenquadrada para uma trilha **não-clínica / não-diagnóstica** na fase atual, com **SaMD como destino futuro** (ADR-0012). A Declaração de Uso Pretendido canônica está em [Medical/71_Intended_Use_and_Regulatory_Positioning](Medical/71_Intended_Use_and_Regulatory_Positioning.md).
