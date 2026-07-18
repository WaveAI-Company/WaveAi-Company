# 71 · Uso Pretendido e Posicionamento Regulatório (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho — resolve Q-CLN-01 e Q-CLN-04 |
| Data | 2026-07-18 |
| Documentos relacionados | [MASTER_PLAN](../MASTER_PLAN.md), [70_Regulatory_Clinical_Strategy](70_Regulatory_Clinical_Strategy.md), [05_Decisions](../05_Decisions.md), [01_Project_Objectives](../01_Project_Objectives.md) |

> **[AVISO]** Base de trabalho de engenharia/produto — **não é parecer jurídico ou regulatório**. Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**.

---

## 1. Contexto (decisões do fundador, 2026-07-18)
- **Claim proposta:** *"plataforma inteligente de monitoramento neurofisiológico assistido por IA para apoiar profissionais de saúde no acompanhamento longitudinal de pacientes"* — deliberadamente **genérica**, para evitar assumir responsabilidade diagnóstica; toda interpretação clínica fica com o médico; a IA fornece análises, correlações, tendências e insights.
- **Sem neurologista consultor.** Projeto acadêmico com ambição comercial futura; deseja evoluir tecnicamente **sem depender de validação clínica contínua**.

---

## 2. Análise crítica da estratégia de "claim genérica"
**[FATO]** No enquadramento SaMD (e no direito sanitário em geral), a classificação e as obrigações decorrem do **uso pretendido (intended use)** e das **alegações (claims)** — não da vagueza da descrição. Contam o texto, o marketing, o manual e **a quem o produto se destina**.

**[OPINIÃO / ALERTA]** Ser genérico **não é um escudo**. A frase "apoiar profissionais de saúde no acompanhamento de pacientes" **já é uma finalidade médica** (apoio à decisão clínica). Combinar finalidade médica + descrição vaga produz o **pior dos dois mundos**: mantém a obrigação regulatória e ainda adiciona ambiguidade (que amplia, não reduz, a exposição a responsabilidade).

**[OPINIÃO]** O termo "neurofisiológico" soa clínico e tende a **superestimar** (overclaim) um dispositivo de **canal único em FP1**, que não mede função neurológica em sentido clínico. Melhor descrever pelo que é defensável.

**[RECOMENDAÇÃO]** Trocar **vagueza** por **precisão explicitamente não-diagnóstica**. É a definição clara do que o produto faz — e sobretudo do que **não** faz — que limita responsabilidade.

---

## 3. A contradição a resolver
**[FATO]** Um **SaMD comercial** (ADR-0001) **exige validação clínica** em algum momento — não existe dispositivo médico de apoio à decisão lançado sem evidência. Logo, *"SaMD comercial agora"* e *"sem neurologista / sem validação clínica agora"* são **incompatíveis no mesmo instante**.

**[RECOMENDAÇÃO]** Resolver com **estratégia faseada** (já sinalizada no Plano Diretor). Não se abandona a ambição SaMD — ela vira **destino de longo prazo**, não o **modo de operação atual**.

---

## 4. Estratégia faseada recomendada (duas trilhas)

| Fase | Posicionamento | Permite | Exige |
|---|---|---|---|
| **Atual (acadêmica)** | Protótipo de pesquisa + ferramenta de **bem-estar / monitoramento de EEG de consumo**, **não-clínico e não-diagnóstico** | Evoluir tecnicamente **sem** neurologista nem validação clínica contínua | Honestidade de escopo; disclaimers; sem claim médica |
| **Futura (com investimento)** | **SaMD** regularizado (ANVISA) | Uso clínico legítimo | Neurologista, QMS, ISO 14971/IEC 62304, validação clínica |

**[OPINIÃO]** Esse reenquadramento **fortalece** o projeto: alinha o escopo à sua realidade atual (sem neurologista), reduz o risco regulatório imediato e preserva a ambição. Registrado em **ADR-0012**.

---

## 5. Declaração de Uso Pretendido (v0.1 — não-diagnóstica)
> **O WaveAI é uma plataforma de software para captação, registro e visualização de sinais de EEG de consumo (dispositivo de canal único) e de estados mentais correlatos autorreferidos.** Apresenta tendências, padrões e correlações ao longo do tempo, para fins de **autoconhecimento, bem-estar e organização de informação**, podendo servir de **apoio informacional** a um profissional de saúde que acompanhe voluntariamente o usuário.

**Indicações de uso (na fase atual):** monitoramento pessoal de estados como atenção/relaxamento e engajamento; visualização longitudinal de biomarcadores de EEG de consumo; registro de contexto autorrelatado.

**O produto NÃO (limitações explícitas):**
- **NÃO** realiza diagnóstico nem triagem de qualquer doença ou condição.
- **NÃO** detecta epilepsia, transtornos ou eventos neurológicos.
- **NÃO** substitui avaliação, exame (ex.: EEG clínico) ou julgamento profissional.
- **NÃO** deve orientar decisões clínicas de forma autônoma.

**Responsabilidade:** qualquer interpretação clínica é **exclusiva do profissional de saúde**. A IA é ferramenta de apoio informacional.

**População:** adultos; uso voluntário. **Contraindicações/avisos:** não usar para decisões médicas.

---

## 6. Guarda-corpos de comunicação (marketing/UX)
**[RECOMENDAÇÃO]** Para permanecer na trilha não-clínica:
- **Evitar** termos: *diagnóstico, detectar doença, condição neurológica, tratamento, exame, clínico(a)*.
- **Usar**: *bem-estar, autoconhecimento, tendências, estados mentais, informativo*.
- Exibir **disclaimers proeminentes** no app e nos relatórios.
- Não direcionar material de venda a "diagnóstico" ou a substituir consulta.

---

## 7. Impacto em hipóteses/decisões
- **Q-CLN-01** resolvida (claim precisa, não-diagnóstica, faseada).
- **Q-CLN-04** contornada: a fase atual **não** depende de neurologista.
- Revisar **H-REG-01/H-REG-02** ([03_Assumptions](../03_Assumptions.md)): na trilha de bem-estar, **[HIPÓTESE]** o produto provavelmente fica **fora do escopo SaMD** — a confirmar por parecer regulatório antes de qualquer comunicação pública.

---

## 8. Perguntas em aberto deste documento
- Q-REG-05 (nova): a trilha de bem-estar, como descrita, fica fora do escopo SaMD sob ANVISA? (parecer)
- Q-LGP-01 permanece: mesmo não-clínico, coleta de EEG de pessoas envolve dados pessoais (e possivelmente sensíveis) sob LGPD.
