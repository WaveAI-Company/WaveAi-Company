# 70 · Estratégia Regulatória e Clínica (Semente v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 (semente) |
| Status | Semente — a expandir na Fase 1 |
| Data | 2026-07-18 |
| Documentos relacionados | [MASTER_PLAN](../MASTER_PLAN.md), [03_Assumptions](../03_Assumptions.md), [04_Open_Questions](../04_Open_Questions.md) |

> **[AVISO]** Este documento é uma **base de trabalho**, não parecer regulatório ou jurídico. Antes de qualquer submissão, é indispensável consultoria regulatória e jurídica especializada. Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**.

---

## 1. Enquadramento como SaMD
**[FATO]** No Brasil, software que é dispositivo médico por si só é regulado pela **ANVISA RDC 657/2022** (vigente desde 01/07/2022) — a primeira norma dedicada a SaMD. A classificação de risco segue a **RDC 751/2022** (vigente desde 01/03/2023), com classes **I a IV** (IV = máximo). Classes **I/II → notificação**; **III/IV → registro**.

**[FATO]** A ANVISA alinha-se ao framework **IMDRF** de categorização de SaMD, que combina duas dimensões: (a) **significância da informação** fornecida à decisão de saúde (informar → orientar → diagnosticar/tratar) e (b) **estado da condição de saúde** (não-grave → grave → crítico).

## 2. Estimativa preliminar de classe *(hipótese, não fato)*
**[HIPÓTESE]** Um sistema que **fornece informação para apoiar** a decisão de um neurologista, sem automatizar diagnóstico, tende a se posicionar em faixa de risco **moderado (provável Classe II)**. Contudo:
- Se a claim envolver **triagem/suporte a diagnóstico de condição grave** (ex.: epilepsia), a classe **sobe**.
- Se for **monitoramento de bem-estar** sem finalidade médica, pode **sair do escopo de SaMD**.

**[RECOMENDAÇÃO]** Executar uma **Análise Formal de Classificação de Risco** (documento próprio) tão logo a claim (Q-CLN-01) esteja definida. A claim é o que determina a classe — não o contrário.

## 3. Estratégia de duas trilhas (redução de risco regulatório)
| Trilha | Descrição | Vantagem | Desvantagem |
|---|---|---|---|
| **Bem-estar (on-ramp)** | Produto de monitoramento/biofeedback **sem claim médica** | Time-to-market rápido; sem submissão inicial | Não pode alegar utilidade clínica; risco de "claim disfarçada" |
| **SaMD clínico** | Claim médica validada, regularizada na ANVISA | Uso clínico legítimo; diferencial | Custo, prazo, evidência e QMS |
**[RECOMENDAÇÃO]** Avaliar lançar primeiro na trilha de bem-estar (gerando dados e adesão) e evoluir para SaMD com evidência — **desde que** a comunicação nunca faça claim clínica não autorizada. Decisão em ADR-0010.

## 4. LGPD — dados de saúde
**[FATO]** Dados de saúde são **dados pessoais sensíveis** (LGPD, art. 11), com bases legais e salvaguardas mais estritas.
**[RECOMENDAÇÃO]** Prever: consentimento específico e destacado; **RIPD/DPIA**; minimização e retenção definida; cifragem; controle de acesso por papel; trilha de auditoria; e **residência de dados no Brasil** (a confirmar juridicamente — Q-LGP-01). Papéis de controlador/operador a definir (paciente, médico, clínica, plataforma).

## 5. Padrões e sistema de qualidade
**[FATO/RECOMENDAÇÃO]** Para SaMD, os padrões de referência incluem:
- **ISO 14971** — gestão de risco (arquivo de risco vivo).
- **IEC 62304** — ciclo de vida do software médico (processos, rastreabilidade).
- **IEC 62366** — engenharia de usabilidade (erro de uso é risco).
- **ISO 13485** — QMS (proporcional ao porte; pode ser faseado).
- **IEC 82304-1** — software de saúde como produto.
**[OPINIÃO]** Para um time pequeno, implantar um QMS **proporcional e incremental** desde a Fase 2 evita retrabalho — mais barato que "regularizar depois".

## 6. Papel clínico e responsabilidade
**[RECOMENDAÇÃO]** Fixar arquitetural e contratualmente o princípio **human-in-the-loop**: a IA **apoia**, o **médico decide**. Isso é, ao mesmo tempo, um controle de risco (ISO 14971) e um argumento regulatório. Definir a distribuição de responsabilidade (médico × plataforma) com apoio jurídico (Q-REG-04). Considerar normas do **CFM** para prontuário/telemedicina e certificação **SBIS/CFM** para o registro clínico eletrônico.

## 7. Evidência clínica
**[RECOMENDAÇÃO]** Planejar um **estudo de validação clínica** proporcional à claim, precedido pelo **estudo de fidelidade de sinal** (Fase 1). Sem demonstrar que o sinal é válido, não há base para claim clínica.

## 8. Perguntas em aberto deste documento
- Q-CLN-01 (claim), Q-REG-01 (classe), Q-REG-03 (on-ramp), Q-REG-04 (responsabilidade), Q-LGP-01 (residência/consentimento).

## 9. Próximas expansões (documentos-filho)
Análise de Classificação de Risco · Plano IEC 62304 · Arquivo de Risco ISO 14971 · Plano de Validação Clínica · RIPD/DPIA · IFU/Rotulagem.
