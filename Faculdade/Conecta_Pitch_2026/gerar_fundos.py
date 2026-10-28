"""Gera os fundos 1920x1080 do bloco de numeros do video pitch.

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe Faculdade/Conecta_Pitch_2026/gerar_fundos.py

Depende so de Pillow, como os scripts de marca em Design/logos_icones.

POR QUE SCRIPT E NAO IA DE IMAGEM: o fundo precisa das cores da marca em valor
EXATO, de 1920x1080 exatos e de uma zona de baixo contraste onde os numeros vao
entrar. Geracao por IA entrega cor aproximada e composicao aleatoria, e a
legibilidade do numero viraria sorte. Aqui ela e medida (ver medir_contraste).

Os tres fundos sao pensados para o bloco 2 do roteiro: pessoa a ESQUERDA,
numeros a DIREITA. Para inverter, espelhe no editor -- e um clique, e por isso
nao sao gerados arquivos espelhados.
"""

import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter

AQUI = pathlib.Path(__file__).resolve().parent
DEST = AQUI / "fundos"

L, A = 1920, 1080          # o video e 1080p; o fundo nasce no tamanho final
SS = 2                     # supersampling: desenha em 2x e reduz, para suavizar

# Paleta da marca (Design/logos_icones). Valores exatos, nao aproximados.
NAVY = (0x0B, 0x12, 0x20)
NAVY_ALTO = (0x10, 0x18, 0x2A)   # leve clareada para o gradiente vertical
TEAL = (0x4F, 0xD1, 0xC5)
AZUL = (0x2A, 0x5B, 0xC7)
PALE = (0x7A, 0xA2, 0xF7)
GELO = (0xF5, 0xF7, 0xFA)

# Zona dos numeros, em fracao da largura. Nada de brilho forte entra aqui: e
# onde o texto animado precisa de contraste.
ZONA_NUM = (0.52, 0.97)


def _tela():
    return Image.new("RGB", (L * SS, A * SS), NAVY)


def gradiente_vertical(img):
    """Clareia muito levemente para baixo, como bounce de chao."""
    d = ImageDraw.Draw(img)
    alt = img.height
    for y in range(alt):
        t = (y / alt) ** 1.6
        cor = tuple(round(a + (b - a) * t)
                    for a, b in zip(NAVY, NAVY_ALTO, strict=True))
        d.line([(0, y), (img.width, y)], fill=cor)


def brilho(img, cx, cy, raio, cor, forca):
    """Mancha radial suave, somada por cima. cx/cy/raio em fracao da largura."""
    camada = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(camada)
    x, y, r = cx * img.width, cy * img.height, raio * img.width
    d.ellipse([x - r, y - r, x + r, y + r], fill=round(255 * forca))
    camada = camada.filter(ImageFilter.GaussianBlur(r * 0.55))
    img.paste(Image.new("RGB", img.size, cor), (0, 0), camada)


def _onda(n, semente, aspereza=1.0):
    """Serie tipo EEG: soma de senos + rajadas. Deterministica pela semente."""
    rnd = random.Random(semente)
    comps = [(rnd.uniform(1.5, 4.0), rnd.uniform(0.25, 1.0), rnd.uniform(0, 6.3))
             for _ in range(5)]
    rajadas = [(rnd.uniform(0.1, 0.9), rnd.uniform(0.02, 0.06)) for _ in range(3)]
    pontos = []
    for i in range(n):
        t = i / (n - 1)
        v = sum(amp * math.sin(2 * math.pi * freq * t * 6 + fase)
                for freq, amp, fase in comps)
        for centro, largura in rajadas:
            v += 2.4 * math.exp(-((t - centro) / largura) ** 2) * \
                 math.sin(2 * math.pi * 28 * t)
        pontos.append(v * aspereza)
    pico = max(abs(p) for p in pontos) or 1.0
    return [p / pico for p in pontos]


def traco(img, y_frac, amp_frac, cor, forca, semente, espessura=3, desvanece=True):
    """Desenha uma onda atravessando a tela, com glow e queda de opacidade."""
    n = 1400
    vals = _onda(n, semente)
    camada = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(camada)
    y0, amp = y_frac * img.height, amp_frac * img.height
    pts = [(i / (n - 1) * img.width, y0 + v * amp) for i, v in enumerate(vals)]
    # Desenha em segmentos para poder MATAR a onda antes da zona dos numeros.
    # Atenuar dentro da zona nao bastou: medido, o glow borrado vazava para
    # dentro e derrubava o branco a 4,4:1. A onda agora morre em t=0.50, antes
    # dos 0.52 onde a zona comeca, e o raio do blur nao alcanca.
    for i in range(n - 1):
        t = i / (n - 1)
        op = 1.0
        if desvanece:
            if t < 0.06:
                op = t / 0.06
            if t > 0.38:
                op *= max(0.0, 1 - (t - 0.38) / 0.12)
        if op <= 0:
            continue
        d.line([pts[i], pts[i + 1]], fill=round(255 * op), width=espessura * SS)
    glow = camada.filter(ImageFilter.GaussianBlur(9 * SS))
    img.paste(Image.new("RGB", img.size, cor), (0, 0),
              glow.point(lambda v: round(v * forca * 0.5)))
    img.paste(Image.new("RGB", img.size, cor), (0, 0),
              camada.point(lambda v: round(v * forca)))


