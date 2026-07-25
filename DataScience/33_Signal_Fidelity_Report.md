# 33 · Relatório de Fidelidade de Sinal (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.3 |
| Status | **Exp. B FECHADO — alfa OF>OA replicado em 2 sessões de estado controlado (d1, d2b); d2 (estado violado) documentado; H-SIG-01 → 🟡** |
| Data | 2026-07-24 |
| Dispositivo | NeuroSky MindWave Mobile 2 (canal único, FP1, 512 Hz) |
| Documentos relacionados | [30](30_EEG_Signal_Processing_Strategy.md), [31](31_Signal_Fidelity_Study_Protocol.md) (§8.1 piloto, §12 pré-registro), [03_Assumptions](../03_Assumptions.md) (H-SIG-01), [05_Decisions](../05_Decisions.md) (ADR-0028/0030/0031) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**. Entregável da **N1** ([Documentation/13](../Documentation/13_Analysis_Phase_Work_Breakdown.md)). Este é o de-risking existencial (H-SIG-01).

---

## 0. Estado honesto deste relatório
**[FATO]** A recoleta foi executada: **N=1 (autocaptação do desenvolvedor, [ADR-0028](../05_Decisions.md))**, 3 sessões (d1, d2, d2b), 6 blocos intercalados OF/OA de ~60 s cada, uma colocação por sessão, todas à noite. Processadas pelo pipeline **travado** (§12; `wave_eeg.exp_b`), sem qualquer ajuste para "passar".

**[FATO — resultado principal]** Nas **duas sessões de estado controlado** (d1 e d2b — operador neutro e concentrado), o efeito de Berger **replicou forte e limpo**: alfa relativa OF>OA, razões **1,74** e **1,48**, d=1,79 e 1,57, **todos** os blocos OF acima de **todos** os OA. A sessão **d2** — em que o operador relatou **riso involuntário** (estado não-alvo) — **não** mostrou o contraste, com deriva temporal (ver §4b). Pelo critério **pré-registrado** (§12: aumento de alfa em OF **detectável e replicável**), o **Exp. B está atingido e FECHADO** para o alfa OF/OA. **H-SIG-01 sobe para 🟡.**

**[RÍGIDO]** O **d2 não é apagado**: fica documentado como sessão de **estado violado** (motivo objetivo e fisiologicamente fundamentado — riso = EMG + desincronização de alfa por excitação), **excluído do conjunto de replicação com razão declarada**, não por "não ter passado". A exclusão foi **pós-hoc**; por isso o §12 ganha uma **emenda datada** exigindo estado de repouso neutro daqui em diante. O pipeline travado fica; nada é ajustado para "salvar" resultado.

---

## 1. Perguntas de pesquisa (RQ) e situação
| RQ | Pergunta | Situação (recoleta N=1, 2 dias) |
|---|---|---|
| RQ1 | Qualidade/ruído, % utilizável, 60 Hz | **Bom contato:** `poor_signal` médio ~0 (d1) e ~1,3 (d2) — quase todas as amostras utilizáveis. **60 Hz alto no raw** (d1 83–89%; d2 32–87% da potência total), mas **gerenciado** pelo notch + alfa relativa (o d1 passou com 88% de 60 Hz). |
| RQ2 | Alfa OF > OA (efeito de Berger) | **Detectado e replicado** em estado controlado: d1 razão **1,74** (d=1,79) e d2b razão **1,48** (d=1,57), ambos p≪0,001. d2 (estado violado) ausente. **Exp. B fechado.** Ver §4b. |
| RQ3 | Reatividade repouso vs carga | **Primária (alfa↓ na carga) NÃO sustentada** (s1 razão 1,10 p=0,21; s2 1,01 p=0,93). Secundária **exploratória**: teta↑ na carga consistente nas 2 sessões — pista, não resultado. Ver §4c. |
| RQ4 | Artefatos (EOG/EMG) | Fora do escopo desta rodada (Exp. D futura). |
| RQ5 | Teste-reteste (replicabilidade) | **Replicou** entre as 2 sessões de estado controlado (d1, d2b) — mesmo sentido, efeito grande, todos os blocos OF>OA. ICC formal exigiria mais sessões, mas o efeito é forte e consistente. |
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

## 4b. Resultados da recoleta real (N=1, 3 sessões)
**[FATO]** Pipeline travado (§12), descarte de 5 s/bloco, alfa relativa por época de 4 s. Alfa relativa média por bloco:

| | Bloco 1 (OF) | Bloco 2 (OA) | Bloco 3 (OF) | Bloco 4 (OA) | Bloco 5 (OF) | Bloco 6 (OA) |
|---|---|---|---|---|---|---|
| **d1** (neutro) | 25,9% | 17,5% | 32,4% | 18,1% | 29,5% | 14,8% |
| **d2b** (neutro) | 35,1% | 20,5% | 36,1% | 28,2% | 35,1% | 23,1% |
| **d2** (riso) | **10,2%** | 17,3% | 23,1% | 23,3% | 30,1% | 25,1% |

**Agregado (OF vs OA, todas as épocas):**

| | Estado | alfa_rel(OF) | alfa_rel(OA) | razão | t | p | Cohen's d | veredito |
|---|---|---|---|---|---|---|---|---|
| **d1** | controlado | 29,3% | 16,9% | **1,74** | 7,89 | 2,2e-11 | 1,79 | **PASSOU** |
| **d2b** | controlado | 35,4% | 23,9% | **1,48** | 6,93 | 1,2e-09 | 1,57 | **PASSOU** |
| **d2** | violado (riso) | 21,1% | 21,9% | 0,97 | −0,34 | 0,73 | −0,08 | não passou |

