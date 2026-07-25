# 33 · Relatório de Fidelidade de Sinal (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.2 |
| Status | **Vivo — recoleta N=1 (2 dias) executada; resultado MISTO (Dia 1 replica, Dia 2 não); H-SIG-01 permanece 🔴→🟡** |
| Data | 2026-07-24 |
| Dispositivo | NeuroSky MindWave Mobile 2 (canal único, FP1, 512 Hz) |
| Documentos relacionados | [30](30_EEG_Signal_Processing_Strategy.md), [31](31_Signal_Fidelity_Study_Protocol.md) (§8.1 piloto, §12 pré-registro), [03_Assumptions](../03_Assumptions.md) (H-SIG-01), [05_Decisions](../05_Decisions.md) (ADR-0028/0030/0031) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**. Entregável da **N1** ([Documentation/13](../Documentation/13_Analysis_Phase_Work_Breakdown.md)). Este é o de-risking existencial (H-SIG-01).

---

## 0. Estado honesto deste relatório
**[FATO]** A recoleta foi executada: **N=1 (autocaptação do desenvolvedor, [ADR-0028](../05_Decisions.md)), 2 sessões em dias distintos** (d1/d2), 6 blocos intercalados OF/OA de ~60 s cada, uma colocação por sessão. Processada pelo pipeline **travado** (§12; `wave_eeg.exp_b`), sem qualquer ajuste para "passar".

**[FATO — resultado principal]** O efeito **não replicou** entre os dois dias: **Dia 1 passou de forma forte e limpa; Dia 2 não** (ver §4b). Pelo critério **pré-registrado** (§12: aumento de alfa em OF **detectável e replicável** entre sessões), a recoleta **não atinge** o gate. **H-SIG-01 permanece 🔴→🟡** — nem confirmada nem refutada; **não** é sinal verde.

**[RÍGIDO]** Não se descarta o Dia 2 nem o bloco atípico para "salvar" o resultado — isso seria p-hacking. O pipeline travado fica; o dado é o que é.

---

## 1. Perguntas de pesquisa (RQ) e situação
| RQ | Pergunta | Situação (recoleta N=1, 2 dias) |
|---|---|---|
| RQ1 | Qualidade/ruído, % utilizável, 60 Hz | **Bom contato:** `poor_signal` médio ~0 (d1) e ~1,3 (d2) — quase todas as amostras utilizáveis. **60 Hz alto no raw** (d1 83–89%; d2 32–87% da potência total), mas **gerenciado** pelo notch + alfa relativa (o d1 passou com 88% de 60 Hz). |
| RQ2 | Alfa OF > OA (efeito de Berger) | **Misto.** d1: razão **1,74**, p=2,2e-11, d=1,79 → **detectado**. d2: razão **0,97**, p=0,73 → **ausente**. Ver §4b. |
| RQ3 | Reatividade repouso vs carga | Fora do escopo desta rodada (Exp. C futura). |
| RQ4 | Artefatos (EOG/EMG) | Fora do escopo desta rodada (Exp. D futura). |
| RQ5 | Teste-reteste (replicabilidade) | **NÃO replicou** entre d1 e d2 (§4b). ICC formal exige mais sessões; com 2, o contraste diverge demais para um ICC estável. |
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

## 4b. Resultados da recoleta real (N=1, 2 dias)
**[FATO]** Pipeline travado (§12), descarte de 5 s/bloco, alfa relativa por época de 4 s. Alfa relativa média por bloco:

| | Bloco 1 (OF) | Bloco 2 (OA) | Bloco 3 (OF) | Bloco 4 (OA) | Bloco 5 (OF) | Bloco 6 (OA) |
|---|---|---|---|---|---|---|
| **Dia 1** | 25,9% | 17,5% | 32,4% | 18,1% | 29,5% | 14,8% |
| **Dia 2** | **10,2%** | 17,3% | 23,1% | 23,3% | 30,1% | 25,1% |

**Agregado (OF vs OA, todas as épocas):**

| | alfa_rel(OF) | alfa_rel(OA) | razão | t | p | Cohen's d | veredito |
|---|---|---|---|---|---|---|---|
| **Dia 1** | 29,3% | 16,9% | **1,74** | 7,89 | 2,2e-11 | 1,79 | **PASSOU** |
| **Dia 2** | 21,1% | 21,9% | **0,97** | −0,34 | 0,73 | −0,08 | **NÃO passou** |

