# 00 · Índice de Documentação — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.2 |
| Status | Vivo (mapa da documentação) |
| Data | 2026-10-27 |

Mapa dos documentos que **existem** no repositório. A versão 0.1 (18/07/2026)
tabulava a estrutura *ideal* e relegava a real a um changelog no pé — com o
tempo passou a descrever pastas que nunca foram criadas e a dar "Planejado" a
documentos já escritos. Esta versão inverte: **o corpo do índice é o que existe
e foi conferido**; o que é meta vive na §12, dito com todas as letras.

> **Regra deste documento:** a tabela lista arquivo versionado e conferido na
> data acima (`git ls-files '*.md'` → **43 arquivos**, todos abaixo). Pasta ou
> documento que não existe **não entra em tabela**: entra na §12 como meta.

> **Este índice não tem coluna de status, de propósito.** O status de um
> documento é declarado no cabeçalho dele, e repeti-lo aqui cria duas verdades
> que divergem — foi assim que a v0.1 passou a chamar de "Planejado" documento
> já escrito. O índice responde *onde está* e *para que serve*; *em que estado
> está* se lê no próprio arquivo. A §13 lista, com citação, os cabeçalhos que
> estavam desatualizados na data acima — isso é medição, não uma segunda
> taxonomia.

---

## 1. Núcleo — raiz `/` (13 arquivos)

| Código | Arquivo | Propósito |
|---|---|---|
| 00 | [`00_Project_Vision.md`](../00_Project_Vision.md) | Visão e proposta de valor |
| 01 | [`01_Project_Objectives.md`](../01_Project_Objectives.md) | Objetivos e critérios de sucesso |
| 02 | [`02_Project_Glossary.md`](../02_Project_Glossary.md) | Glossário de termos |
| 03 | [`03_Assumptions.md`](../03_Assumptions.md) | Hipóteses e premissas (IDs `H-*`) |
| 04 | [`04_Open_Questions.md`](../04_Open_Questions.md) | Perguntas em aberto (IDs `Q-*`) — **fonte de verdade** |
| 05 | [`05_Decisions.md`](../05_Decisions.md) | Registro de decisões (ADR-0001…) — **fonte de verdade** |
| 06 | [`06_Master_Roadmap.md`](../06_Master_Roadmap.md) | Roadmap mestre por fases |
| 07 | [`07_Tech_Stack.md`](../07_Tech_Stack.md) | Stack tecnológico |
| 08 | [`08_AI_Instructions.md`](../08_AI_Instructions.md) | Instruções de trabalho da IA |
| 09 | [`09_Project_Backlog.md`](../09_Project_Backlog.md) | Backlog do projeto |
| — | [`CLAUDE.md`](../CLAUDE.md) | Contexto do repositório para o Claude Code |
| — | [`MASTER_PLAN.md`](../MASTER_PLAN.md) | Plano diretor |
| — | [`README.md`](../README.md) | Porta de entrada do repositório |

**`CLAUDE.md` e `README.md` ficam na raiz por restrição:** é de lá que o Claude
Code lê as instruções do projeto ao iniciar. Os outros onze podem ser movidos —
decisão da frente de reorganização, ainda não tomada.

## 2. `Documentation/` — governança e planos de trabalho (10 arquivos)

| Arquivo | Propósito |
|---|---|
| [`00_Documentation_Index.md`](00_Documentation_Index.md) | Este mapa |
| [`10_Git_Workflow.md`](10_Git_Workflow.md) | GitHub Flow, branches, Conventional Commits |
| [`11_MVP_Work_Breakdown.md`](11_MVP_Work_Breakdown.md) | Issues do MVP (M0–M5) |
| [`12_Claude_Code_Guide.md`](12_Claude_Code_Guide.md) | Como operar o Claude Code no projeto |
| [`13_Analysis_Phase_Work_Breakdown.md`](13_Analysis_Phase_Work_Breakdown.md) | Plano da fase Análise & Ciência (N1–N6) |
| [`13_Device_E2E_Runbook.md`](13_Device_E2E_Runbook.md) | Runbook da demonstração com o aparelho real |
| [`14_Product_UX_Phase_Work_Breakdown.md`](14_Product_UX_Phase_Work_Breakdown.md) | Plano da fase Produto & UX |
| [`15_UI_Fine_Comb_Work_Breakdown.md`](15_UI_Fine_Comb_Work_Breakdown.md) | Pente fino de UI/UX (P13) |
| [`17_Infra_Estado_Custos_e_Fila.md`](17_Infra_Estado_Custos_e_Fila.md) | **Documento operacional**: estado medido, custos, desligar/religar, fila |
| [`18_Play_Store_Seguranca_de_Dados.md`](18_Play_Store_Seguranca_de_Dados.md) | Roteiro do formulário *Data safety* do Play Console |

