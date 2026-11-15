"""Gera o lockup da marca (simbolo + nome) para o banner do Conecta CPS.

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe \\
        Faculdade/Conecta_Pitch_2026/gerar_logo_banner.py

POR QUE ESTE SCRIPT EXISTE: o kit em Design/logos_icones/kit/ tem a marca
GRAFICA (circulo + onda + ponto) em varias formas, mas NAO tem lockup com o
nome escrito -- no app o "WaveAI" e desenhado como texto pelo componente Logo,
nao como imagem. Para o banner e preciso um arquivo unico com simbolo e nome.

A arte vem do kit, NAO e redesenhada aqui: este script so compoe o PNG
aprovado com o nome em texto. Se a marca mudar, regenere o kit primeiro
(Design/logos_icones/gerar_assets.py) e rode este em seguida.

POR QUE DUAS VERSOES: o cabecalho do modelo do Conecta e um degrade
azul-roxo-magenta movimentado. Medido no modelo, contra o pior pixel da faixa:

    teal  #4FD1C5  1,7:1      azul claro #7AA2F7  1,3:1
    teal  #0F7A70  1,0:1      azul       #2A5BC7  1,0:1
    navy  #0B1220  2,2:1      BRANCO     #FFFFFF  3,1:1

Nenhuma cor da marca sobrevive ali. Entao: ou a marca leva fundo proprio
(versao `placa`), ou vai em branco solido (versao `branca`, 3,1:1 -- passa o
minimo de 3:1 para elemento grafico e conversa com o "CONECTA CPS", que ja e
branco no modelo).
"""

import pathlib

from PIL import Image, ImageDraw, ImageFont

AQUI = pathlib.Path(__file__).resolve().parent
KIT = AQUI.parents[1] / "Design" / "logos_icones" / "kit"
DEST = AQUI / "logo"

NAVY = (0x0B, 0x12, 0x20)
BRANCO = (0xFF, 0xFF, 0xFF)
TEAL = (0x4F, 0xD1, 0xC5)

# Verdana Bold e a fonte dos titulos do deck e do nome no video: o banner,
# os slides e o video passam a falar a mesma lingua tipografica.
F_NOME = "C:/Windows/Fonts/verdanab.ttf"

ALT = 420          # altura do simbolo no lockup
MARGEM = 56


def _marca_branca():
    """Recolore a arte do kit para branco solido, preservando o alfa."""
    src = Image.open(KIT / "waveai-completa-p-fundo-escuro-2048.png")
    src = src.convert("RGBA")
    branco = Image.new("RGBA", src.size, (*BRANCO, 0))
    branco.putalpha(src.getchannel("A"))
    return branco


def _recorta(img):
    """Tira a moldura transparente, para o lockup nao herdar folga morta."""
    caixa = img.getchannel("A").getbbox()
    return img.crop(caixa)


def _escreve(base, marca, cor_nome, x, y, alt):
    larg = round(marca.width * alt / marca.height)
    m = marca.resize((larg, alt), Image.LANCZOS)
    base.alpha_composite(m, (x, y))
    f = ImageFont.truetype(F_NOME, round(alt * 0.52))
    d = ImageDraw.Draw(base)
    d.text((x + larg + round(alt * 0.22), y + alt // 2), "WaveAI",
           font=f, fill=(*cor_nome, 255), anchor="lm")
    bb = d.textbbox((x + larg + round(alt * 0.22), y + alt // 2), "WaveAI",
                    font=f, anchor="lm")
    return bb[2]


def versao_branca():
    """Simbolo e nome em branco, fundo transparente."""
    marca = _recorta(_marca_branca())
    tmp = Image.new("RGBA", (4000, ALT + MARGEM * 2), (0, 0, 0, 0))
    fim = _escreve(tmp, marca, BRANCO, MARGEM, MARGEM, ALT)
    return tmp.crop((0, 0, fim + MARGEM, tmp.height))


def versao_placa():
    """Simbolo colorido e nome branco sobre placa navy arredondada."""
    marca = _recorta(Image.open(KIT / "waveai-completa-p-fundo-escuro-2048.png")
                     .convert("RGBA"))
    tmp = Image.new("RGBA", (4000, ALT + MARGEM * 2), (0, 0, 0, 0))
    medida = Image.new("RGBA", tmp.size, (0, 0, 0, 0))
    fim = _escreve(medida, marca, BRANCO, MARGEM, MARGEM, ALT)
    larg = fim + MARGEM
    placa = Image.new("RGBA", (larg, tmp.height), (0, 0, 0, 0))
    d = ImageDraw.Draw(placa)
    d.rounded_rectangle([0, 0, larg - 1, placa.height - 1],
                        radius=round(placa.height * 0.22),
                        fill=(*NAVY, 255), outline=(*TEAL, 110), width=4)
    _escreve(placa, marca, BRANCO, MARGEM, MARGEM, ALT)
    return placa


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for nome, fn in (("waveai-banner-branca", versao_branca),
                     ("waveai-banner-placa", versao_placa)):
        img = fn()
        caminho = DEST / f"{nome}.png"
        img.save(caminho)
        print(f"{caminho.name:28s} {img.width}x{img.height}  "
              f"{caminho.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