**[FATO] Dia 1** é um efeito de Berger **limpo e consistente**: **todos** os 3 blocos OF ficam acima de **todos** os OA, com efeito grande (d=1,79).

**[FATO] Dia 2** não mostra o contraste. Há uma **deriva temporal**: a alfa relativa **sobe ao longo da sessão em ambas as condições** (OF 10,2→23,1→30,1%; OA 17,3→23,3→25,1%), e o **1º bloco OF veio anomalamente baixo** (10,2%). Essa deriva domina e apaga o contraste OF/OA.

**[HIPÓTESE] Causas candidatas do Dia 2** (a investigar, **não** usadas para descartar o dado): decremento de vigilância/sonolência ao longo dos ~6 min (alfa sobe com sonolência independentemente dos olhos); estado inicial diferente (1º OF não relaxado); efeitos de ordem. Melhorias de desenho: blocos mais curtos, **contrabalancear a ordem**, mais sessões, registrar tempo-na-sessão como covariável.

**[OPINIÃO] O que isto significa.** A recoleta fez **exatamente o que o pré-registro existe para fazer**: um único Dia 1 teria "confirmado" o sinal falsamente; exigir replicação (Exp. E) expôs que, **neste setup N=1**, o efeito **ainda não é confiável**. Não é refutação (o Dia 1 é forte e fisiologicamente correto) nem confirmação. É um **"ainda não"** que pede mais sessões e controle da deriva.

## 5. Runbook do operador (recoleta) e critério de decisão
**[FATO]** Raw das sessões vive **local e descartável** (ADR-0028), organizado por experimento em `packages/wave-eeg/captures/exp-b/<sessão>/` (gitignored — nunca commitado). Sequência (uma colocação; **não** ajustar o headset entre blocos; ambiente longe de carregadores para o 60 Hz — Q-SIG-04):

```bash
# 1) Capturar os 6 blocos numa pasta de sessão (grava t, raw, poor_signal, condition)
wave-eeg capture --port COM5 --secs 60 --condition OC --out captures/exp-b/d3/b1_oc.csv
wave-eeg capture --port COM5 --secs 60 --condition OA --out captures/exp-b/d3/b2_oa.csv
# ... b3_oc, b4_oa, b5_oc, b6_oa

# 2) Veredito do Exp. B intercalado — aponte para a pasta da sessão (pipeline TRAVADO, §12)
wave-eeg exp-b captures/exp-b/d3

# 3) (opcional) Ingerir no corpus com proveniência (condição + poor_signal + tétrade)
research ingest --from-capture --input captures/exp-b/d3/b1_oc.csv \
  --device "NeuroSky MindWave Mobile 2" --montage FP1 \
  --engine-version wave_eeg-0.1 --hyperparams '{"lo":1.0,"hi":45.0,"notch":60}'
```

**[RECOMENDAÇÃO]** Para fechar o gate são precisas **mais sessões** que **replicem** o Dia 1, controlando a deriva do Dia 2 (blocos mais curtos, ordem contrabalanceada). Só então RQ5 fecha e H-SIG-01 pode avançar.

**Critério (travado, §12):** aumento de alfa em OF **detectável e replicável** entre sessões, com artefatos gerenciáveis. Só então este relatório fecha **vai/não-vai** e H-SIG-01 é reavaliada.

---

## 6. Impacto em hipóteses e decisão (vai / não-vai)
- **Gate §12 (vai/não-vai): NÃO atingido** nesta rodada — o efeito foi detectável (Dia 1) mas **não replicável** (Dia 2). Não é "não-vai" definitivo (o Dia 1 é forte e correto), é **"ainda não"**.
- **H-SIG-01:** permanece **🔴→🟡**. **Não avança** para 🟢 sem replicação; **não** rebaixa (o Dia 1 é evidência positiva real). Atualização em [03_Assumptions](../03_Assumptions.md).
- **[RECOMENDAÇÃO]** Próxima rodada: ≥2–3 sessões adicionais visando replicar o Dia 1, com controle da deriva temporal (blocos curtos, ordem contrabalanceada, tempo-na-sessão como covariável). Manter o pré-registro travado; qualquer mudança de método vira nova versão datada (§12).
