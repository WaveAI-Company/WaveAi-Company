# 13 · Fase 2 — Motor de Análise & Ciência de Dados (Plano de Trabalho) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo — fonte das issues da Fase 2 |
| Data | 2026-07-21 |
| Documentos relacionados | [11_MVP_Work_Breakdown](11_MVP_Work_Breakdown.md), [DataScience/30](../DataScience/30_EEG_Signal_Processing_Strategy.md), [DataScience/31](../DataScience/31_Signal_Fidelity_Study_Protocol.md), [Medical/71](../Medical/71_Intended_Use_and_Regulatory_Positioning.md)/[72](../Medical/72_Consent_and_Data_Subject_Rights.md), [MASTER_PLAN](../MASTER_PLAN.md) |

## Contexto e objetivo
O **MVP (esqueleto) está concluído** (M0–M5): a plataforma capta EEG **real**, processa em streaming, persiste o `Result` cifrado e mostra dashboards. O foco agora muda do **encanamento** para a **ciência**: aprofundar o **servidor de análise** (Python), **validar o que o sinal realmente mede**, produzir features e relatórios cada vez mais sofisticados para stakeholders especializados, e — **só depois** — adaptar a UI do app para exibi-los.

**[OPINIÃO]** Esta fase retoma o **de-risking científico** (H-SIG-01) que foi deliberadamente adiado para construir o esqueleto. Era a ordem certa: agora que a malha ponta a ponta funciona, ela vira o **instrumento** para fazer a ciência com rigor. É a fase mais importante para saber se o produto tem base real.

## Princípios da fase (não violar)
- Toda análise atrás de **`AnalysisEngine`** (versionada; `engine_version` em cada resultado).
- **Honestidade científica:** rótulos [FATO]/[HIPÓTESE]/[OPINIÃO]/[RECOMENDAÇÃO]; **sem p-hacking**; **nenhuma claim clínica** (Medical/71).
- **Dados:** testes/CI **sempre 100% sintéticos**; ciência usa **autocaptação do desenvolvedor** (ADR-0028) + **dataset público** (doc 31); **captar terceiros exige protocolo próprio + base legal** (não permitido sem nova decisão).
- **UI por último:** não se desenha dashboard para dado que ainda não existe. A adaptação do app vem **depois** que o servidor produz as saídas.

## Decisões de kickoff (viram ADRs antes de codar)
> **[STATUS 2026-07-21] D1/D2/D3 DECIDIDOS** e registrados: **D1 → [ADR-0030](../05_Decisions.md)** (corpus de pesquisa Parquet+DVC), **D2 → [ADR-0031](../05_Decisions.md)** (qualidade = score 0..1 + rejeição grosseira), **D3 → [ADR-0032](../05_Decisions.md)** (evento = contraste de estado + baseline pessoal N σ; sem "anomalia"). Forward-proofing multicanal em **[ADR-0033](../05_Decisions.md)**. N=1 autocaptação por ora; sem EEG de referência.
- **D1 — Armazenamento de dados para pesquisa (reabre Q-TEC-04 / ADR-0005 e revisita ADR-0025).** Para reprocessar, comparar engines e treinar, provavelmente precisaremos guardar **mais que o `Result`** (raw e/ou janelas/segmentos + features). **[RECOMENDAÇÃO]** criar um **armazenamento de dados de pesquisa** separado do banco de produção — versionado, cifrado, alimentado **só** por sintético/autocaptação. Aí decidir Timescale × tabela particionada × blob.
- **D2 — Verdito de qualidade de sinal (Q-TEC-06).** Definir operacionalmente o que é sinal "utilizável" (hoje a UI mostra valores sem veredito). Alimenta o gate de qualidade e os experimentos.
- **D3 — Definições operacionais de evento (Q-CLN-03).** "Pico/estabilização/anomalia" reprodutíveis e defensáveis — pré-requisito para qualquer detector.

## Milestones e issues (proposta — criar milestone "Fase 2 · Análise & Ciência" no GitHub)

### N1 — Estudo de fidelidade executado *(o de-risking existencial — retomar [doc 31](../DataScience/31_Signal_Fidelity_Study_Protocol.md))*
- Coleta **intercalada** (Exp. B) com **N > 1** (autocaptação + voluntários **somente** se houver protocolo/base legal); Exp. A (qualidade/ruído), C (reatividade), D (artefatos), E (teste-reteste); F opcional (referência/dataset público).
- Entregável: **Relatório de Fidelidade** e atualização de **H-SIG-01**. Decisão vai/não-vai fundamentada.

