# Marca WaveAI — fonte, geração e kit

Tudo o que a marca é sai **de um vetor só**. Não existe segunda arte: os ícones do
app, o favicon e os arquivos de rede social são todos gerados dos mesmos
contornos, então nenhum deles pode envelhecer sozinho.

## Onde estão as imagens prontas

| Para quê | Onde |
|---|---|
| **Redes sociais, apresentação, material** | `kit/` (esta pasta) |
| Ícone do app, favicon (usados pelo `app.json`) | `apps/wave-app/assets/` |
| Marca dentro da interface | desenhada em código, `src/components/brand/Logo.tsx` |

## Como escolher o arquivo do `kit/`

O nome diz onde ele vai pousar — e é isso que importa, não o nome da cor:

- **`-p-fundo-escuro`** → use sobre fundo **escuro** (post escuro, slide escuro,
  vídeo). Turquesa `#4FD1C5` → azul `#7AA2F7`.
- **`-p-fundo-claro`** → use sobre fundo **claro** (papel, slide branco, story
  claro). Verde-petróleo `#0F7A70` → azul `#2A5BC7`.

Usar o par trocado é o que deixa a marca apagada: o par claro sobre fundo claro
rende 1,8:1, e o par escuro sobre fundo escuro rende 3,05:1 — contra os 10,04:1
do par certo. Não é questão de gosto, é de enxergar.

E as formas:

- **`completa`** — anel + onda + ponto. Onde há espaço: capa, banner, slide,
  cabeçalho. Abaixo de ~48px o traço do anel vira um fio (ele tem 3,5% do lado
  da arte), então não use a completa em coisa pequena.
- **`simbolo`** — só a onda com o ponto. Para tamanhos pequenos e para quando a
  marca aparece junto de outros elementos.
- **`avatar`** — quadrado, com o gradiente de fundo e a arte vazada. É o que
  serve de **foto de perfil**: um PNG transparente vira marca invisível quando a
  plataforma põe fundo branco por baixo.

PNGs vêm em 512, 1024 e 2048 (o avatar em 512 e 1024). Os **SVG** escalam sem
limite — prefira-os sempre que a ferramenta aceitar.

Todos os PNGs de marca têm **fundo transparente**; só os `avatar-*` são opacos.

## Como isso é gerado

Três scripts, nesta ordem. Rodam da **raiz do repositório** e só dependem de
Pillow (a mesma que a API já usa):

```
services/api/.venv/Scripts/python.exe Design/logos_icones/extrair_geometria.py
services/api/.venv/Scripts/python.exe Design/logos_icones/gerar_assets.py
services/api/.venv/Scripts/python.exe Design/logos_icones/gerar_logo_tsx.py
```

1. **`extrair_geometria.py`** — lê `logo_escura.png` (o desenho aprovado),
   separa anel, onda e ponto por espessura local, traça os contornos e escreve
   `geometria.json`. Reporta a fidelidade contra a máscara do PNG: hoje **IoU
   98,0%** no total (onda 99,5%, anel 96,2%, ponto 96,5%).
2. **`gerar_assets.py`** — escreve os SVG e PNG de `apps/wave-app/assets/` e o
   `kit/` desta pasta. Mede o vazamento da zona segura do ícone adaptativo.
3. **`gerar_logo_tsx.py`** — escreve o componente `Logo.tsx` do app.

Para mudar **as cores**, edite os tokens e rode do passo 2. Para mudar **o
desenho**, troque `logo_escura.png` e rode os três.

`confere.png` e `mascara.png` aparecem ao rodar o passo 1: servem para olhar a
extração e estão no `.gitignore`.

## Duas formas, de propósito

Autenticação (login, cadastro, recuperação, verificação) usa o **símbolo**; o app
já logado — sidebar e rail — usa a **completa**. Decidido olhando as duas na
tela, não no papel.

## O que não fazer

- **Não redesenhe a marca em outra ferramenta.** Se ela divergir do vetor, os
  ícones do app e o material passam a ser coisas diferentes.
- **Não estique** os arquivos: a proporção é quadrada, e o `viewBox` já traz o
  respiro.
- **Não recolora** manualmente. Os dois pares existem por contraste medido; um
  terceiro par inventado não passa por verificação nenhuma.
- **Não use roxo/violeta** perto da marca em gráficos: `#9085E9` / `#6D5AC4` é a
  cor com que os gráficos significam a banda gama.
