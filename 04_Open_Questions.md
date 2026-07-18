# 04 · Perguntas em Aberto — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo (fila priorizada) |
| Data | 2026-07-18 |

Registro central de tudo que ainda está **indefinido**. Prioridade: **P0** bloqueia decisões estruturais · **P1** importante · **P2** pode esperar. "Bloqueia" indica o que não avança até a resposta.

---

## Clínico / Científico

| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-CLN-01** | Qual é a **claim clínica exata** (uso pretendido) do produto? Monitoramento? Triagem? Suporte a diagnóstico de qual condição? | P0 | Classe de risco, validação, arquitetura de IA |
| **Q-CLN-02** | Quais desfechos clínicos o produto pretende melhorar e como serão medidos? | P0 | Plano de validação clínica |
| **Q-CLN-03** | Que definição operacional de "pico", "estabilização" e "anomalia" é clinicamente defensável? | P0 | Detectores, features |
| **Q-CLN-04** | Há um neurologista consultor disponível para co-desenhar e validar? | P0 | Todo o eixo clínico |
| **Q-SIG-01** | O sinal de canal único (FP1) tem validade suficiente para a claim escolhida? | P0 | Viabilidade do produto |
| **Q-SIG-02** | Qual EEG de referência usaremos no estudo de fidelidade? | P1 | Protocolo de validação de sinal |

## Regulatório / Legal

| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-REG-01** | Qual a classe de risco final sob RDC 751/2022? | P0 | Escopo de QMS, custo, prazo |
| **Q-REG-02** | Precisaremos de ISO 13485 (QMS) desde já ou fase gerenciada? | P1 | Processo de engenharia |
| **Q-REG-03** | Há caminho de **bem-estar (não-SaMD)** como on-ramp comercial? | P0 | Estratégia de lançamento |
| **Q-REG-04** | Como a responsabilidade clínica é distribuída (médico × plataforma)? | P1 | Termos, seguro, contratos |
| **Q-LGP-01** | Onde os dados residirão e como tratamos consentimento de dado sensível? | P0 | Arquitetura de dados/nuvem |

## Produto / UX

| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-PRD-01** | Qual o público-alvo inicial (condição, perfil, contexto de uso)? | P0 | Personas, requisitos |
| **Q-PRD-02** | Qual o modelo de negócio (B2C, B2B via clínicas, B2B2C)? | P1 | Roadmap comercial |
| **Q-PRD-03** | Qual a frequência/duração esperada de uso do dispositivo? | P1 | Volume de dados, custo de infra |

## Técnico / Arquitetura

| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-TEC-01** | Processamento **edge vs nuvem**: onde ocorre cada etapa? | P0 | Arquitetura, custo, latência |
| **Q-TEC-02** | Análise "em tempo real" — qual a latência aceitável de fato? | P1 | Escolha de streaming |
| **Q-TEC-03** | App nativo, React Native ou Flutter? (integração Bluetooth NeuroSky) | P1 | Stack mobile |
| **Q-TEC-04** | Qual banco de série temporal e política de retenção? | P1 | Modelo de dados, custo |
| **Q-TEC-05** | O SDK do NeuroSky funciona bem em iOS e Android modernos? | P0 | Viabilidade de integração |

## IA / Dados

| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-AI-01** | Como obteremos dados rotulados para treinar/validar detectores? | P0 | Estratégia de dados/IA |
| **Q-AI-02** | Abordagem inicial: regras/heurísticas de DSP ou ML? | P1 | Arquitetura de IA |
| **Q-AI-03** | Que nível de explicabilidade o médico exige para confiar? | P1 | Design de IA e UX clínica |

---

## Perguntas mais urgentes (top 5 desta rodada)
1. **Q-CLN-01** — Qual a claim clínica exata? (destrava quase tudo)
2. **Q-CLN-04** — Temos acesso a um neurologista consultor?
3. **Q-SIG-01 / Q-REG-01** — Viabilidade do sinal e classe de risco.
4. **Q-REG-03** — Existe on-ramp de bem-estar?
5. **Q-TEC-01** — Edge vs nuvem.

---

## Atualizações (2026-07-18)
- **Q-CLN-01 — RESOLVIDA:** claim definida como **monitoramento não-clínico / não-diagnóstico** (bem-estar), com estratégia faseada rumo a SaMD. Ver [Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md) e ADR-0012.
- **Q-CLN-04 — RESPONDIDA:** não há neurologista consultor; a fase atual foi **reenquadrada** para não depender de validação clínica contínua (ADR-0012).

### Novas perguntas
| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-REG-05** | A trilha de bem-estar (não-diagnóstica) fica de fato fora do escopo SaMD sob ANVISA? | P1 | Comunicação pública, lançamento |
| **Q-SIG-03** | Há acesso a um EEG de referência / laboratório para o Nível 2 do estudo de fidelidade? | P1 | Validade concorrente |
| **Q-ETH-01** | É necessária aprovação de CEP / Plataforma Brasil para a coleta de dados? | P1 | Início da coleta experimental |
| **Q-TEC-05** | (reforço) Qual biblioteca/SDK lê o raw 512 Hz do MindWave de forma confiável? | P0 | Todo o estudo de fidelidade |

---

## Atualizações (2026-07-18) — captação de sinal
- **Q-TEC-05 — ENCAMINHADA (P0→P1):** opções mapeadas e recomendação definida (ADR-0013 + [Architecture/21](Architecture/21_NeuroSky_Integration_and_Capture.md)); resta **executar** o spike do parser.
- **[FATO verificado]** MindWave Mobile 2 é **dual-mode**: SPP (PC/Mac/Android) e **BLE/GATT (iOS)**. Remove o risco (antes hipótese) de bloqueio de iOS. Informa **Q-TEC-03 / ADR-0006** (framework mobile terá duas vias de transporte atrás da mesma abstração).

---

## Atualizações (2026-07-18) — serviço de análise (issue #3)

| ID | Pergunta | Prio | Bloqueia |
|---|---|---|---|
| **Q-TEC-06** | Quais **limiares de qualidade de sinal** definem uma janela/sessão aproveitável (ex.: máx. contaminação de 60 Hz, faixa de amplitude, % de amostras com `poor_signal`)? | P1 | Campo `quality` do `AnalysisEngine`, rejeição de janelas, UX de "sinal ruim" |

**Contexto:** o contrato `AnalysisEngine` (`Architecture/22`, §5) prevê um campo `quality` em `process_window`. Como não há definição de limiar defensável, a implementação v0 (`WaveEegEngine`) reporta apenas **métricas objetivas sem veredito** — `signal_std`, `mains_power` e `mains_power_ratio`. Nenhum limiar foi inventado. Quando Q-TEC-06 for respondida, a interpretação entra no engine sem quebrar o contrato.
