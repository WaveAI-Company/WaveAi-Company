# 00 · Índice de Documentação (Taxonomia) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo (mapa mestre da documentação) |
| Data | 2026-07-18 |

Este é o **mapa da estrutura documental ideal** do WaveAI. Define, por área, quais documentos devem existir, seu propósito e status. A estrutura respeita as pastas já criadas no repositório e as formaliza.

**Legenda de status:** `Vazio` (pasta criada, sem doc) · `Semente` (v0.1 escrito) · `Vivo`/`Rascunho` (populado) · `Planejado` (a criar).

---

## Núcleo / Fundamentos — raiz `/`
| Código | Documento | Status |
|---|---|---|
| 00 | Visão do Projeto | Vivo |
| 01 | Objetivos do Projeto | Rascunho |
| 02 | Glossário | Vivo |
| 03 | Hipóteses e Premissas | Vivo |
| 04 | Perguntas em Aberto | Vivo |
| 05 | Registro de Decisões (ADR) | Vivo |
| 06 | Roadmap Mestre | Rascunho |
| 07 | Stack Tecnológico (candidato) | Rascunho |
| 08 | Instruções de Trabalho da IA | Vivo |
| 09 | Backlog do Projeto | Vivo |
| — | **Plano Diretor (MASTER_PLAN)** | Rascunho |

## `Documentation/` — Governança documental
| Documento | Propósito | Status |
|---|---|---|
| 00 Índice de Documentação | Este mapa | Vivo |
| Guia de Contribuição | Como escrever/versionar docs; templates | Planejado |
| Processo de RFC | Como propor mudanças relevantes | Planejado |
| Template de ADR / RFC / Model Card | Padrões reutilizáveis | Planejado |

## `Medical/` — Regulatório, Clínico e Qualidade *(risco alto)*
| Documento | Propósito | Status |
|---|---|---|
| 70 Estratégia Regulatória e Clínica | SaMD, ANVISA, LGPD, padrões | **Semente** |
| Análise de Classificação de Risco | Enquadramento RDC 751/2022 + IMDRF | Planejado |
| Plano IEC 62304 | Ciclo de vida do software médico | Planejado |
| Arquivo de Risco ISO 14971 | Gestão de risco do dispositivo | Planejado |
| Plano de Validação Clínica | Desenho de estudo e desfechos | Planejado |
| IFU / Rotulagem | Instruções de uso e claims | Planejado |
| Privacidade Clínica / RIPD (DPIA) | Impacto LGPD dados sensíveis | Planejado |

## `Architecture/` — Arquitetura do Sistema
| Documento | Propósito | Status |
|---|---|---|
| 20 Visão de Arquitetura do Sistema | Componentes, fluxos, atributos | **Semente** |
| Modelo C4 (Contexto→Componentes) | Diagramas em níveis | Planejado |
| Modelo de Dados | Entidades, séries temporais, retenção | Planejado |
| Especificação de APIs / Contratos | Interfaces entre serviços | Planejado |
| Modelo de Eventos / Streaming | Ingestão em tempo quase real | Planejado |
| ADRs detalhados | Decisões arquiteturais estendidas | Planejado |

## `DataScience/` — Processamento de Sinais & Análise *(risco alto)*
| Documento | Propósito | Status |
|---|---|---|
| 30 Estratégia de Processamento de Sinais EEG | Pipeline, artefatos, features | **Semente** |
| Protocolo de Validação de Sinal | Estudo de fidelidade vs referência | Planejado |
| Catálogo de Features | Definição formal de cada atributo | Planejado |
| Definições Operacionais de Evento | "pico", "estabilização", "anomalia" | Planejado |
| Notebooks de Análise Exploratória | EDA sobre dados reais | Planejado |

## `AI/` — Inteligência Artificial / ML
| Documento | Propósito | Status |
|---|---|---|
| Estratégia de IA / Apoio à Decisão | Abordagem, papel da IA, human-in-the-loop | Planejado |
| Estratégia de Dados & Rotulagem | Origem, anotação, qualidade | Planejado |
| Model Cards | Ficha de cada modelo | Planejado |
| Protocolo de Avaliação de Modelos | Métricas, validação, viés | Planejado |
| Explicabilidade (XAI) | Interpretabilidade para o médico | Planejado |
| MLOps | Versionamento, deploy, monitoramento | Planejado |

