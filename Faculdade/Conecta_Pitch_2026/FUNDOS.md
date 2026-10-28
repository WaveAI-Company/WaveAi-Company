# Fundos do vídeo — 1920×1080

Fundos estilizados para os blocos em que alguém fala e **números entram
animados** por cima (bloco 2 do [roteiro](ROTEIRO_VIDEO_PITCH.md), e servem
também para os blocos 3, 6, 7 e 8).

Gerados por [`gerar_fundos.py`](gerar_fundos.py) — **artefato gerado, não editar
à mão.** Para mudar, mexa no script e rode de novo:

```bash
services/api/.venv/Scripts/python.exe Faculdade/Conecta_Pitch_2026/gerar_fundos.py
```

## Por que script e não IA de imagem

O fundo precisa de três coisas que geração por IA não entrega de forma
confiável: **1920×1080 exatos**, as **cores da marca em valor exato**
(`#0B1220`, `#4FD1C5`, `#2A5BC7`) e uma **zona de baixo contraste** onde o
número animado fique legível. Com IA, a legibilidade viraria sorte. Aqui ela é
**medida** — o script imprime o contraste contra o **pixel mais claro** da zona
dos números, que é o pior caso. Medir contra a média mentiria: basta uma mancha
de brilho para o texto sumir num ponto.

Se ainda assim quiser gerar por IA, o prompt está no fim deste arquivo.

## Os três

| Arquivo | O que é | Quando usar |
|---|---|---|
| `fundo-tracado.png` | Uma onda tipo EEG atravessa a metade esquerda e morre antes da zona dos números | **O padrão.** O mais temático sem competir com o texto |
| `fundo-profundidade.png` | Sem onda: só profundidade, brilho suave e vinheta | Quando o bloco tiver muito texto, ou quando a pessoa ocupar mais espaço |
| `fundo-onda-cidade.png` | A onda vira horizonte de cidade no rodapé | **Amarra com o plano final da abertura de IA.** Bom para o bloco 7 (modelo de negócio) ou para o encerramento |

Composição pensada para **pessoa à esquerda, números à direita**. Para inverter,
**espelhe no editor** — é um clique, por isso não há arquivos espelhados.

## Contraste medido (27/10/2026)

Contra o pixel mais claro da zona dos números. O mínimo aceitável é 4,5:1.

| Fundo | Pior pixel | Teal `#4FD1C5` | Branco `#F5F7FA` |
|---|---|---|---|
| `fundo-tracado` | `#13213C` | **8,6:1** | **14,9:1** |
| `fundo-profundidade` | `#152746` | **8,0:1** | **13,9:1** |
| `fundo-onda-cidade` | `#183148` | **7,2:1** | **12,4:1** |

> **Não use o azul claro `#7AA2F7` para número sobre o `fundo-onda-cidade`:**
> dá **4,0:1**, abaixo do mínimo. Nos outros dois ele passa. Teal e branco
> passam em todos.

## Zonas, em pixels

| Zona | X | Para quê |
|---|---|---|
| Pessoa | 0 – 960 | Rosto, ou a pessoa recortada |
| **Números** | **998 – 1862** | Número grande + rótulo. É a faixa que foi medida |
| Margem segura | 60 de cada lado | Nada encostado na borda |

O número grande cabe confortável em **120–180 pt**; o rótulo abaixo, em 28–34 pt.
O roteiro pede **um número por vez** — o anterior sai antes do próximo entrar.

## No editor

- **Dê vida com movimento lento, não com mais elementos.** Um *zoom* de 100% → 104% ao longo do bloco inteiro basta; o fundo é parado de propósito.
- **O número entra com *count-up* de ~0,6 s** e sai em *fade*. Um *tick* grave no áudio a cada número.
- **Não ponha os três números juntos na tela.** O roteiro é explícito: um por vez.
- Se a pessoa for recortada (remoção de fundo), o brilho da esquerda ajuda a separá-la — posicione-a **sobre** o brilho, não ao lado.

---

## Alternativa: gerar por IA

Se preferir esse caminho, use este prompt. **Ressalva honesta:** vai sair bonito,
mas **não vai bater as cores da marca** nem garantir a zona limpa à direita — o
contraste do número você terá de conferir no olho, porque não dá para medir o
que a IA devolve sem repetir a conta.

```text
Minimalist abstract background for a video title card, 16:9, very dark navy
near-black field. A single thin glowing cyan waveform line, like an EEG trace,
crosses only the left half of the frame and fades out before the middle. A
soft wide radial glow of deep blue sits behind it on the left. The entire
right half is almost completely empty, flat and dark, with no detail and no
brightness. Subtle vignette at the edges. Cold palette only: deep navy, cyan
and electric blue, no warm tones. Clean, premium, technological, lots of
negative space. Flat graphic design, not photographic.

Negative: no text, no letters, no numbers, no logos, no user interface, no
charts, no people, no brain, no medical imagery, no warm colors, no clutter,
no bright elements on the right side.
```

Peça em **1920×1080** ou proporção 16:9 e amplie depois. Se a IA insistir em pôr
detalhe no lado direito, acrescente *"the right third of the image is empty
dark space"* e gere de novo.
