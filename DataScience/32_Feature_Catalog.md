# 32 · Catálogo de Features (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo — implementado em `wave_eeg.features` (N2) |
| Data | 2026-07-24 |
| Documentos relacionados | [30](30_EEG_Signal_Processing_Strategy.md) (§E5), [31](31_Signal_Fidelity_Study_Protocol.md), [33](33_Signal_Fidelity_Report.md), [05_Decisions](../05_Decisions.md) (ADR-0031/0032/0033) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**. Concretiza a N2 de [Documentation/13](../Documentation/13_Analysis_Phase_Work_Breakdown.md).

---

## 1. Objetivo e escopo
Formalizar cada **feature** (nome, fórmula, faixa, interpretação, confiabilidade, dependência de montagem) e implementá-la de forma **transparente e interpretável** no pacote de análise (`wave_eeg.features`), com testes sintéticos.

**[RÍGIDO — ADR-0032]** Este catálogo **só define features**. As **definições de evento** (contraste de estado; desvio de baseline pessoal em **N σ**) vêm **depois**, construídas sobre este catálogo — **não** aqui. O termo "anomalia" não é usado ([ADR-0032](../05_Decisions.md)).

**[FATO]** O `FEATURE_CATALOG` contém **só features transparentes** (interpretáveis, do sinal bruto). As métricas **eSense** (Attention/Meditation), por serem caixa-preta, **não** entram nele — mas são **incorporadas à parte** como exploratórias rotuladas ([ADR-0034](../05_Decisions.md), ver §4c).

## 2. Pré-processamento assumido
Todas as features são extraídas do sinal **pré-processado** (detrend → passa-banda 1–45 Hz fase-zero → notch 60 Hz), a mesma cadeia do Exp. B (§12). `compute_features(x, fs)` pré-processa por padrão. Features espectrais são limitadas à banda de análise (≤ 45 Hz), então a rede em 60 Hz não as contamina.

## 3. Confiabilidade (legenda)
Reflete o que o estudo de fidelidade ([33](33_Signal_Fidelity_Report.md)) sustenta:
- **defensável** — invariante a escala/ganho (potências **relativas**, forma do espectro, frequências). Base para comparação e eventos.
- **cautela** — sensível a contato/escala (potências **absolutas**, RMS). Usar como **qualidade/contexto**, não como medida fisiológica direta.

**[FATO — do estudo]** Features de **alfa** são fortemente sensíveis ao **estado** (vigilância/emoção): no Dia 1 (calmo) o contraste olhos-fechados foi forte; no Dia 2 (estado oscilante) sumiu ([33](33_Signal_Fidelity_Report.md) §4b). É sinal real — mas exige controle de estado para comparações limpas.

## 4. Catálogo
Nomes batem com as chaves de `compute_features` (contrato coberto por teste).

| Feature | Unidade | Faixa | Interpretação | Confiabilidade | Nota de montagem (FP1) |
|---|---|---|---|---|---|
| `rel_delta` | fração 0..1 | 0..1 | Proporção de potência em delta (0,5–4 Hz). | defensável | baixas freq. sofrem drift/EOG — cautela. |
| `rel_theta` | fração 0..1 | 0..1 | Proporção em teta (4–8 Hz). | defensável | device-agnóstico. |
| `rel_alpha` | fração 0..1 | 0..1 | Proporção em alfa (8–13 Hz); sobe em repouso/olhos fechados (Berger). | defensável | **sensível ao estado** (ver [33](33_Signal_Fidelity_Report.md)). |
| `rel_beta` | fração 0..1 | 0..1 | Proporção em beta (13–30 Hz); sobe com engajamento/EMG. | defensável | contaminação por EMG frontal. |
| `rel_gamma` | fração 0..1 | 0..1 | Proporção em gama (30–45 Hz); em canal seco, muito EMG. | cautela | dominada por EMG; não fisiológica direta. |
| `ratio_theta_beta` | adimensional | >0 | Teta/Beta; literatura de atenção (exploratória). | defensável | device-agnóstico. |
| `ratio_alpha_beta` | adimensional | >0 | Alfa/Beta; proxy de relaxamento vs engajamento. | defensável | sensível ao estado. |
| `spectral_edge_95` | Hz | 0..45 | Freq. abaixo da qual há 95% da potência. | defensável | invariante a escala. |
| `median_frequency` | Hz | 0..45 | Freq. mediana do espectro (SEF 50%). | defensável | invariante a escala. |
| `spectral_entropy` | adimensional | 0..1 | Achatamento do espectro; 0=tonal, 1=plano/ruidoso. | defensável | invariante a escala. |
| `peak_alpha_frequency` | Hz | 8..13 | Freq. de pico na banda alfa. | defensável | válida só quando há pico alfa real. |
| `rms` | amplitude | ≥0 | Amplitude RMS; proxy de energia/contato. | cautela | sensível a escala/contato. |
| `total_power` | potência | ≥0 | Potência integrada do espectro. | cautela | sensível a escala/contato. |

## 4c. Métricas proprietárias — eSense (exploratórias, rotuladas)
**[ADR-0034]** O NeuroSky expõe **`attention`** e **`meditation`** (eSense, 0–100), já decodificadas pelo parser. São **incorporadas como métricas exploratórias**, **fora** do `FEATURE_CATALOG` transparente.

| Métrica | Faixa | Interpretação (do fabricante) | Confiabilidade |
|---|---|---|---|
| `esense_attention` | 0..100 | "atenção/foco" (algoritmo proprietário) | **proprietária / não-validada** |
| `esense_meditation` | 0..100 | "relaxamento/calma" (algoritmo proprietário) | **proprietária / não-validada** |

**[RÍGIDO — guarda-corpos]** Sempre **rotuladas** como proprietárias/não-validadas; **nunca** base de claim nem apresentadas como diagnóstico; **complementam**, não substituem, a camada transparente (que é a explicável para o médico — XAI). São EEG de consumo, não medida clínica ([Medical/71](../Medical/71_Intended_Use_and_Regulatory_Positioning.md)).

## 5. Multicanal (ADR-0033)
As features são **por canal** e **aditivas**: com N>1 canal (aparelho futuro), aplicam-se por canal sem quebrar o contrato, e features **espaciais** (entre canais) entram como novas entradas — sem alterar as existentes. O NeuroSky preenche N=1 (FP1).

## 6. Testes (contrato)
`packages/wave-eeg/tests/test_features.py`, 100% sintético: seno de 10 Hz → alfa domina, pico ≈ 10 Hz, entropia baixa; ruído branco → entropia alta; relativas somam 1 e são ≥ 0; RMS escala linear; sinal nulo não quebra (guards de divisão por zero); as chaves de `compute_features` == o catálogo.

## 7. Próximo (fora desta issue)
Definições de evento sobre estas features (contraste de estado; baseline pessoal N σ; cold-start populacional→individual) — **ADR-0032**, depois do catálogo. Evolução do `AnalysisEngine` para expor as features (N3).
