# 72 · Consentimento & Direitos do Titular (Semente v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 (semente) |
| Status | Semente — requisito da #15 (persistência) |
| Data | 2026-07-18 |
| Documentos relacionados | [ADR-0024](../05_Decisions.md), [ADR-0026](../05_Decisions.md), [70_Regulatory_Clinical_Strategy](70_Regulatory_Clinical_Strategy.md), [71_Intended_Use_and_Regulatory_Positioning](71_Intended_Use_and_Regulatory_Positioning.md) |

> **[AVISO]** Base de trabalho de engenharia/produto — **não é parecer jurídico**. Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**.

Documento que rege como o WaveAI trata **consentimento** e os **direitos do titular** sobre seus dados, a partir do momento em que dados biométricos derivados passam a ser persistidos (#15 / ADR-0026).

---

## 1. O que é coletado e persistido
**[FATO/DECISÃO]** Persistimos o **`Result`** (features derivadas de EEG: potências de banda, `rel_alpha`, qualidade, verdict) + `engine_version` + metadados de sessão, vinculado ao usuário. **Não** persistimos o sinal **raw** (ADR-0025). Dados derivados de EEG são tratados com o **padrão de dado sensível**.

## 2. Consentimento
**[RECOMENDAÇÃO]**
- **Informado, específico e destacado** no cadastro/primeira captura: o que é coletado, para quê, por quanto tempo, e quem pode acessar.
- **Revogável** a qualquer momento (sem penalidade). **Revogar ≠ apagar:** revogar o consentimento **interrompe novas coletas/processamento**; a **exclusão** é um direito **separado e explícito** (não automática na revogação, para não destruir dado por engano). O destino dos dados **já coletados** após a revogação segue a **política de retenção** (§5).
- **Registrado/auditado** (quando, versão do termo) — é o que sustenta a base legal.
- Acesso de **médico** aos dados exige, adicionalmente, CareLink `active` (ADR-0024).

## 3. Direitos do titular (LGPD)
**[RECOMENDAÇÃO]** Suportar desde a #15:
| Direito | Implementação mínima |
|---|---|
| **Acesso** | Endpoint/tela para o titular ver seus `Result` e metadados. |
| **Exportação (portabilidade)** | Exportar os próprios dados em formato aberto (ex.: JSON/CSV). |
| **Exclusão (erasure)** | Apagar/anonimizar **todos** os `Result` do usuário; efeito completo e auditado. |
| **Revogação de consentimento** | Encerra tratamento; combina com exclusão/retenção. |
| **Correção** | Corrigir dados cadastrais (ex.: `display_name`). |

## 4. Salvaguardas técnicas
- **Cifragem em repouso** do armazenamento de `Result`.
- **Controle de acesso** por papel + CareLink; **auditoria** de acesso (quem leu o quê).
- **[RECOMENDAÇÃO]** considerar **pseudonimização**: separar identidade do dado biométrico (Result por id pseudônimo; mapa de identidade à parte).

## 5. Retenção
**[RECOMENDAÇÃO]** Definir política explícita (mínimo: manter até o titular excluir). Registrar prazos e o que acontece na revogação de consentimento.

## 6. Gate de produção *(da ADR-0026)*
**[DECISÃO]** Em produção, **nenhum dado derivado de pessoa real** é persistido até: (a) **consentimento informado** no fluxo e (b) **direitos de acesso/exclusão/exportação** implementados. Em dev/test, **apenas dados sintéticos**.

## 7. Perguntas em aberto
- Escopo do consentimento: acesso total vs. por sessão? Expiração/renovação do consentimento?
- Retenção: prazos concretos por tipo de dado?
- Menores de idade / representantes legais (fora do escopo atual — adultos; registrar se mudar).
- Encarregado (DPO) e canal de exercício de direitos — quando houver operação real.
