# Plano Diretor (Master Plan) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho (Fase 0) |
| Data | 2026-07-18 |
| Autor | Cofundador técnico / Arquiteto-chefe (IA) |
| Escopo | Guia mestre de toda a evolução do WaveAI |

> Documento-âncora do projeto. Todas as demais peças documentais descendem dele. Convenção de rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**.

---

## 1. Propósito deste documento
Servir como **referência estratégica única** que conecta visão, restrições, riscos, fases e estrutura documental. Não substitui os documentos de detalhe — orquestra-os.

---

## 2. Avaliação do estado atual (o que existe hoje)
- Existe **apenas a visão** (`00_Project_Vision.md`): uma descrição ampla e crua da ideia.
- Havia uma estrutura de pastas por disciplina (AI, Architecture, Backend, DataScience, Documentation, Frontend, Infrastructure, Medical, Mobile, RFC, Research), **toda vazia**.
- Nesta rodada foram populados os fundamentos (01–09), criada a taxonomia documental e escritas três sementes críticas.

**Parâmetros estratégicos travados nesta Fase 0** (ver [05_Decisions](05_Decisions.md)):
1. **SaMD comercial** (ADR-0001)
2. **Brasil — ANVISA/LGPD** (ADR-0002)
3. **Time pequeno 2–5** (ADR-0003)
4. **Docs-as-code** (ADR-0004)

**[OPINIÃO]** A ideia é coerente e endereça uma dor real (acompanhamento neurológico longitudinal e de baixo custo). Porém, **a ambição clínica e o hardware escolhido estão em tensão** — ver seção 3.

---

## 3. A tensão científica central (o risco que define o projeto)