## `Backend/` — Serviços & APIs
| Documento | Propósito | Status |
|---|---|---|
| Design de Serviços | Decomposição, responsabilidades | Planejado |
| Especificação de API | Endpoints, contratos, versionamento | Planejado |
| Ingestão & Mensageria | Fluxo de dados do dispositivo | Planejado |
| Autenticação & Autorização | OAuth2/OIDC, papéis | Planejado |

## `Mobile/` — App do Paciente
| Documento | Propósito | Status |
|---|---|---|
| Arquitetura do App Paciente | Estrutura, offline, sincronização | Planejado |
| Integração NeuroSky (BLE/ThinkGear) | Conexão com o dispositivo | Planejado |
| UX Mobile | Fluxos de coleta e anotação | Planejado |

## `Frontend/` — Portal do Médico & UX Web
| Documento | Propósito | Status |
|---|---|---|
| Arquitetura do Portal Médico | Estrutura web, dashboards | Planejado |
| Design System | Componentes, acessibilidade | Planejado |
| Fluxos UX (Médico) | Gestão de pacientes, vereditos | Planejado |

## `Infrastructure/` — Infra, DevOps & Segurança
| Documento | Propósito | Status |
|---|---|---|
| Arquitetura de Infraestrutura | Nuvem, região BR (LGPD), IaC | Planejado |
| CI/CD & Rastreabilidade | Pipelines, versionamento | Planejado |
| Observabilidade | Logs, métricas, tracing, auditoria | Planejado |
| Modelagem de Ameaças & Segurança | STRIDE, IAM, cifragem, resposta a incidentes | Planejado |

## `Research/` — Pesquisa & Estudos
| Documento | Propósito | Status |
|---|---|---|
| Revisão de Literatura (EEG canal único) | Estado da arte e limitações | Planejado |
| Benchmark de Métodos de Artefato | Comparativo monocanal | Planejado |
| Relatório do Estudo de Fidelidade | Resultado da Fase 1 | Planejado |

## `RFC/` — Propostas de Mudança
| Documento | Propósito | Status |
|---|---|---|
| RFC-0001+ | Propostas técnicas antes de virarem ADR | Planejado |

---

## Lacunas de estrutura identificadas *(recomendações)*
> **[RECOMENDAÇÃO]** A taxonomia atual é orientada a disciplinas técnicas. Faltam áreas explícitas para:
> - **Produto** (PRD, personas, jornadas, requisitos funcionais/não-funcionais) — hoje espalhado; recomendo pasta `Product/` ou seção em `Documentation/`.
> - **UX** dedicada — atualmente sob Frontend/Mobile; aceitável para time pequeno.
> - **Segurança** dedicada — atualmente sob Infrastructure/; aceitável, mas dada a sensibilidade dos dados pode virar pasta própria.
>
> Decisão sobre criar essas pastas fica registrada como pendência (ver [04_Open_Questions](../04_Open_Questions.md)). Não foram criadas agora para não inflar a estrutura antes do aceite.

---

## Atualizações (2026-07-18)
- Criado **`Medical/71 · Uso Pretendido e Posicionamento Regulatório`** (Rascunho) — resolve Q-CLN-01/04.
- Criado **`DataScience/31 · Protocolo do Estudo de Fidelidade de Sinal`** (Rascunho) — de-risking H-SIG-01/02.
- Criado **`Architecture/21 · Integração NeuroSky e Estratégia de Captação`** (Rascunho, 2026-07-18) — resolve o spike Q-TEC-05; ADR-0013.
- Criado **`Documentation/10 · Workflow de Git (GitHub Flow)`** (Vivo) e **`Architecture/21`** (integração/captação).
- Criado código: **`experiments/eeg-capture-spike/`** (spike Q-TEC-05) — ADR-0013/0014/0015. Repo agora é **monorepo** (docs + código).
- Criado **`Architecture/22 · Arquitetura da Plataforma (MVP)`**, **`Documentation/11 · Quebra de Trabalho do MVP`**, **`Documentation/12 · Guia do Claude Code`** e **`CLAUDE.md`** (raiz). ADRs 0016–0019.
