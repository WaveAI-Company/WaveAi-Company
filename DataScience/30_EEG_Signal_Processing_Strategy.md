# 30 · Estratégia de Processamento de Sinais EEG (Semente v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 (semente) |
| Status | Semente — a validar na Fase 1 |
| Data | 2026-07-18 |
| Documentos relacionados | [MASTER_PLAN](../MASTER_PLAN.md), [03_Assumptions](../03_Assumptions.md), [Medical/70_Regulatory_Clinical_Strategy](../Medical/70_Regulatory_Clinical_Strategy.md) |

> Documento mais crítico do ponto de vista científico. Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**.

---

## 1. Realidade do hardware (fatos verificados)
**[FATO]** NeuroSky MindWave Mobile 2:
- **1 canal**, eletrodo **seco** em **FP1** (testa); referência/terra no clipe de orelha.
- Saída **bruta 3–100 Hz**, amostragem **512 Hz**, 12 bits.
- Fornece potências de banda (delta…gama), **eSense** (*Attention*/*Meditation*) e detecção de piscada; indicador *poor signal quality* (0–200).

## 2. Consequências diretas (o que muda por ser canal único)
**[FATO]**
- **FP1 é a pior região para artefatos**: sofre forte **EOG** (piscadas, movimento ocular) e **EMG** (testa, sobrancelha, mandíbula).
- **ICA não é aplicável** (precisa de múltiplos canais) — a técnica-padrão de remoção de artefatos está **indisponível**.
- **Sem localização espacial**, sem montagem 10‑20, sem a maioria dos achados clínicos.
- **eSense é caixa-preta**: **[RECOMENDAÇÃO]** não usar como base clínica; no máximo como referência exploratória. Extrair **features próprias e transparentes** a partir do sinal bruto.

## 3. Pipeline proposto (por estágio)
> **[HIPÓTESE]** Pipeline candidato; cada estágio deve ser validado empiricamente na Fase 1.

### E1. Aquisição & Qualidade
- Ler sinal bruto (512 Hz) + *poor signal quality*.
- **Gate de qualidade**: descartar/《marcar》janelas com contato ruim antes de qualquer análise. **[RECOMENDAÇÃO]** registrar % de dados descartados como métrica de confiança.

### E2. Filtragem
- **Passa-banda** (ex.: 0,5–45 Hz) para focar em ritmos de interesse.
- **Notch em 60 Hz** (rede elétrica no Brasil) e harmônicos, se necessário. **[FATO]** a maior parte do Brasil opera em 60 Hz.
- Cuidado com distorção de fase → preferir filtros de fase zero (aplicação bidirecional) offline.

### E3. Tratamento de artefatos (o ponto sensível — sem ICA)
Candidatos monocanal, a comparar em benchmark:
- **Rejeição por amplitude/threshold** (piscadas geram picos grandes) — simples e robusto para *descartar*.
- **Denoising por wavelet** (ex.: DWT com thresholding).
- **Filtragem adaptativa / regressão** (se houver referência de EOG — limitada aqui).
- **EMD/EEMD** para decompor e remover componentes de artefato.
- **ASR** adaptado a canal único (limitado).
**[OPINIÃO]** Em canal único, **rejeitar** trechos contaminados costuma ser mais seguro do que tentar "limpar" e arriscar deixar artefato residual sendo interpretado como cérebro. A escolha impacta diretamente a validade clínica (risco R-03).

### E4. Janelamento (epoching)
- Janelas curtas com sobreposição (ex.: 1–4 s, 50%). Definir formalmente no Catálogo de Features.

### E5. Extração de features (transparentes)
Candidatas: potências absolutas/relativas por banda; razões (ex.: teta/beta, alfa/beta); potência total; frequência mediana/de borda espectral; entropia espectral; métricas de variabilidade temporal. **[RECOMENDAÇÃO]** priorizar features **interpretáveis** — o médico precisa entender o que embasa um alerta (XAI).

### E6. Detecção de eventos — contrastes de estado + desvio de baseline pessoal
> **[RESOLVIDO — [ADR-0032](../05_Decisions.md), 2026-07-21]** Q-CLN-03 fechada. Esta seção substitui a redação-semente anterior, cujos rótulos **não tinham definição operacional** ("os detectores mediam ruído com nome bonito").

O vocabulário de evento fica **restrito ao defensável**, em duas formas mensuráveis e reprodutíveis:

1. **Contrastes de estado** — diferença de uma feature entre condições controladas (ex.: alfa relativa olhos-fechados vs. abertos; repouso vs. carga cognitiva). É o que o estudo de fidelidade ([DataScience/31](31_Signal_Fidelity_Study_Protocol.md), Exp. B/C) já sabe medir.
2. **Desvio de um baseline pessoal** — quanto uma feature específica se afasta da linha de base **do próprio usuário**, expresso em **N desvios-padrão (N σ)**.

**[RÍGIDO]** Rótulos que soam clínicos/diagnósticos foram **abandonados** — incompatíveis com a fronteira não-clínica ([Medical/71](../Medical/71_Intended_Use_and_Regulatory_Positioning.md)) e com a regra do `CLAUDE.md`. Não há "achado" nem rótulo diagnóstico: há **contraste medido** e **desvio quantificado**.

**Cold-start e transparência ([ADR-0032](../05_Decisions.md)):** enquanto não há histórico do usuário, usa-se um **baseline populacional provisório** (dados de treino + literatura); o **baseline individual** cresce a cada sessão e passa a prevalecer. Classificações carregam **menor confiança** até um volume mínimo de observações, e a UI deve deixar **explícito o que é pessoal vs. populacional** — transparência é requisito, não enfeite.

**Ordem ([ADR-0032](../05_Decisions.md)):** as definições de evento ficam **atrás do Catálogo de Features (N2)** — sem catálogo formal, não há feature sobre a qual definir evento.

- Abordagem inicial: **heurísticas de DSP + estatística** (baselines pessoais), evoluindo para ML clássico quando houver dados rotulados (Q-DAT-01); deep learning só se justificado.

## 4. Protocolo de validação de sinal (Fase 1) — prioridade máxima
**[RECOMENDAÇÃO]** Antes de construir a plataforma:
1. Coletar simultaneamente NeuroSky **e** um EEG de referência (mais canais / grau de pesquisa).
2. Comparar features e detecções entre os dois.
3. Quantificar: concordância, sensibilidade a artefatos, reprodutibilidade teste-reteste.
4. Concluir **o que é defensável** afirmar com canal único — e o que **não** é.
Resultado alimenta a claim clínica (Q-CLN-01) e a decisão de seguir/pivotar (risco R-01).

## 5. Considerações de tempo real
- 512 Hz é leve computacionalmente; o gargalo é **qualidade**, não throughput.
- Definir latência aceitável (Q-TEC-02) e o que roda no edge vs nuvem (ADR-0005).

## 6. Perguntas em aberto deste documento
Q-SIG-01 (validade do sinal), Q-SIG-02 (EEG de referência), ~~Q-CLN-03 (definições de evento)~~ **resolvida em [ADR-0032](../05_Decisions.md)** (ver §E6), Q-AI-01 (dados rotulados), Q-AI-02 (heurística vs ML).

## 7. Próximas expansões (documentos-filho)
Protocolo de Validação de Sinal · Catálogo de Features · Definições Operacionais de Evento · Benchmark de Métodos de Artefato (em `Research/`).
