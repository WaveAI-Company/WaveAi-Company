# 03 · Hipóteses e Premissas — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo |
| Data | 2026-07-18 |
| Documentos relacionados | [04_Open_Questions](04_Open_Questions.md), [MASTER_PLAN](MASTER_PLAN.md), [Medical/70_Regulatory_Clinical_Strategy](Medical/70_Regulatory_Clinical_Strategy.md) |

Este documento **explicita** tudo que estamos assumindo. A regra do projeto é nunca tratar hipótese como fato. Cada premissa tem tipo, confiança, o que a valida e o impacto caso seja falsa.

Legenda de confiança: 🔴 baixa · 🟡 média · 🟢 alta.

---

## 1. Hipóteses Científicas / de Sinal (as mais críticas)

| ID | Hipótese | Conf. | Como validar | Impacto se falsa |
|---|---|---|---|---|
| **H-SIG-01** | O EEG de **canal único (FP1)** do NeuroSky fornece sinal com fidelidade suficiente para gerar valor clínico real. | 🔴 | Estudo de fidelidade contra EEG de referência (Fase 1). | **Existencial.** Compromete toda a proposta clínica. Ver risco R-01. |
| **H-SIG-02** | É possível remover/atenuar artefatos (EOG/EMG) de forma confiável em **um único canal**. | 🔴 | Benchmark de métodos monocanal (wavelet, filtragem adaptativa, EMD). | Alto: eventos detectados podem ser artefato, não cérebro. |
| **H-SIG-03** | "Picos", "estabilização" e "anomalias" podem ser definidos operacionalmente de forma robusta e reprodutível. | 🟡 | Definição formal + validação inter-avaliador. | Médio-alto: detectores sem significado clínico. |
| **H-SIG-04** | As métricas eSense não são necessárias como base clínica (usaremos features próprias). | 🟢 | Documentado; não dependemos de caixa-preta. | Baixo. |

## 2. Hipóteses Clínicas

| ID | Hipótese | Conf. | Como validar | Impacto se falsa |
|---|---|---|---|---|
| **H-CLN-01** | Neurologistas consideram útil uma visão longitudinal de EEG de baixo custo entre consultas. | 🟡 | Entrevistas e testes de conceito com médicos. | Alto: falta de *product-market fit* clínico. |
| **H-CLN-02** | O modelo *human-in-the-loop* (médico decide) mitiga risco clínico e regulatório a nível aceitável. | 🟡 | Análise de risco (ISO 14971) + parecer regulatório. | Alto: pode elevar classe de risco/responsabilidade. |
| **H-CLN-03** | Correlacionar anotações de contexto com o sinal gera insights clinicamente válidos. | 🔴 | Estudo observacional. | Médio: recurso perde valor, mas não inviabiliza. |

## 3. Hipóteses Regulatórias

| ID | Hipótese | Conf. | Como validar | Impacto se falsa |
|---|---|---|---|---|
| **H-REG-01** | O WaveAI será enquadrado como SaMD sob RDC 657/2022, provavelmente Classe **II** (a confirmar). | 🟡 | Análise formal de classificação (RDC 751/2022 + IMDRF). | Alto: classe III/IV muda drasticamente custo/prazo. |
| **H-REG-02** | Um on-ramp de **bem-estar** (não-SaMD) é viável para lançar antes da certificação. | 🟡 | Parecer regulatório sobre *claims* de bem-estar. | Médio: sem on-ramp, time-to-market cresce muito. |
| **H-REG-03** | Dados podem/deverão residir em região de nuvem no Brasil por LGPD. | 🟡 | Parecer jurídico LGPD sobre transferência internacional. | Médio: afeta escolha de nuvem/arquitetura. |

## 4. Hipóteses de Produto / Usuário

| ID | Hipótese | Conf. | Como validar | Impacto se falsa |
|---|---|---|---|---|
| **H-PRD-01** | Pacientes usarão o dispositivo com regularidade suficiente para gerar dados úteis. | 🟡 | Piloto de adesão. | Alto: sem dados contínuos, o produto perde sentido. |
| **H-PRD-02** | O par NeuroSky + app oferece experiência confiável para leigos. | 🟡 | Testes de usabilidade. | Médio. |

## 5. Premissas Técnicas / de Engenharia

| ID | Premissa | Conf. | Observação |
|---|---|---|---|
| **H-TEC-01** | O NeuroSky expõe dados via Bluetooth com SDK acessível (ThinkGear). | 🟢 | **[FATO]** confirmado nas specs do fabricante. |
| **H-TEC-02** | Raw EEG a 512 Hz e potências de banda estão disponíveis para uso próprio. | 🟢 | **[FATO]** confirmado (saída 3–100 Hz, 512 Hz). |
| **H-TEC-03** | Processamento pesado pode ocorrer na nuvem; o cliente faz captação e pré-processamento leve. | 🟡 | Decisão edge-vs-nuvem ainda aberta (ver [05_Decisions](05_Decisions.md)). |
| **H-TEC-04** | Um time pequeno (2–5) consegue entregar o MVP de plataforma antes da validação clínica. | 🟡 | Depende de escopo enxuto e reuso. |

## 6. Premissas de Negócio

| ID | Premissa | Conf. | Observação |
|---|---|---|---|
| **H-BIZ-01** | Existe mercado disposto a pagar por monitoramento neurológico de baixo custo assistido por médico. | 🔴 | Não validado. Fora do foco da Fase 0, mas registrado. |

---

> **[OPINIÃO/ALERTA DO ARQUITETO]** As hipóteses **H-SIG-01** e **H-SIG-02** são o ponto de maior fragilidade do projeto. Recomendo fortemente que a Fase 1 comece por um **estudo de fidelidade de sinal** antes de qualquer investimento pesado em app/IA. Construir a plataforma inteira sobre um sinal cuja validade clínica não foi demonstrada é o maior risco do WaveAI.

---

## Atualização (2026-07-18) — H-SIG-01 (1ª evidência)
1ª coleta piloto (n=1) com o MindWave: após pipeline correto (detrend + notch 60 Hz + alfa **relativa**), o efeito canônico **alfa(olhos fechados) > alfa(olhos abertos)** apareceu na **direção certa** (razão ~1,24–1,37), mas **sem significância** (p≈0,09), com confundidor de contato entre sessões. Confiança de **H-SIG-01 revisada de 🔴 para 🔴→🟡** (preliminar). Próximo: coleta **intercalada** (Exp. B) com ≥3 sujeitos. Detalhes em [DataScience/31 §8.1](DataScience/31_Signal_Fidelity_Study_Protocol.md).

## Atualização (2026-07-23) — H-SIG-01 (pipeline intercalado pronto; recoleta pendente)
A parte **automatizável** da N1 está entregue: o pipeline do **desenho intercalado** pré-registrado (§12) foi implementado (`wave_eeg.exp_b`), **travado** e **validado em dados sintéticos** (recupera OF>OA com 60 Hz/drift; guarda anti-falso-positivo no caso nulo; `fs` por bloco). A **recoleta real** é passo **manual do operador** (autocaptação do dev, [ADR-0028](05_Decisions.md)) e **ainda não foi executada**. Por isso **H-SIG-01 permanece 🔴→🟡** — **não avança sem dado real replicado** (≥2 sessões, ICC). Relatório em [DataScience/33](DataScience/33_Signal_Fidelity_Report.md).
