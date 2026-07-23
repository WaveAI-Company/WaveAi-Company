# 31 · Protocolo do Estudo de Fidelidade de Sinal (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho — pronto para execução piloto |
| Data | 2026-07-18 |
| Dispositivo | NeuroSky MindWave Mobile 2 (canal único, FP1, 512 Hz) |
| Documentos relacionados | [30_EEG_Signal_Processing_Strategy](30_EEG_Signal_Processing_Strategy.md), [03_Assumptions](../03_Assumptions.md) (H-SIG-01/02), [MASTER_PLAN](../MASTER_PLAN.md) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**. Este é o de-risking mais importante do projeto (valida ou refuta H-SIG-01/02).

---

## 0. Resposta direta à sua pergunta
**Posso estruturar o protocolo agora** a partir das especificações + literatura — é o que este documento faz. **Mas validar de fato a fidelidade exige coleta experimental** com o dispositivo físico: nenhuma leitura de spec prova como o *seu* aparelho, no *seu* uso, se comporta. A boa notícia: a literatura já estabelece bastante (reduz seu trabalho), e o **núcleo do estudo (Nível 1) é executável sozinho, só com o MindWave que você já tem — sem laboratório e sem neurologista**.

---

## 1. Objetivo e perguntas de pesquisa
**Objetivo:** determinar **o que o MindWave Mobile 2 mede de forma confiável e fisiologicamente plausível**, para fundamentar (a) o catálogo de features, (b) a claim de produto e (c) os detectores de evento.

**Perguntas (RQ):**
- **RQ1 — Qualidade:** qual o nível de ruído, % de dados utilizáveis e presença de 60 Hz?
- **RQ2 — Plausibilidade fisiológica:** o sinal reproduz o fenômeno canônico do alfa (maior de olhos fechados)?
- **RQ3 — Reatividade:** o sinal muda de forma consistente entre repouso e carga cognitiva?
- **RQ4 — Artefatos:** qual a assinatura e o impacto de piscadas, EOG, EMG (mandíbula), fala e movimento?
- **RQ5 — Reprodutibilidade:** as medidas são estáveis em teste-reteste (mesma pessoa, sessões/reposicionamentos diferentes)?
- **RQ6 — Concordância (opcional):** quão próximo o sinal fica de um EEG de referência?

---

## 2. O que a literatura já estabelece [FATO — com fontes]
- **Rieiro et al., 2019** — MindWave vs equipamento médico (SOMNOwatch+EEG‑6), gravação **simultânea em FP1**, 21 participantes: sinais **significativamente correlacionados**, com **concordância substancial**, porém o MindWave tem **mais ruído**, formato **bifásico de piscada** e é **menos confiável**; diferenças espectrais em **baixas frequências**. Conclusão: "limitado por ruído, mas com registros estáveis por longos períodos e qualidade adequada", com ressalvas de calibração.
- **Rogers et al., 2016** — single-channel ThinkGear/FP1: potências **relativas** de delta/teta/alfa/beta **comparáveis** a EEG de laboratório; avaliou teste-reteste em olhos-abertos/fechados, oddball auditivo e n-back visual.
- **Johnstone et al., 2021** — dispositivo dry single-channel, **182 crianças**: **alfa frontal reduziu em olhos-abertos vs fechados**. → o **paradigma do alfa funciona mesmo frontalmente** em canal único seco.
- **Dataset público (2026)** com MindWave Mobile 2 (validação de banda alfa) → possível **comparação externa** sem coletar referência própria.

**[OPINIÃO — o que isso implica]** O terreno **mais defensável** são as **potências de banda relativas** e contrastes de estado (olhos fechados/abertos, repouso/carga). As métricas **eSense** e as **baixas frequências** merecem cautela. Você não parte do zero: parte de um ponto onde já se sabe que *dá para medir alfa e contrastes de estado* — seu estudo confirma isso **no seu setup** e mapeia limites.

---

## 3. Desenho em níveis (escolha conforme recursos)

| Nível | O que valida | Precisa de | Quem consegue |
|---|---|---|---|
| **0 · Literatura** | O que já é conhecido | Nada (feito na seção 2) | — |
| **1 · Validade interna / confiabilidade** | Plausibilidade, reatividade, artefatos, reteste | **Só o MindWave** + laptop | **Você, sozinho** |
| **2 · Validade concorrente** | Concordância com padrão-ouro | EEG de referência (lab/OpenBCI) **ou** dataset público | Requer acesso/lab |

