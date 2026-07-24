# 33 · Relatório de Fidelidade de Sinal (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | **Vivo — pipeline pronto e validado em sintético; recoleta real PENDENTE** |
| Data | 2026-07-23 |
| Dispositivo | NeuroSky MindWave Mobile 2 (canal único, FP1, 512 Hz) |
| Documentos relacionados | [30](30_EEG_Signal_Processing_Strategy.md), [31](31_Signal_Fidelity_Study_Protocol.md) (§8.1 piloto, §12 pré-registro), [03_Assumptions](../03_Assumptions.md) (H-SIG-01), [05_Decisions](../05_Decisions.md) (ADR-0028/0030/0031) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**. Entregável da **N1** ([Documentation/13](../Documentation/13_Analysis_Phase_Work_Breakdown.md)). Este é o de-risking existencial (H-SIG-01).

---

## 0. Estado honesto deste relatório
**[FATO]** A parte **automatizável** da N1 está pronta: o pipeline do **desenho intercalado** pré-registrado (§12) está implementado (`wave_eeg.exp_b`), **travado** e **validado em dados sintéticos** (ver §4). A **recoleta real** é, por decisão, um **passo manual do operador** — autocaptação do desenvolvedor (titular=operador, [ADR-0028](../05_Decisions.md)); não pode ser executada por automação nem substituída por sintético.

**[RÍGIDO]** Enquanto a recoleta real não for executada e **replicada** (≥2 sessões, Exp. E), este relatório **não** declara vai/não-vai e **não** avança H-SIG-01. Nada aqui é ajustado para "passar" (§12, anti-p-hacking).

---

## 1. Perguntas de pesquisa (RQ) e situação
| RQ | Pergunta | Situação |
|---|---|---|
| RQ1 | Qualidade/ruído, % utilizável, 60 Hz | **Pendente recoleta.** Piloto §8.1 achou 60 Hz massivo → notch obrigatório (já no pipeline). Score de qualidade contínuo = [ADR-0031](../05_Decisions.md). |
| RQ2 | Alfa OF > OA (efeito de Berger) | **Pendente recoleta intercalada.** Piloto §8.1: direção correta, **inconcluso** (p≈0,09) com confundidor de contato. Desenho intercalado elimina o confundidor. |
| RQ3 | Reatividade repouso vs carga | Fora do escopo desta rodada (Exp. C futura). |
| RQ4 | Artefatos (EOG/EMG) | Fora do escopo desta rodada (Exp. D futura). |
| RQ5 | Teste-reteste (ICC) | **Pendente:** exige ≥2 sessões/dias (Exp. E). Critério de replicabilidade. |
| RQ6 | Concordância com referência | **Fechada por ora:** sem EEG de referência (Q-SIG-03); Nível 2 só via dataset público. |

---

## 2. O que foi construído nesta N1 (`wave_eeg.exp_b`)
**[FATO]** Implementação do **desenho intercalado** (§12), atrás do pacote de análise (`wave_eeg`, sob a interface `AnalysisEngine`):
- **`Block(condition, samples, fs)`** — cada bloco carrega o **`fs` daquele bloco**.
- **`fs_from_duration(n, dur)`** — `fs` pelo **tempo real** do bloco; **nunca** juntando timestamps de condições diferentes (o erro que deu 1022 Hz em §8.1).
- **`analyze_interleaved(blocks, discard_s=5, epoch_s=4, notch=60)`** — pipeline **travado**: descarta ~5 s de transição por bloco → detrend → passa-banda 1–45 → **notch 60** → épocas de 4 s → **Welch** → **alfa RELATIVA**; agrega épocas OF vs OA (3 blocos cada), teste `t` (Welch) + **tamanho de efeito (Cohen's d)**; veredito.
- **`synth_interleaved(...)`** — gerador **sintético** (com 60 Hz + drift + ruído) para teste e reprodutibilidade — **não** substitui a coleta real.

---

## 3. Proveniência e armazenamento (ADR-0028/0030)
**[FATO]** Cada sessão da recoleta será gravada no **corpus de pesquisa** (`wave-corpus`, N4): o raw no store content-addressed; a sessão no índice com **`device` + montagem + condição + `poor_signal`**; e o `ResearchResult` com a **tétrade de proveniência** (commit, versão do dataset, `engine_version`, hiperparâmetros). Comando: `research ingest ... --engine-version ... --hyperparams ...`.

---

## 4. Validação do pipeline em sintético *(não é resultado fisiológico)*
**[FATO]** Regressões (100% sintéticas, `packages/wave-eeg/tests/test_exp_b.py`):
- **Sinal com alfa OF>OA** (seed=1), mesmo com 60 Hz forte + drift: `ratio≈1,21`, `p≈1,5e-28`, `d≈6,1`, 39/39 épocas → **PASSOU**. Mostra que o pipeline recupera OF>OA apesar das armadilhas reais.
- **Nulo (OF≈OA, seed=2):** `ratio≈1,00`, `p≈0,82` → **NÃO passou**. Guarda anti-falso-positivo: o veredito não "inventa" efeito.
- **`fs` por bloco:** verificado que juntar condições inflaria `fs` (1024 vs 512) — o erro que **não** cometemos.

**[OPINIÃO]** Os valores de alfa relativa no sintético são altos (~0,8–0,97) porque o sinal sintético é dominado pela senoide de 10 Hz após a passa-banda — é validação de **mecânica do pipeline**, não estimativa fisiológica. Só a coleta real dá números fisiológicos.

---

## 5. Próximos passos (do operador) e critério de decisão
**[RECOMENDAÇÃO]** Executar a recoleta conforme §12 (6 blocos OF/OA de 60 s, **uma** colocação, descartar ~5 s/bloco), **atacando o 60 Hz** (Q-SIG-04); ingerir no corpus; rodar `analyze_interleaved`; repetir em **≥2 sessões/dias** (Exp. E, ICC). Preencher as RQ1/RQ2/RQ5 aqui.

**Critério (travado, §12):** aumento de alfa em OF **detectável e replicável** entre sessões, com artefatos gerenciáveis. Só então este relatório fecha **vai/não-vai** e H-SIG-01 é reavaliada.

---

## 6. Impacto em hipóteses
- **H-SIG-01:** permanece **🔴→🟡** (encorajador, inconcluso — §8.1). **Não avança** sem a recoleta real replicada. Atualização registrada em [03_Assumptions](../03_Assumptions.md).