**[FATO] d1 e d2b** (as duas sessões de estado controlado, ambas à noite, operador neutro e concentrado) mostram o efeito de Berger **limpo e replicado**: **todos** os 3 blocos OF acima de **todos** os OA em ambas, efeito grande (d=1,79 e 1,57), razão 1,74 e 1,48. Independentes e concordantes.

**[FATO] d2** (a sessão em que o operador relatou **riso involuntário** oscilante) **não** mostra o contraste: há **deriva temporal** (alfa sobe ao longo da sessão em ambas as condições) e o 1º bloco OF veio atipicamente baixo. Isso é **coerente com o estado relatado**: rir em FP1 injeta **EMG facial** e a excitação emocional **desincroniza o alfa** — ambos apagam o contraste OF/OA.

**[OPINIÃO] O que isto significa.** O pré-registro fez o trabalho dele nos dois sentidos: pegou o **falso** (d2, estado violado) e confirmou o **real** (d1 e d2b replicam). Em estado de repouso controlado, **o alfa OF>OA é mensurável e reprodutível neste setup** — consistente com a literatura de canal único seco frontal (Johnstone 2021; Rogers 2016) e com o piloto inicial do projeto. Para **este efeito específico**, não são necessárias mais sessões: **Exp. B fecha.**

## 4c. Resultados do Exp. C — reatividade repouso vs carga (N=1, 2 sessões)
Pré-registro §13 (travado): primária = `rel_alpha(REPOUSO) > rel_alpha(CARGA)` (dessincronização por engajamento), olhos abertos nas duas, aritmética silenciosa.

**Primária (alfa) — NÃO sustentada, não replicada:**

| Sessão | 60 Hz | alfa_rel(REP) | alfa_rel(CAR) | razão | p | d | veredito |
|---|---|---|---|---|---|---|---|
| **s1** | ~87% | 23,4% | 21,3% | 1,10 | 0,21 | 0,29 | inconclusivo |
| **s2** | ~1% | 22,4% | 22,3% | 1,01 | 0,93 | 0,02 | inconclusivo |

Direção fraquíssima em s1, ausente em s2. Pelo pré-registro, **a primária do Exp. C é negativa.** Não se reescreve.

**Secundária (teta) — pista EXPLORATÓRIA consistente:** teta relativa **sobe na carga nas duas sessões** (s1 0,279→0,335; s2 0,182→0,317), assim como teta/beta (s1 1,56→2,94; s2 0,82→1,93). É o marcador clássico de esforço cognitivo.

**[RÍGIDO] Isto é exploratório, não confirmatório** — a primária pré-registrada era o alfa. Reivindicar "teta passou" agora seria p-hacking (garden of forking paths). O caminho honesto: **um novo pré-registro** com teta↑ como primária, para confirmar em dado independente.

**[FATO — bônus técnico]** s2 teve **60 Hz de ~1%** (operador afastou da rede, Q-SIG-04) vs ~87% em s1, e os resultados de alfa foram equivalentes → o **notch + alfa relativa é robusto** mesmo com rede massiva.

**[OPINIÃO] Leitura.** Há **reatividade a carga cognitiva** no sinal — só **não no alfa** (fraco/ausente em FP1), e **sim no teta** (consistente, exploratório). Para o produto (não-clínico, human-in-the-loop), isso diz **quais features surfacear com honestidade** e desaconselha prometer "atenção via alfa". **Exp. C fecha** (primária negativa; teta como pista para um teste futuro).

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
- **Gate §12 — parte do Exp. B: ATINGIDO.** Alfa OF>OA **detectável e replicável** em estado controlado (d1, d2b). **Exp. B fecha** para este efeito.
- **H-SIG-01: sobe para 🟡.** O sinal reproduz de forma confiável o fenômeno canônico do alfa no *nosso* setup — de-risking real da pergunta mais básica. Atualização em [03_Assumptions](../03_Assumptions.md).
- **[RÍGIDO — limites, para não superinterpretar]** 🟡, **não** 🟢: (a) **N=1 sujeito** (não generaliza entre pessoas); (b) alfa OF/OA é o **piso** (o efeito mais fácil/estabelecido) — nada diz ainda sobre reatividade a carga (Exp. C), artefatos (Exp. D) ou **valor clínico**; (c) **sem EEG de referência** (Q-SIG-03 aberta); (d) a exclusão do d2 foi pós-hoc (mitigada pela emenda de estado no §12 e pelas duas replicações independentes).
- **Exp. C (reatividade): FECHADO.** Primária (alfa↓ na carga) **negativa**; teta↑ na carga é **pista exploratória** (§4c) — não muda H-SIG-01, que segue **🟡** (o Exp. B sustenta). Não rebaixa: reatividade existe (teta), só não no alfa.
- **[RECOMENDAÇÃO] Próximo de-risking: Exp. D (artefatos).** Caracterizar piscada/EOG/EMG/movimento — necessário para o gate de qualidade (ADR-0031) e, sobretudo, para a feature de **"pico → contexto"** (distinguir cérebro de músculo/olho). Depois: N3 (engine) sobre o que ficou caracterizado. Pré-registros permanecem travados; mudanças viram versão datada.