**[RECOMENDAÇÃO]** Executar o **Nível 1 já** (destrava a decisão vai/não-vai). Tratar o Nível 2 como **condicional** a acesso a um EEG de referência; na falta dele, usar o **dataset público** como comparação aproximada.

---

## 4. Materiais e preparação
- **MindWave Mobile 2**; laptop/celular; ambiente silencioso, iluminação estável, longe de fontes elétricas.
- **Software de captação do sinal bruto (512 Hz)** — **[HIPÓTESE/risco]** confirmar biblioteca/SDK que exponha *raw* e potências (candidatos: SDK ThinkGear; bibliotecas Python de leitura do MindWave). **Isto é, em si, o spike de integração Q-TEC-05** — se não conseguirmos ler o raw de forma confiável, isso já é um achado.
- Registrar sempre: *poor signal quality*, timestamp, condição experimental, marcações de evento.

---

## 5. Sujeitos e ética
**[RECOMENDAÇÃO]** Piloto com **os próprios integrantes + poucos voluntários** (N pequeno — assumidamente exploratório). Mesmo **não-clínico**:
- Obter **consentimento informado** por escrito (coleta de dado pessoal, possivelmente sensível — LGPD).
- **[ALERTA]** Sendo projeto acadêmico com seres humanos, verifique com seu orientador se há necessidade de submissão a **Comitê de Ética em Pesquisa (CEP / Plataforma Brasil)**. Não presuma dispensa. Registrar como Q-ETH-01.

---

## 6. Protocolos experimentais (passo a passo)
Para cada experimento: **objetivo · hipótese · procedimento · medidas · análise · critério de aceite**. Pré-processamento conforme [doc 30](30_EEG_Signal_Processing_Strategy.md) (filtragem 0,5–45 Hz, notch 60 Hz, janelas 2–4 s, gate de qualidade).

### Exp. A — Qualidade e ruído basal
- **Objetivo:** caracterizar o "chão" de qualidade (RQ1).
- **Procedimento:** 5 min sentado, imóvel, olhos abertos fixando um ponto. Repetir com o headset bem e mal ajustado.
- **Medidas:** distribuição do *poor signal quality*; % de janelas utilizáveis; potência em 60 Hz e harmônicos; deriva de linha de base.
- **Aceite:** obter janela utilizável estável ≥ X% do tempo com bom ajuste (definir X após piloto).

### Exp. B — Plausibilidade fisiológica: alfa olhos-fechados vs abertos *(teste canônico)*
- **Objetivo:** confirmar o fenômeno mais estabelecido do EEG (RQ2).
- **Hipótese:** potência **alfa (8–13 Hz)** maior em **olhos fechados**.
- **Procedimento:** 6 blocos alternados de 60 s (OF/OA/OF/OA/OF/OA), com aviso sonoro nas transições. **Descartar os primeiros ~5 s de cada bloco** (acomodação e artefato de transição).
- **Medidas:** potência alfa média por bloco (Welch PSD), em janelas estáveis.
- **Análise:** teste pareado (OF vs OA) por sujeito; tamanho de efeito.
- **[ALERTA metodológico]** Abrir/fechar os olhos **também gera EOG**; por isso comparar janelas **estáveis** (não as transições) e inspecionar se o efeito não é só artefato.
- **Aceite:** aumento de alfa em OF detectável e **replicável** entre sessões. **Este é o principal teste vai/não-vai.**

### Exp. C — Reatividade a estados: repouso vs carga cognitiva
- **Objetivo:** ver se o sinal responde a demanda mental (RQ3).
- **Hipótese:** carga cognitiva altera teta frontal/beta vs repouso.
- **Procedimento:** blocos de 2–3 min: (1) repouso relaxado; (2) **aritmética mental** contínua (ex.: subtrair 7 a partir de 1000) ou n-back; alternar/repetir.
- **Medidas:** potências de banda (teta, beta) e razões; comparação entre condições.
- **Aceite:** diferença consistente e reprodutível entre repouso e carga.

### Exp. D — Caracterização de artefatos controlados
- **Objetivo:** mapear assinatura e impacto de cada artefato (RQ4) → alimenta a estratégia de rejeição do [doc 30](30_EEG_Signal_Processing_Strategy.md).
- **Procedimento:** blocos rotulados com eventos deliberados: piscadas voluntárias cronometradas; movimentos oculares; **aperto de mandíbula (EMG)**; fala; movimento de cabeça; sobrancelha.
- **Medidas:** forma de onda e espectro de cada artefato; quanto contaminam cada banda; eficácia da detecção de piscada do aparelho.
- **Aceite:** conseguir **detectar/segregar** os principais artefatos com regra reprodutível.