**Duas irregularidades de numeração, registradas de propósito** (corrigi-las
mexe em links e cabe à frente de reorganização, não aqui):

- **Dois documentos numerados 13.** `13_Analysis_Phase_Work_Breakdown.md` é
  citado por 8 arquivos; `13_Device_E2E_Runbook.md`, por 1
  (`11_MVP_Work_Breakdown.md`). Renomear o segundo é o barato.
- **O número 16 não existe aqui.** Está reservado a um arquivo de trabalho do
  fundador, fora do versionamento.

## 3. `Architecture/` — arquitetura do sistema (3 arquivos)

| Arquivo | Propósito |
|---|---|
| [`20_System_Architecture_Overview.md`](../Architecture/20_System_Architecture_Overview.md) | Componentes, fluxos, atributos de qualidade |
| [`21_NeuroSky_Integration_and_Capture.md`](../Architecture/21_NeuroSky_Integration_and_Capture.md) | Integração com o MindWave e estratégia de captação |
| [`22_MVP_Platform_Architecture.md`](../Architecture/22_MVP_Platform_Architecture.md) | Arquitetura da plataforma — **fonte de verdade** |

## 4. `DataScience/` — processamento de sinais e análise (4 arquivos)

| Arquivo | Propósito |
|---|---|
| [`30_EEG_Signal_Processing_Strategy.md`](../DataScience/30_EEG_Signal_Processing_Strategy.md) | Pipeline, artefatos, features (sob o guard de vocabulário da ADR-0032) |
| [`31_Signal_Fidelity_Study_Protocol.md`](../DataScience/31_Signal_Fidelity_Study_Protocol.md) | Protocolo do estudo de fidelidade + bibliografia |
| [`32_Feature_Catalog.md`](../DataScience/32_Feature_Catalog.md) | Definição formal das 13 features (Catálogo N2) |
| [`33_Signal_Fidelity_Report.md`](../DataScience/33_Signal_Fidelity_Report.md) | Resultado do estudo — evidência do protocolo guiado (§4b) |

## 5. `Medical/` — regulatório, clínico e direitos do titular (3 arquivos)

| Arquivo | Propósito |
|---|---|
| [`70_Regulatory_Clinical_Strategy.md`](../Medical/70_Regulatory_Clinical_Strategy.md) | SaMD, ANVISA, LGPD, padrões |
| [`71_Intended_Use_and_Regulatory_Positioning.md`](../Medical/71_Intended_Use_and_Regulatory_Positioning.md) | Uso pretendido e vocabulário permitido — **fonte de verdade** |
| [`72_Consent_and_Data_Subject_Rights.md`](../Medical/72_Consent_and_Data_Subject_Rights.md) | Consentimento e direitos do titular |

## 6. `Design/` — marca e referência visual (2 arquivos `.md`)

| Arquivo | Propósito |
|---|---|
| [`logos_icones/README.md`](../Design/logos_icones/README.md) | Marca: vetor único, geração de ícones/favicon/splash/kit |
| [`round1/README.md`](../Design/round1/README.md) | Mockups de referência da linguagem "Maré" |

`Design/guia-de-estilo.html` é **artefato gerado** (saída de
`apps/wave-app/scripts/gerar-guia-de-estilo.mjs`, versionada e guardada pelo CI):
nunca editar à mão. Não é publicado no domínio do produto.

## 7. `infra/` — operação (2 arquivos)

| Arquivo | Propósito |
|---|---|
| [`README.md`](../infra/README.md) | Stack local (`docker compose`), provisionamento, deploy |
| [`RUNBOOK_PORTABILIDADE.md`](../infra/RUNBOOK_PORTABILIDADE.md) | Subir o WaveAI em outra nuvem quando o crédito expirar |

## 8. READMEs de código (5 arquivos)

| Arquivo | Propósito |
|---|---|
| [`apps/wave-app/README.md`](../apps/wave-app/README.md) | App Expo (iOS/Android/Web) |
| [`services/api/README.md`](../services/api/README.md) | API FastAPI: auth, CRUD, gateway WS, SSE |
| [`services/analysis/README.md`](../services/analysis/README.md) | Serviço que expõe o `AnalysisEngine` por HTTP |
| [`packages/wave-eeg/README.md`](../packages/wave-eeg/README.md) | Motor de análise (DSP + features) |
| [`packages/wave-corpus/README.md`](../packages/wave-corpus/README.md) | Corpus de pesquisa, separado da produção (ADR-0030) |

