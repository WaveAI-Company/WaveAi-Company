# 06 · Roadmap Mestre — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho (Fase 0) |
| Data | 2026-07-18 |
| Documentos relacionados | [MASTER_PLAN](MASTER_PLAN.md), [09_Project_Backlog](09_Project_Backlog.md) |

Roadmap de **alto nível** por fases, cada uma com objetivo, entregáveis e **critérios de saída (gates)**. Este é o roadmap "raiz"; roadmaps detalhados por disciplina descendem dele (roadmaps dentro de roadmaps).

> **[HIPÓTESE]** Durações não estão fixadas — dependem de time, disponibilidade de neurologista consultor e resultados do de-risking. Evita-se prometer prazos como fatos.

---

## Visão em uma linha

**Fase 0** Engenharia & Concepção → **Fase 1** De-risking técnico e regulatório → **Fase 2** Arquitetura detalhada → **Fase 3** MVP de plataforma → **Fase 4** Validação clínica & QMS → **Fase 5** Submissão ANVISA & piloto → **Fase 6** Lançamento & escala.
Trilhas contínuas (transversais): Segurança & Privacidade · MLOps · Pós-mercado/Farmacovigilância · Documentação.

---

## Fase 0 — Engenharia & Concepção *(atual)*
**Objetivo:** Especificar o projeto antes de qualquer código.
**Entregáveis:** Documentos fundacionais (01–09), Plano Diretor, taxonomia documental, sementes críticas (regulatório, arquitetura, sinais).
**Gate de saída:** Perguntas P0 endereçadas ou com plano de resolução; claim clínica preliminar definida; estrutura documental aprovada.

## Fase 1 — De-risking técnico e regulatório
**Objetivo:** Atacar os riscos existenciais **antes** de construir a plataforma.
**Entregáveis:**
- **Estudo de fidelidade de sinal** (NeuroSky FP1 vs referência) — valida H-SIG-01/02.
- **Spike de integração** NeuroSky (Bluetooth/ThinkGear) em iOS/Android.
- **Análise formal de classificação de risco** (RDC 751/2022 + IMDRF).
- Parecer sobre **on-ramp de bem-estar** e LGPD (residência de dados).
- Prova de conceito de detectores de evento com dados reais.
**Gate de saída:** Evidência de que o sinal sustenta a claim (ou pivô); classe de risco estimada; decisão edge-vs-nuvem (ADR-0005).
> **[OPINIÃO]** Esta é a fase mais importante. Um resultado negativo aqui é *valioso* — evita construir sobre fundação frágil.

## Fase 2 — Arquitetura detalhada & Design
**Objetivo:** Projetar o sistema com base no que a Fase 1 comprovou.
**Entregáveis:** Arquitetura de referência detalhada, modelo de dados, contratos de API, design de segurança, design system/UX, plano IEC 62304 e arquivo de risco ISO 14971 iniciados.
**Gate de saída:** ADRs estruturais aceitos; especificações suficientes para implementar.

## Fase 3 — MVP de Plataforma
**Objetivo:** Construir o núcleo funcional ponta a ponta (coleta → processamento → dashboard → portal do médico), possivelmente sob a claim de bem-estar.
**Entregáveis:** App paciente, portal médico, pipeline de sinais, ingestão, dashboards, anotações contextuais, autenticação e auditoria.
**Gate de saída:** Fluxo ponta a ponta estável com usuários de teste; telemetria e segurança básicas.

## Fase 4 — Validação Clínica & QMS
**Objetivo:** Gerar evidência clínica e implantar o sistema de qualidade.
**Entregáveis:** Estudo clínico/observacional, QMS (ISO 13485) proporcional, verificação & validação, usabilidade (IEC 62366), model cards.
**Gate de saída:** Evidência que sustenta a claim; documentação de qualidade completa.

## Fase 5 — Submissão Regulatória & Piloto
**Objetivo:** Regularizar junto à ANVISA e pilotar em ambiente clínico real.
**Entregáveis:** Dossiê técnico, submissão (notificação/registro conforme classe), piloto com clínicas/médicos parceiros.
**Gate de saída:** Regularização obtida ou caminho claro; feedback do piloto incorporado.

## Fase 6 — Lançamento & Escala
**Objetivo:** Disponibilizar comercialmente e escalar com segurança.
**Entregáveis:** Go-to-market, suporte, monitoramento pós-mercado, escalabilidade de infra, roadmap de novos dispositivos/mercados.
**Gate de saída:** Operação estável, vigilância pós-mercado ativa.

---

## Trilhas Contínuas (transversais a todas as fases)
- **Segurança & Privacidade:** modelagem de ameaças, LGPD, IAM, auditoria.
- **MLOps:** versionamento, avaliação e monitoramento de modelos.
- **Pós-mercado / Farmacovigilância:** relato de eventos, gestão de mudanças.
- **Documentação & Governança:** ADRs, RFCs, roadmaps por disciplina sempre atualizados.

---

## Roadmaps descendentes (a criar)
Cada disciplina terá seu próprio roadmap, derivado deste: Sinais (DataScience), IA/ML (AI), Backend, Mobile, Frontend, Infra, Segurança, Regulatório/Clínico (Medical), UX. Ver a taxonomia em [Documentation/00_Documentation_Index](Documentation/00_Documentation_Index.md).
