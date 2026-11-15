# Banner do Conecta CPS — conteúdo para colar no Canva

O modelo é um **pôster acadêmico** (INTRODUÇÃO · OBJETIVOS · JUSTIFICATIVAS ·
REFERENCIAL TEÓRICO · RESULTADOS E DISCUSSÕES · REFERÊNCIAS), e não o banner de
campos livres que o [`BANNER_E_VIDEO_IA.md`](BANNER_E_VIDEO_IA.md) previa — o
conteúdo daquele arquivo **não serve aqui**.

Registro em quadro branco, não de marketing. Tudo abaixo respeita o
[`Medical/71`](../../Medical/71_Intended_Use_and_Regulatory_Positioning.md):
nenhuma afirmação de finalidade clínica ou diagnóstica.

---

## Duas coisas que eu não sei e você precisa preencher

1. **A linha do curso.** O modelo vem com *"ENSINO MÉDIO INTEGRADO AO TÉCNICO EM
   DESENVOLVIMENTO DE SISTEMAS | AMS"*, que é texto de Etec. Se a apresentação é
   pela **Fatec Zona Leste** em **Análise e Desenvolvimento de Sistemas**, a
   linha deveria ser outra — a sugestão está abaixo, mas **confirme com quem
   organiza** o que o evento espera nesse campo.
2. **O orientador.** Não aparece em nenhum documento do repositório. O professor
   citado na atividade de Sistemas Distribuídos é Rodrigo dos Santos Faustino,
   mas isso é **outra disciplina** e eu não sei se é o mesmo orientador deste
   trabalho.

---

## Cabeçalho

**Linha do curso**

> ANÁLISE E DESENVOLVIMENTO DE SISTEMAS | FATEC ZONA LESTE

**Título do trabalho**

> WaveAI: captação e análise de EEG de consumo para acompanhamento de bem-estar

**AUTORES:**

> Tiago Bryan Ramos de Oliveira
> Gustavo Mendes Ventieri Mariano
> Nickolas Maia de Araujo

**ORIENTADOR:**

> *(preencher)*

---

## INTRODUÇÃO

> O eletroencefalograma (EEG) registra a atividade elétrica cortical, mas
> historicamente exigiu ambiente clínico, equipamento caro e operador treinado.
> Dispositivos de consumo de canal único tornaram viável captar esse sinal fora
> do laboratório. O WaveAI é uma plataforma que capta, analisa e acompanha esse
> sinal ao longo do tempo, apresentando tendências de estados mentais. É uma
> ferramenta não-clínica e não-diagnóstica: mede e organiza informação, enquanto
> a interpretação cabe a um profissional de bem-estar.

## OBJETIVOS

> Desenvolver uma plataforma capaz de captar sinal de EEG de consumo em tempo
> real, processá-lo por um pipeline reprodutível e apresentar tendências
> longitudinais ao titular do dado e a um profissional por ele autorizado.
> Verificar, com coleta própria, se o sinal do dispositivo permite detectar
> contrastes de estado já estabelecidos na literatura.

## JUSTIFICATIVAS

> Desde maio de 2026 a NR-1 obriga empresas a gerenciar riscos psicossociais, e
> os afastamentos do INSS por transtornos mentais cresceram 79% entre 2023 e
> 2025. Esse acompanhamento se apoia hoje em autorrelato, sem medida objetiva
> que o complemente.

## REFERENCIAL TEÓRICO

> A literatura estabelece que dispositivos de canal único em FP1 produzem
> potências de banda relativas comparáveis às de EEG de laboratório (ROGERS et
> al., 2016) e correlação significativa com equipamento médico em registro
> simultâneo, ainda que com mais ruído (RIEIRO et al., 2019). O contraste de
> alfa entre olhos fechados e abertos — efeito de Berger — é detectável mesmo em
> montagem frontal seca (JOHNSTONE et al., 2021). O terreno mais defensável,
> portanto, são as potências relativas e os contrastes de estado.

## RESULTADOS E DISCUSSÕES

> A plataforma está em produção, captando a 512 Hz em canal único FP1. O
> pipeline aplica detrend, passa-banda de 1–45 Hz, filtro notch de 60 Hz e PSD
> de Welch, extraindo treze atributos com medida de qualidade por sessão. Em
> duas sessões de estado controlado, o contraste de alfa entre olhos fechados e
> abertos replicou com razões de 1,74 e 1,48 (d = 1,79 e 1,57; p ≪ 0,001). A
> hipótese secundária de redução de alfa sob carga cognitiva não se sustentou
> (p = 0,21 e 0,93), e segue em aberto.

## REFERÊNCIAS

> JOHNSTONE, S. J. et al., 2021 — alfa frontal reduzido em olhos abertos,
> dispositivo seco de canal único (n = 182).
> RIEIRO, H. et al., 2019 — MindWave e EEG médico em registro simultâneo em FP1
> (n = 21).
> ROGERS, J. M. et al., 2016 — EEG de canal único: potências relativas
> comparáveis às de laboratório.
> BRASIL. Portaria MTE nº 1.419/2024 — inclui riscos psicossociais na NR-1.
> ANAMT, 2026 — levantamento com microdados do INSS.

> ⚠️ **As três referências acadêmicas estão incompletas de propósito.** Dos
> nossos documentos eu tenho **autor, ano e objeto do estudo** — não tenho
> título, periódico, volume nem DOI, e **não vou inventá-los**. Complete a
> partir dos artigos originais antes de imprimir, ou peça que eu busque.

---

## De onde vem cada número

| Afirmação | Origem |
|---|---|
| 512 Hz, canal único FP1 | [`CLAUDE.md`](../../CLAUDE.md), [`Architecture/21`](../../Architecture/21_NeuroSky_Integration_and_Capture.md) |
| Pipeline e treze atributos | [`Architecture/22`](../../Architecture/22_MVP_Platform_Architecture.md), [`DataScience/32`](../../DataScience/32_Feature_Catalog.md) |
| Razões 1,74 e 1,48; d = 1,79 e 1,57; p ≪ 0,001 | [`DataScience/33`](../../DataScience/33_Signal_Fidelity_Report.md) §4b |
| Carga cognitiva não sustentada (p = 0,21 e 0,93) | [`DataScience/33`](../../DataScience/33_Signal_Fidelity_Report.md), RQ3 |
| Três referências da literatura | [`DataScience/31`](../../DataScience/31_Signal_Fidelity_Study_Protocol.md) §2 |
| 79% de 2023 a 2025 | ANAMT, com microdados do INSS |
| NR-1 desde maio de 2026 | Portaria MTE 1.419/2024, adiada pela 765/2025 |

**O resultado negativo está no pôster de propósito.** Omitir que a hipótese de
carga cognitiva não se sustentou deixaria o trabalho mais bonito e menos
honesto — e num pôster acadêmico é justamente o tipo de omissão que uma banca
procura.

## Antes de exportar

- [ ] Linha do curso confirmada com a organização
- [ ] Orientador preenchido
- [ ] Referências completadas com título e periódico
- [ ] Nenhum texto de exemplo do modelo sobrando
- [ ] Exportado em **PDF** (Compartilhar → Baixar → PDF)