### N2 — Catálogo de Features + definições de evento
- Formalizar cada feature (nome, fórmula, faixa, interpretação) e as definições operacionais de evento (D3), no `wave_eeg`, com testes.

### N3 — Evolução do `AnalysisEngine` (v1)
- Engine mais rico (features do catálogo, qualidade, tendências longitudinais) atrás da **mesma interface**; `engine_version` incrementada; retrocompatível com o `Result` atual.

### N4 — Engenharia de dados / pipeline de pesquisa
- Implementar D1 (armazenamento de pesquisa); ingestão/rotulagem; reprodutibilidade (versionar dados + modelos); notebooks de EDA em `Research/`/`DataScience/`.

### N5 — Analytics & Relatórios sofisticados
- Relatórios por sessão **e longitudinais** para stakeholders especializados; métricas agregadas; exportações. Base para dashboards mais aplicados.

### N6 — Adaptação da UI *(só depois de N3–N5)*
- Adaptar o app (dashboards por papel) para exibir as novas saídas, mantendo a **honestidade visual** (ADR-0027, eixos rotulados, sem veredito inventado) e **sem claim clínica**.

## Como levar ao Claude Code
Mesmo fluxo do MVP: **uma issue por PR**, **plano antes de codar**, **testes como contrato** (sintéticos), **ADR para cada decisão** (D1–D3 primeiro). Guia em [12_Claude_Code_Guide](12_Claude_Code_Guide.md).

## Perguntas em aberto desta fase
Q-TEC-04/ADR-0005 (storage), **Q-TEC-06** (qualidade), **Q-CLN-03** (eventos), Q-SIG-03 (EEG de referência/lab), Q-ETH-01 (CEP, se envolver terceiros).

## Portabilidade de hardware (upgrade de dispositivo — ex.: Muse 2)
**[FATO] O que já está desacoplado:** a **conexão/ingestão** (interface `DeviceReader`/`DeviceConnection` — trocar o NeuroSky por outro aparelho = **nova implementação**, não muda o resto) e a **análise** (atrás de `AnalysisEngine`, versionada; features novas são **aditivas** no `Result`). Adicionar features **na mesma forma de dado é plugável**.

**[OPINIÃO — o ponto de acoplamento real]** A abstração cobre *conectar e parsear bytes*, mas **não** remove a suposição de **canal único (FP1)** embutida na ciência/DSP. Subir para um aparelho **multicanal** (o **Muse 2** tem **4 canais** — TP9/AF7/AF8/TP10 — ~256 Hz + PPG/IMU; *confirmar no datasheet ao decidir*) é o que dá ganho real (features espaciais, e **ICA passa a ser possível** — a técnica que o [doc 30](../DataScience/30_EEG_Signal_Processing_Strategy.md) diz indisponível com 1 canal), mas muda a **forma do dado** de `amostras[]` (1D) para `canais × amostras` (2D). É um **refactor contido, não um rewrite** — justamente porque as abstrações existem.

**[RECOMENDAÇÃO — forward-proofing durante N3/N4, enquanto já mexemos no engine]**
1. Generalizar o tipo interno de amostra para **quadro multicanal** (`canais × amostras` + `fs` + `rótulos/montagem` + `device`), com o NeuroSky preenchendo **N=1**. Barato agora, caro de retrofitar depois.
2. Gravar **`device` e `montagem/canais`** no `Result` (junto de `engine_version`) — comparabilidade e rastreabilidade entre aparelhos.
3. `DeviceReader` retorna **quadros**, não escalares; **qualidade** normalizada 0..1 (mapear o indicador nativo de cada aparelho).
4. **Ciência é dependente de montagem:** as posições (FP1 vs TP9/AF7/AF8/TP10) mudam o que é mensurável e a estratégia de artefato — isso **re-deriva-se por aparelho**; nenhuma abstração de código remove. (`fs` já é parâmetro — ok.)

**Candidato a ADR** (quando N3 generalizar o modelo): *"Modelo de sinal multicanal / device-agnóstico"*. Até lá, manter o design **pronto para N canais** sem implementar drivers novos.
