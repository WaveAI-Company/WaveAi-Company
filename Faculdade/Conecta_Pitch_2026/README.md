# Pitch WaveAI — AMS Conecta, Encontro da Regional 4 (CPS)

Material da apresentação do WaveAI no encontro da Regional 4 do Centro Paula
Souza. **Não é produto** — como o resto de `Faculdade/`, está no `paths-ignore`
do deploy.

| Data | O que |
|---|---|
| **30/10/2026** | Entrega do **vídeo pitch** (5 min) e do **banner em PDF** |
| **27/11/2026** | Apresentação presencial |

Apresentam os três: Tiago Bryan Ramos de Oliveira, Gustavo Mendes Vetieri
Mariano e Nickolas Maia de Araujo.

## Por onde começar

| Arquivo | Para quem | O que tem |
|---|---|---|
| [`ROTEIRO_VIDEO_PITCH.md`](ROTEIRO_VIDEO_PITCH.md) | **Os três — leiam inteiro** | As falas, cronometradas e divididas por pessoa; a montagem efeito a efeito; a ordem das telas da demo; as fontes dos dados; com o que editar |
| [`PROMPTS_DREAMINA.md`](PROMPTS_DREAMINA.md) | Quem for gerar a abertura | Os dois JSON do Seedance, o custo **medido** em créditos e a ordem de execução que deixa saldo para refazer |
| [`BANNER_E_VIDEO_IA.md`](BANNER_E_VIDEO_IA.md) | Quem for fazer o banner | Texto pronto para colar no modelo do Canva, campo a campo, mais os quatro conceitos de vídeo que foram considerados |
| `WaveAI_Pitch_Conecta.pptx` | Apresentação | O deck, no template da organização |

## Antes de gravar ou falar qualquer coisa: leia o §0 do roteiro

O WaveAI é **não-clínico e não-diagnóstico por decisão registrada**
([`Medical/71`](../../Medical/71_Intended_Use_and_Regulatory_Positioning.md),
ADR-0012) — é isso que o mantém fora do enquadramento de dispositivo médico na
ANVISA e dentro das regras da Play Store. **Frase dita num vídeo público vale
como claim.**

O roteiro usa dados de saúde mental para dimensionar o problema, e o §0 tem a
tabela de *o que nunca dizer* × *o que dizer*. O risco não está no texto escrito
— está em alguém improvisar na gravação.

## Sobre o `.pptx` e o `gerar_deck.py`

O `gerar_deck.py` produziu a **primeira versão** do deck a partir de
`template.pptx` (o modelo enviado pela organização, que **não** está versionado
aqui — ele veio de fora e é deles).

**A partir do momento em que alguém editar o `.pptx` à mão no PowerPoint, o
gerador fica para trás e não deve ser rodado de novo** — rodá-lo apagaria a
edição. Ele fica como registro de como o deck foi montado e de onde vieram as
medidas de layout, não como fonte de verdade. A fonte de verdade do deck é o
próprio `.pptx`.

(Isso é o oposto da regra dos artefatos gerados do produto, como
`Design/guia-de-estilo.html`, que **nunca** se edita à mão. A diferença é que
aquele é regenerado pelo CI a cada mudança de token, e este é entrega única.)

## O que ainda falta

- [ ] Gerar a abertura no Dreamina — **orçamento apertado**: o plano gasta 4.780
      dos 8.554 créditos e deixa 3.774 para refazer uma parte. Siga a ordem do
      §6 do `PROMPTS_DREAMINA.md`; fora dela o saldo não fecha
- [ ] Gravar as falas dos três e as telas da demo (checklist no §9 do roteiro)
- [ ] Montar e cronometrar — **abaixo de 5:00 medido, não estimado**
- [ ] Preencher o banner no Canva e exportar em PDF
- [ ] Validar o preço da assinatura com um profissional de bem-estar de verdade
      (é a premissa mais frágil; por isso a projeção de receita saiu do deck)