A coluna acima diz o que cada pacote **é hoje**. Três desses READMEs ainda
descrevem o que eles eram em M0 — ver §13.

## 9. `Faculdade/` — entregas acadêmicas (1 arquivo)

| Arquivo | Propósito |
|---|---|
| [`SDIoT_Atividade_Redes/README.md`](../Faculdade/SDIoT_Atividade_Redes/README.md) | Atividade de Sistemas Distribuídos Aplicado à IoT |

**Não é produto.** Está no `paths-ignore` do deploy. As medições de rede dessa
atividade, porém, produziram achados reais sobre o servidor, e esses valem:
estão na fila do [`17`](17_Infra_Estado_Custos_e_Fila.md).

## 10. Pastas versionadas sem documentação

| Pasta | O que tem |
|---|---|
| `experiments/` | Só um `.gitkeep` de 0 byte. O spike que viveu aqui foi promovido a `packages/wave-eeg`. |
| `data/` | **Zero arquivos versionados** (gitignorada, por peso). Guarda a extração do pente fino, descrita no [`15`](15_UI_Fine_Comb_Work_Breakdown.md). |

## 11. Onde cada coisa é decidida

| Pergunta | Documento |
|---|---|
| Por que foi feito assim? | [`05_Decisions.md`](../05_Decisions.md) (ADRs + emendas) |
| O que ainda não foi decidido? | [`04_Open_Questions.md`](../04_Open_Questions.md) |
| O que podemos afirmar na UI? | [`Medical/71`](../Medical/71_Intended_Use_and_Regulatory_Positioning.md) |
| Como os serviços se encaixam? | [`Architecture/22`](../Architecture/22_MVP_Platform_Architecture.md) |
| O que está no ar, quanto custa, como religar? | [`17`](17_Infra_Estado_Custos_e_Fila.md) |
| Como contribuir (branch, commit, PR)? | [`10_Git_Workflow.md`](10_Git_Workflow.md) |

## 12. Estrutura futura — **nenhuma destas pastas existe**

A versão 0.1 tabulava onze áreas por disciplina. Conferido em 2026-10-27, **sete
nunca foram criadas**: `AI/`, `Backend/`, `Mobile/`, `Frontend/`,
`Infrastructure/`, `Research/`, `RFC/`. Também não existe a `Product/` que a 0.1
recomendava.

Isso não é um atraso a cobrar: o conteúdo foi onde era mais útil. Arquitetura de
backend e contratos de API estão em `Architecture/22` e nos READMEs dos serviços;
infra em `infra/` e no `17`; produto/UX nos planos `14` e `15`; pesquisa em
`DataScience/31` e `33`; e **RFC nunca foi necessário** porque toda decisão vai
direto a ADR no `05_Decisions.md`. Documentos por disciplina nascem quando houver
conteúdo que não caiba onde já está — não antes.

**Correção de rumo:** a 0.1 afirmava que a decisão de criar essas pastas "fica
registrada como pendência (ver `04_Open_Questions`)". **Ela não foi registrada** —
varredura por `taxonomia|pasta|estrutura document|Product/|RFC` no
`04_Open_Questions.md` em 2026-10-27 não acha nada. A afirmação foi removida em
vez de virar uma pendência nova: a estrutura de pastas do repositório é
justamente o objeto da frente de reorganização em curso, e será decidida lá, com
ADR.

Dois documentos que a 0.1 planejava **não devem nascer como planejados**:

- *"Definições Operacionais de Evento"* — superado pela **ADR-0032**, que
  substituiu aquele vocabulário por *contraste de estado* e *desvio de baseline
  pessoal (N σ)*. Um dos três termos que a 0.1 listava está hoje **proibido em
  código, UI e `DataScience/30`**, com guard no CI
  (`infra/scripts/check_forbidden_terms.sh`).
- *"Processo de RFC"* e *"Template de RFC"* — ver acima: ADR direto.

## 13. Cabeçalhos desatualizados — fila medida em 2026-10-27

Medido assim: `| Status` do cabeçalho de cada um dos 43 arquivos. **27 declaram
status, 16 não declaram.** Dos 27, estes contradizem o estado do produto, que
está em produção. As frases abaixo são **citação literal do arquivo**, não
paráfrase. Corrigi-las é o resto desta varredura, em PRs próprias — este índice
só registra.