### Exp. E — Teste-reteste / reprodutibilidade
- **Objetivo:** estabilidade das medidas (RQ5).
- **Procedimento:** repetir Exp. B e C em **≥2 sessões em dias diferentes**, e **reposicionando** o headset dentro da mesma sessão.
- **Medidas:** estabilidade de baseline; **ICC** (coeficiente de correlação intraclasse) das features entre sessões.
- **Aceite:** ICC em faixa aceitável (definir alvo; literatura de single-channel serve de referência).

### Exp. F — Concordância com referência *(opcional, Nível 2)*
- **Objetivo:** validade concorrente (RQ6).
- **Procedimento:** gravação **simultânea** MindWave + EEG de referência (lab/OpenBCI) na mesma região; **ou** comparar suas distribuições de features com o **dataset público** de MindWave Mobile 2.
- **Medidas:** correlação de potências de banda; **Bland–Altman** (concordância); defasagem temporal.
- **Aceite:** concordância compatível com a literatura (Rieiro/Rogers).

---

## 7. Análise de dados
Pipeline conforme [doc 30]: PSD por Welch; potências absolutas e **relativas** por banda; razões; testes pareados por sujeito; **ICC** para reteste; tamanhos de efeito. **[RECOMENDAÇÃO]** **pré-registrar** hipóteses e critérios antes de coletar, para evitar viés.

---

## 8. Critério de decisão (vai / não-vai)
- **Segue** se: alfa OF/OA (Exp. B) e reatividade (Exp. C) forem **detectáveis e reprodutíveis** (Exp. E), com artefatos **gerenciáveis** (Exp. D). → o sinal sustenta features de estado; construir sobre isso.
- **Pivô** se: sinal dominado por artefato/ruído irreprodutível. Opções: (i) reduzir a claim a bem-estar leve; (ii) recomendar hardware de mais canais para casos que exijam mais; (iii) reposicionar o produto.

---

## 9. Entregáveis do estudo
1. **Relatório de Fidelidade de Sinal** (resultados por RQ).
2. **Tabela "features confiáveis vs não confiáveis"** → insumo direto do **Catálogo de Features** (doc a criar em `DataScience/`).
3. Recomendação atualizada de **claim** (para [Medical/71](../Medical/71_Intended_Use_and_Regulatory_Positioning.md)) e de **detectores**.

---

## 10. Cronograma piloto sugerido (enxuto)
- **Semana 1:** setup de captação do raw (spike Q-TEC-05) + pré-registro.
- **Semanas 2–3:** Exps A–E (Nível 1).
- **Semana 4:** análise + Relatório de Fidelidade.
- **Nível 2 (F):** quando houver acesso a referência.

---

## 11. Perguntas em aberto deste documento
- **Q-SIG-03 (nova):** há acesso a um EEG de referência / laboratório universitário? (define o Nível 2)
- **Q-TEC-05:** qual biblioteca/SDK expõe o raw a 512 Hz de forma confiável? (é o primeiro passo prático)
- **Q-ETH-01 (nova):** é necessária aprovação de CEP/Plataforma Brasil?

---

## 8.1 Resultado da 1ª coleta piloto (2026-07-18) — n=1, exploratório

**Setup:** MindWave Mobile 2; dois blocos contínuos de ~58 s (OF e OA) gravados em **sessões separadas** via `wave-eeg capture`. fs efetivo confirmado em **512 Hz** (o "492 Hz" inicial foi erro de exibição do CLI — dividia pelos 60 s nominais em vez do tempo real; corrigido).

**Achados [FATO]:**
- **Contaminação de rede 60 Hz massiva** — potência ~26 000 (OF) e ~53 000 (OA), muito maior que qualquer banda de EEG. Notch de 60 Hz é **obrigatório**.
- Com pipeline correto (detrend + passa-banda 1–45 Hz + notch 60 Hz + alfa **relativa**): **alfa(OF) > alfa(OA)** — sinal inteiro OF 17,2% vs OA 12,6% (razão ~1,37); por épocas de 4 s OF 20,4% vs OA 16,4% (razão 1,24; p = 0,089).
- **Direção fisiologicamente correta** (efeito de Berger), consistente com Johnstone 2021 — porém **sem significância estatística** → **INCONCLUSIVO**.