def skyline(img, y_frac, cor, forca, semente):
    """Picos verticais tipo horizonte de cidade -- eco do plano final da abertura."""
    rnd = random.Random(semente)
    camada = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(camada)
    y0 = y_frac * img.height
    x = 0
    while x < img.width:
        w = rnd.randint(14, 46) * SS
        h = rnd.uniform(0.02, 0.17) * img.height
        # Rampa, nao degrau: com corte seco da para ver a emenda nos predios
        # exatamente onde a zona comeca -- apareceu no primeiro render.
        t = x / img.width
        if t <= 0.44:
            op = 1.0
        elif t >= 0.56:
            op = 0.10
        else:
            op = 1.0 - 0.90 * (t - 0.44) / 0.12
        d.rectangle([x, y0 - h, x + w - 3 * SS, y0], fill=round(255 * op))
        x += w
    camada = camada.filter(ImageFilter.GaussianBlur(3 * SS))
    img.paste(Image.new("RGB", img.size, cor), (0, 0),
              camada.point(lambda v: round(v * forca)))


def vinheta(img, forca=0.55):
    masc = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(masc)
    m = int(img.width * 0.16)
    d.ellipse([-m, -m, img.width + m, img.height + m], fill=255)
    masc = masc.filter(ImageFilter.GaussianBlur(img.width * 0.09))
    escuro = Image.new("RGB", img.size, (0, 0, 0))
    img.paste(escuro, (0, 0), masc.point(lambda v: round((255 - v) * forca)))


# --------------------------------------------------------------- os tres fundos

def fundo_tracado():
    """Uma onda atravessa a tela. O mais tematico sem competir com o texto."""
    img = _tela()
    gradiente_vertical(img)
    brilho(img, 0.26, 0.52, 0.42, AZUL, 0.17)
    brilho(img, 0.20, 0.62, 0.22, TEAL, 0.10)
    traco(img, 0.615, 0.085, TEAL, 0.50, semente=7)
    traco(img, 0.655, 0.040, PALE, 0.16, semente=23, espessura=2)
    vinheta(img)
    return img


def fundo_profundidade():
    """Sem onda: so profundidade. O mais seguro para legibilidade."""
    img = _tela()
    gradiente_vertical(img)
    brilho(img, 0.30, 0.46, 0.50, AZUL, 0.19)
    brilho(img, 0.24, 0.58, 0.26, TEAL, 0.11)
    brilho(img, 0.78, 0.22, 0.30, AZUL, 0.05)
    vinheta(img, 0.62)
    return img


def fundo_onda_cidade():
    """A onda vira horizonte -- amarra com o plano final da abertura de IA."""
    img = _tela()
    gradiente_vertical(img)
    brilho(img, 0.28, 0.44, 0.44, AZUL, 0.16)
    skyline(img, 0.90, TEAL, 0.22, semente=11)
    traco(img, 0.905, 0.028, TEAL, 0.38, semente=5, espessura=2)
    brilho(img, 0.22, 0.56, 0.20, TEAL, 0.08)
    vinheta(img)
    return img


# ------------------------------------------------------------------- medicao

def _lum(c):
    def canal(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * canal(c[0]) + 0.7152 * canal(c[1]) + 0.0722 * canal(c[2])


def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    claro, escuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (escuro + 0.05)


def medir_contraste(img, nome):
    """O numero vai ser legivel? Mede contra o pixel MAIS CLARO da zona.

    Medir contra a media mentiria: basta uma mancha de brilho para o texto
    sumir num ponto. O pior caso e o que decide.
    """
    x0, x1 = int(ZONA_NUM[0] * img.width), int(ZONA_NUM[1] * img.width)
    recorte = img.crop((x0, int(img.height * 0.12), x1, int(img.height * 0.88)))
    dados = recorte.tobytes()
    pix = (tuple(dados[i:i + 3]) for i in range(0, len(dados), 3))
    pior = max(pix, key=_lum)
    linhas = []
    for rot, cor in (("TEAL #4FD1C5", TEAL), ("GELO #F5F7FA", GELO),
                     ("PALE #7AA2F7", PALE)):
        r = contraste(cor, pior)
        ok = "OK " if r >= 4.5 else "BAIXO"
        linhas.append(f"      {rot} sobre o pior pixel: {r:4.1f}:1  {ok}")
    print(f"  {nome}: pior pixel da zona dos numeros = "
          f"#{pior[0]:02X}{pior[1]:02X}{pior[2]:02X}")
    print("\n".join(linhas))


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    fundos = {
        "fundo-tracado": fundo_tracado,
        "fundo-profundidade": fundo_profundidade,
        "fundo-onda-cidade": fundo_onda_cidade,
    }
    print(f"gerando em {DEST} ({L}x{A})\n")
    for nome, fn in fundos.items():
        img = fn().resize((L, A), Image.LANCZOS)
        caminho = DEST / f"{nome}.png"
        img.save(caminho, "PNG", optimize=True)
        print(f"{caminho.name}  ({caminho.stat().st_size // 1024} KB)")
        medir_contraste(img, nome)
        print()


if __name__ == "__main__":
    main()