| Arquivo | O que o cabeçalho diz hoje | Por que está atrás |
|---|---|---|
| [`MASTER_PLAN.md`](../MASTER_PLAN.md) | "fase atual: **Análise & Ciência** (ver Documentation/13)" | Aquela fase fechou em 26/07/2026; vieram Produto & UX, P13, P14, infra, P16, P17 e P18 |
| [`06_Master_Roadmap.md`](../06_Master_Roadmap.md) | "fase atual: **Produto & UX**" | Também encerrada |
| [`14_Product_UX_Phase_Work_Breakdown.md`](14_Product_UX_Phase_Work_Breakdown.md) | "Vivo — fonte das issues da fase de Produto & UX" | A fase fechou; o documento é registro dela |
| [`11_MVP_Work_Breakdown.md`](11_MVP_Work_Breakdown.md) | "Vivo — fonte das issues do GitHub" | As issues do MVP (M0–M5) foram entregues |
| [`Medical/71`](../Medical/71_Intended_Use_and_Regulatory_Positioning.md) | "Rascunho" | É a **fonte de verdade** do que se pode afirmar, citada pelo `CLAUDE.md` e obedecida por toda a UI |
| [`Architecture/22`](../Architecture/22_MVP_Platform_Architecture.md) | "Rascunho — base para especificação do MVP" | É a **fonte de verdade** da arquitetura, e o MVP foi construído e está no ar |
| [`Architecture/21`](../Architecture/21_NeuroSky_Integration_and_Capture.md) | "Rascunho — resolve o spike Q-TEC-05" | A captação funciona com o aparelho real, inclusive em segundo plano |
| [`DataScience/31`](../DataScience/31_Signal_Fidelity_Study_Protocol.md) | "Rascunho — pronto para execução piloto" | O piloto foi executado; o resultado é o [`33`](../DataScience/33_Signal_Fidelity_Report.md) |
| [`01_Project_Objectives.md`](../01_Project_Objectives.md) | "Rascunho (Fase 0)" | Não existe mais Fase 0 |
| [`07_Tech_Stack.md`](../07_Tech_Stack.md) | "Candidato — **nada travado**" | A stack está travada pela prática e por ADR (Expo, FastAPI, Postgres/Neon, Container Apps) |

Mais quatro, sem linha de `| Status`, defasados no corpo:

| Arquivo | O que diz hoje |
|---|---|
| [`README.md`](../README.md) | "**Fase atual: engenharia/concepção (Fase 0)** — a documentação precede o código"; lista as 7 pastas inexistentes como estrutura do repositório; e **o único link de "Começando pelo código" aponta para `experiments/eeg-capture-spike/README.md`, que não existe** — é o único link relativo quebrado do repositório (varredura de todos os `.md` em 2026-10-27). Este arquivo será reescrito na frente de apresentação do produto. |
| [`services/api/README.md`](../services/api/README.md) | "Nesta fase (M0) é um **esqueleto** que expõe apenas o health check. Auth (JWT/papéis), CRUD de domínio e o gateway WebSocket entram nas issues seguintes" — contra 19 migrations e a suíte da API em produção |
| [`apps/wave-app/README.md`](../apps/wave-app/README.md) | "Nesta fase (M0) é o **boot + navegação**: telas placeholder com dados fictícios, sem login real e sem captação" |
| [`packages/wave-eeg/README.md`](../packages/wave-eeg/README.md) | O título é `# eeg-capture-spike` e o texto se descreve como "Spike … **antes** de comprometer o stack do produto". É o motor de análise de produção: o `AnalysisEngine` embrulha este pacote |

---

## Mudanças

**2026-10-27 (v0.2)** — reescrito na varredura de documentação. O índice passa a
listar os 43 `.md` versionados, conferidos um a um, e a separar fato de meta.
Corrigido: 5 documentos que existiam e não eram listados (`13`×2, `14`, `15`,
`17`, `18`); `Architecture/21`–`22`, `DataScience/31`–`33` e `Medical/71`–`72`,
que constavam como "Planejado" estando escritos; as 7 pastas inexistentes, que
saíram das tabelas para a §12; a pendência de taxonomia que o texto afirmava ter
registrado e não tinha; e a linha sobre `experiments/eeg-capture-spike/`, código
que não existe mais sob esse nome. Passaram a constar `Design/`, `infra/`,
`Faculdade/` e os READMEs de código, nunca indexados. **Removida a coluna de
status**, que duplicava o cabeçalho de cada documento e divergia dele; no lugar,
a §13 com a fila medida.

**2026-07-18 (v0.1)** — criado como mapa da estrutura documental ideal, junto dos
documentos fundacionais 01–09 (ADR-0002), de `Medical/71`–`72`,
`DataScience/31`, `Architecture/21`–`22`, `Documentation/10`–`12` e do
`CLAUDE.md`.