**Diagnóstico do falso-negativo inicial [FATO]:** o primeiro `analyze` deu OF < OA (razão 0,92) por três defeitos, todos corrigidos no código: (a) sem filtragem/notch/detrend (60 Hz e drift dominavam); (b) potência **absoluta** (sensível a amplitude/contato) em vez de **relativa**; (c) fs estimado errado ao **juntar** os timestamps das duas condições (dava 1022 Hz).

**Confundidor identificado [OPINIÃO]:** OF e OA foram gravados **separadamente**, e o 60 Hz de OA é o **dobro** do de OF → contato/impedância **diferentes entre as sessões**. Exatamente o que o desenho **intercalado** (Exp. B, 6 blocos alternados numa única colocação) elimina.

**Conclusão [OPINIÃO/RECOMENDAÇÃO]:** resultado **encorajador, porém inconclusivo**. Próximo passo correto (e **não** é p-hacking): **refazer a coleta no desenho intercalado** — OF/OA/OF/OA/OF/OA de 60 s, **mesma colocação do headset**, descartando ~5 s de transição de cada bloco; idealmente ≥3 sujeitos. **Não** se deve ajustar o estimador para "passar" neste dataset. Buscar também reduzir o 60 Hz (afastar de fontes/carregadores; verificar contato do clipe de orelha).

**Impacto nas hipóteses:** H-SIG-01 sobe de 🔴 para **🔴→🟡** (sinal preliminar plausível, a confirmar). O pipeline de análise do spike agora implementa a estratégia do [doc 30](30_EEG_Signal_Processing_Strategy.md) (filtro + notch + features relativas).


---

## 12. Pré-registro da recoleta — Exp. B (desenho intercalado) — 2026-07-21
**[DECISÃO]** Antes de coletar qualquer novo dado, ficam **travados** os itens abaixo (anti-p-hacking). Nenhum estimador ou critério será ajustado para "passar" no dataset; qualquer mudança de método vira nova versão datada deste pré-registro.

**Parâmetros do estudo (fundador, 2026-07-21):**
- **Sujeitos:** **N=1, autocaptação do desenvolvedor** (titular=operador, ADR-0028). Voluntários (N>1) **fora de escopo por ora** — exigiriam base legal + eventual CEP (Q-ETH-01).
- **EEG de referência:** **não há** acesso a laboratório (Q-SIG-03 fechada por ora). Nível 2 fica **condicional** e, quando executado, usará o **dataset público** de MindWave Mobile 2 como comparação aproximada — **não** como padrão-ouro.
- **60 Hz:** contaminação de rede será **atacada e medida** na recoleta (afastar de fontes/carregadores; verificar contato do clipe de orelha). É uma variável **a testar** (Q-SIG-04), não um pressuposto resolvido.

**Desenho (travado):**
- **6 blocos alternados** OF/OA/OF/OA/OF/OA de **60 s**, em **uma única colocação** do headset (elimina o confundidor de contato entre sessões separadas identificado em §8.1).
- **Descartar os primeiros ~5 s** de cada bloco (acomodação/transição).

**Hipótese primária (travada):** potência **alfa relativa (8–13 Hz)** maior em **olhos fechados** que abertos (efeito de Berger).

**Pipeline de análise (travado, conforme [doc 30](30_EEG_Signal_Processing_Strategy.md)):** detrend → passa-banda 1–45 Hz (fase zero) → **notch 60 Hz** → janelas de 4 s → **PSD por Welch** → **alfa relativa** (nunca absoluta). `fs` calculado por bloco pelo tempo real (não juntar timestamps de condições — erro corrigido em §8.1).

**Teste estatístico (travado):** teste pareado (OF vs OA) por bloco/época + **tamanho de efeito**. Reprodutibilidade via repetição em **≥2 sessões/dias** e **ICC** (Exp. E).

**Critério de aceite (travado):** aumento de alfa em OF **detectável e replicável** entre sessões, com artefatos gerenciáveis (Exp. D). Este é o principal teste **vai/não-vai** (H-SIG-01).

**Registro obrigatório por sessão:** `poor_signal_quality`, timestamps, condição, marcações de evento, e a **tétrade de proveniência** da ADR-0030 (commit, versão DVC do dataset, versão do engine, parâmetros).