**[FATO]** O NeuroSky MindWave Mobile 2 é um EEG de **canal único, eletrodo seco, em FP1** (testa), com referência/terra no clipe de orelha, saída bruta 3–100 Hz a 512 Hz, além de potências de banda e das métricas proprietárias eSense (*Attention*/*Meditation*).

**[FATO]** O EEG clínico usa **múltiplos canais** (sistema 10‑20, 19+ eletrodos), frequentemente úmidos, para localizar e caracterizar atividade cerebral. Um único canal em FP1:
- é **fortemente contaminado** por artefatos oculares (EOG) e musculares (EMG) — justamente a pior região para isso;
- **não permite** montagem clínica, localização de fonte, nem detecção confiável da maior parte dos achados neurológicos (ex.: descargas epileptiformes);
- inviabiliza a técnica padrão de remoção de artefatos multicanal (**ICA**), exigindo métodos monocanal de menor garantia.

**[FATO]** As métricas eSense são **caixa-preta e não validadas clinicamente**; não podem fundamentar uma *claim* médica.

**[OPINIÃO / ALERTA DO ARQUITETO]** Este é o **risco existencial** do WaveAI. Construir uma plataforma SaMD inteira sobre um sinal cuja **validade clínica ainda não foi demonstrada** é a maior ameaça ao projeto. A hipótese H-SIG-01 ([03_Assumptions](03_Assumptions.md)) precisa ser testada **antes** de investimento pesado.

**[RECOMENDAÇÃO]** Adotar uma **estratégia de duas velocidades**:
1. **Trilha honesta de valor imediato** — posicionar o produto no que o canal único *comprovadamente* consegue (tendências longitudinais de estados como atenção/relaxamento, engajamento, biofeedback, bem-estar), possivelmente como on-ramp **não-SaMD**.
2. **Trilha clínica baseada em evidência** — só assumir claims clínicas específicas após o estudo de fidelidade (Fase 1) demonstrar o que é defensável; caso contrário, **pivotar** (ex.: recomendar hardware de mais canais para os casos clínicos).

Registrar a decisão sobre o on-ramp em ADR-0010 e a claim clínica em Q-CLN-01.

---

## 4. Consequências do enquadramento estratégico

| Decisão | Consequência prática |
|---|---|
| **SaMD comercial** | Exige, mais cedo ou mais tarde: gestão de risco (ISO 14971), ciclo de vida de software médico (IEC 62304), usabilidade (IEC 62366), QMS proporcional (ISO 13485), rastreabilidade ponta a ponta. Não é opcional. |
| **Brasil (ANVISA/LGPD)** | Enquadramento por RDC 657/2022; classe por RDC 751/2022; dados de saúde = sensíveis (LGPD art. 11) → consentimento, RIPD/DPIA, provável residência de dados no Brasil. |
| **Time pequeno** | Escopo enxuto, serviços gerenciados, sequenciamento de frentes, automação. Evitar complexidade distribuída prematura. |

**[HIPÓTESE]** A classe de risco provável é **II**, mas isso **precisa** de análise formal — a claim escolhida pode elevá-la. Não tratar como fato.

---

## 5. Decomposição do sistema em domínios
1. **Captação & Dispositivo** — integração NeuroSky (BLE/ThinkGear), qualidade de contato.
2. **Processamento de Sinais (DSP)** — filtragem, artefatos, janelamento, features.
3. **IA / Apoio à Decisão** — detecção de eventos, correlações, explicabilidade, human-in-the-loop.
4. **Dados & Armazenamento** — série temporal, modelo clínico, retenção, governança.
5. **Backend & Integração** — APIs, ingestão, streaming, autenticação.
6. **Aplicativos** — app paciente (móvel) e portal do médico (web).
7. **Analytics & Relatórios** — dashboards, insights, geração de relatórios.
8. **Segurança & Privacidade** — LGPD, IAM, cifragem, auditoria, ameaças.
9. **Regulatório & Clínico** — classificação, validação, QMS, farmacovigilância.
10. **Infra & Operação** — nuvem, IaC, CI/CD, observabilidade, custo.
11. **UX/Produto** — personas, jornadas, requisitos, design system.
12. **Governança & Documentação** — ADRs, RFCs, roadmaps por disciplina.

Cada domínio terá documentação e roadmap próprios (ver [Documentation/00_Documentation_Index](Documentation/00_Documentation_Index.md)).

---

## 6. Estrutura documental proposta
A taxonomia completa está no **[Índice de Documentação](Documentation/00_Documentation_Index.md)**, mapeada às pastas existentes: Núcleo (raiz 00–09), `Medical/` (regulatório/clínico), `Architecture/`, `DataScience/` (sinais), `AI/`, `Backend/`, `Mobile/`, `Frontend/`, `Infrastructure/`, `Research/`, `RFC/`, `Documentation/`.

**Convenções:** docs-as-code (Markdown versionado); ADR para decisões; RFC para propostas; IDs estáveis (H-*, Q-*, ADR-*); status por documento; formato de resposta obrigatório (ver [08_AI_Instructions](08_AI_Instructions.md)).

**Lacunas de estrutura sinalizadas:** ausência de áreas dedicadas a **Produto**, **UX** e **Segurança** (hoje diluídas) — decisão de criar pastas próprias fica pendente.

---

## 7. Fases de desenvolvimento (alto nível)
Detalhe em [06_Master_Roadmap](06_Master_Roadmap.md). Síntese com foco nos **gates**:

| Fase | Objetivo | Gate de saída |
|---|---|---|
| **0 · Concepção** *(atual)* | Especificar antes de codar | Fundamentos + Plano Diretor aprovados; P0 endereçadas |
| **1 · De-risking** | Testar riscos existenciais | Fidelidade de sinal comprovada (ou pivô); classe estimada; edge-vs-nuvem decidido |
| **2 · Arquitetura** | Projetar sobre o comprovado | ADRs estruturais; specs suficientes |
| **3 · MVP Plataforma** | Núcleo ponta a ponta | Fluxo estável com usuários de teste |
| **4 · Validação & QMS** | Evidência + qualidade | Evidência sustenta claim; docs de qualidade |
| **5 · Submissão & Piloto** | Regularizar + pilotar | Regularização/caminho claro |
| **6 · Lançamento & Escala** | Comercializar com segurança | Operação + vigilância pós-mercado |

Trilhas contínuas: Segurança · MLOps · Pós-mercado · Documentação.

---

## 8. Arquitetura de referência (esboço)
Detalhe em [Architecture/20_System_Architecture_Overview](Architecture/20_System_Architecture_Overview.md). Em uma frase: **dispositivo → app (captação + pré-processamento leve) → ingestão → processamento de sinal → features → IA (apoio) → armazenamento (série temporal + clínico) → portal do médico + relatórios**, com trilhas de auditoria e segurança transversais. A fronteira **edge vs nuvem** (ADR-0005) é a decisão arquitetural mais impactante e ainda está aberta.

---

## 9. Estratégia regulatória e clínica (síntese)
Detalhe em [Medical/70_Regulatory_Clinical_Strategy](Medical/70_Regulatory_Clinical_Strategy.md). Pontos-chave: enquadramento SaMD (RDC 657/2022), classificação por risco (RDC 751/2022 + IMDRF), LGPD para dados sensíveis, **human-in-the-loop como controle de risco central**, padrões ISO 14971 / IEC 62304 / 62366, e a opção de on-ramp de bem-estar para reduzir time-to-market.

---

## 10. Principais riscos (resumo do registro)
| ID | Risco | Sev. | Mitigação |
|---|---|---|---|
| **R-01** | Sinal de canal único insuficiente para valor clínico | 🔴 Existencial | Estudo de fidelidade na Fase 1 antes de escalar |
| **R-02** | Classe de risco/regulação maior que o previsto | 🟠 Alto | Análise formal cedo; on-ramp de bem-estar |
| **R-03** | Artefatos (EOG/EMG) confundidos com sinal cerebral | 🟠 Alto | Benchmark de métodos monocanal; rejeição rigorosa |
| **R-04** | Falta de neurologista consultor | 🟠 Alto | Recrutar cedo (Q-CLN-04) |
| **R-05** | LGPD: tratamento inadequado de dado sensível | 🟠 Alto | RIPD/DPIA, residência BR, consentimento |
| **R-06** | Escopo excede a capacidade do time pequeno | 🟡 Médio | Faseamento, serviços gerenciados, MVP enxuto |
| **R-07** | Dependência de SDK proprietário do NeuroSky | 🟡 Médio | Spike de integração; abstrair camada de dispositivo |
| **R-08** | Responsabilidade clínica mal definida (médico × plataforma) | 🟡 Médio | Parecer jurídico; termos claros |

---

## 11. Governança e cadência
- Toda decisão relevante → **ADR** em [05_Decisions](05_Decisions.md).
- Mudanças estruturais → **RFC** antes de virar ADR.
- Hipóteses e perguntas mantidas vivas em [03_Assumptions](03_Assumptions.md) e [04_Open_Questions](04_Open_Questions.md).
- Cada resposta do cofundador técnico encerra com o formato obrigatório de 6 seções.

---

## 12. Lacunas críticas a resolver antes de avançar
1. **Claim clínica exata** (Q-CLN-01) — destrava classe de risco e IA.
2. **Neurologista consultor** (Q-CLN-04).
3. **Viabilidade do sinal** (Q-SIG-01) — via estudo de fidelidade.
4. **On-ramp de bem-estar** (Q-REG-03).
5. **Edge vs nuvem** (Q-TEC-01 / ADR-0005).

> **[RECOMENDAÇÃO FINAL]** Não iniciar a Fase 2 (arquitetura detalhada) nem qualquer implementação enquanto o de-risking da Fase 1 — sobretudo o estudo de fidelidade de sinal — não trouxer evidência. É o que melhor protege tempo, dinheiro e credibilidade clínica do projeto.
