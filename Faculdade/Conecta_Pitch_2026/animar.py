"""Gera as sobreposicoes animadas do video pitch (1920x1080, 30 fps).

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe Faculdade/Conecta_Pitch_2026/animar.py

Depende de Pillow e do ffmpeg (ja instalado: C:/ProgramData/chocolatey/bin).

COMO ISSO ENTRA NO VIDEO: cada beat sai como um .mov ProRes 4444 COM CANAL
ALFA -- so o grafico, fundo transparente. No editor voce arrasta o clipe para
a trilha de cima e posiciona onde a narracao pedir. Nao ha problema de
sincronia porque quem posiciona e voce, beat a beat.

Sai tambem um .mp4 de PREVIA com o fundo chapado, so para conferir o visual.
Esse nao entra no video.

Os graficos vivem na METADE DIREITA (x 998-1862, a zona medida em FUNDOS.md).
A esquerda fica livre para o rosto.
"""

import pathlib
import subprocess

from PIL import Image, ImageDraw, ImageFont

AQUI = pathlib.Path(__file__).resolve().parent
SAIDA = AQUI / "animacoes"
FUNDOS = AQUI / "fundos"
FFMPEG = "C:/ProgramData/chocolatey/bin/ffmpeg.exe"

L, A, FPS = 1920, 1080, 30

NAVY = (0x0B, 0x12, 0x20)
TEAL = (0x4F, 0xD1, 0xC5)
AZUL = (0x2A, 0x5B, 0xC7)
GELO = (0xF5, 0xF7, 0xFA)
CINZA = (0x9A, 0xA5, 0xB4)

# Verdana Bold e a fonte dos titulos do deck -- video e slides coerentes.
F_NUM = "C:/Windows/Fonts/verdanab.ttf"
F_TXT = "C:/Windows/Fonts/segoeui.ttf"
F_TXT_B = "C:/Windows/Fonts/seguisb.ttf"

ZONA_X0, ZONA_X1 = 998, 1862
ZONA_CX = (ZONA_X0 + ZONA_X1) // 2


def fonte(caminho, tam):
    return ImageFont.truetype(caminho, tam)


# ------------------------------------------------------------------ easing

def suave(t):
    """ease-out cubico: entra rapido e assenta. Bom para numero subindo."""
    return 1 - (1 - t) ** 3


def suave_io(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def janela(f, inicio, dur):
    """Progresso 0..1 de um trecho, em frames. Fora do trecho, satura."""
    if f < inicio:
        return 0.0
    if f >= inicio + dur:
        return 1.0
    return (f - inicio) / dur


def entra_sai(f, total, sobe=10, desce=10):
    """Opacidade 0..1 com fade de entrada e de saida."""
    if f < sobe:
        return f / sobe
    if f > total - desce:
        return max(0.0, (total - f) / desce)
    return 1.0


# ------------------------------------------------------------------ desenho

def cabe(txt, caminho, tam_max, larg_max):
    """Maior tamanho de fonte em que o texto cabe na largura dada.

    Sem isto o numero estoura a borda direita -- apareceu no primeiro render,
    com "393 mil" a 190 px passando de x=1862.
    """
    tam = tam_max
    while tam > 24:
        f = fonte(caminho, tam)
        if f.getbbox(txt)[2] - f.getbbox(txt)[0] <= larg_max:
            return f
        tam -= 4
    return fonte(caminho, 24)


def texto(d, xy, txt, fnt, cor, alfa=1.0, ancora="mm"):
    if alfa <= 0:
        return
    d.text(xy, txt, font=fnt, fill=(*cor, round(255 * alfa)), anchor=ancora)


def formata_mil(v):
    """393000 -> '393 mil'. Mantem o formato falado na narracao."""
    return f"{int(v) // 1000} mil"


# ------------------------------------------------------------------- beats

def beat_numero(valor, rotulo, dur_s=5.0, sufixo="", formatador=None,
                cor=TEAL, tam_num=190):
    """Numero grande subindo de 0 ate o valor, com rotulo abaixo."""
    total = round(dur_s * FPS)
    final = (formatador(valor) if formatador else
             f"{valor:,}".replace(",", ".")) + sufixo
    fn = cabe(final, F_NUM, tam_num, ZONA_X1 - ZONA_X0 - 40)
    fr = fonte(F_TXT, 34)
    subida = round(total * 0.42)

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = entra_sai(f, total, 8, 12)
        p = suave(janela(f, 6, subida))
        v = valor * p
        s = formatador(v) if formatador else f"{round(v):,}".replace(",", ".")
        # o numero sobe um pouco enquanto entra: 18 px de deslocamento
        dy = (1 - suave(janela(f, 0, 14))) * 18
        texto(d, (ZONA_CX, 452 + dy), s + sufixo, fn, cor, op)
        # o rotulo entra depois que o numero para de contar
        op_r = op * suave(janela(f, 6 + subida - 6, 12))
        for i, linha in enumerate(rotulo):
            texto(d, (ZONA_CX, 596 + i * 46), linha, fr, CINZA, op_r)
        return img

    return total, render


def beat_grade(acesos, total_pontos=100, rotulo=(), dur_s=5.5):
    """Grade de 100 pontos; alguns acendem. Para '5% dos RHs preparados'.

    E o grafico mais legivel que existe para proporcao pequena: o olho conta
    cinco pontos sem precisar de eixo nem de numero.
    """
    total = round(dur_s * FPS)
    cols, r, gap = 10, 12, 42
    larg = (cols - 1) * gap
    x0, y0 = ZONA_CX - larg // 2, 348
    fr = fonte(F_TXT, 34)
    fnum = fonte(F_NUM, 86)

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = entra_sai(f, total, 8, 12)
        for i in range(total_pontos):
            cx = x0 + (i % cols) * gap
            cy = y0 + (i // cols) * gap
            # os pontos apagados aparecem em cascata, da esquerda para a direita
            ap = suave(janela(f, 4 + (i % cols) * 1.2, 16))
            aceso = i < acesos
            # os acesos so ligam depois que a grade inteira esta na tela
            lig = suave(janela(f, 4 + cols * 1.2 + 16, 14)) if aceso else 0.0
            base = round(34 + 26 * ap)
            d.ellipse([cx - r, cy - r, cx + r, cy + r],
                      fill=(0x2A, 0x3A, 0x55, round(base * op)))
            if lig > 0:
                rr = r + 2
                d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                          fill=(*TEAL, round(255 * lig * op)))
        op_n = op * suave(janela(f, 4 + cols * 1.2 + 22, 14))
        # a grade termina em y=348+9*42=726; o numero comeca bem abaixo
        texto(d, (ZONA_CX, 822), f"{acesos}%", fnum, TEAL, op_n)
        for i, linha in enumerate(rotulo):
            texto(d, (ZONA_CX, 896 + i * 42), linha, fr, CINZA, op_n)
        return img

    return total, render


# ------------------------------------------------------- render e codificacao

def _render(nome, total, fn):
    tmp = SAIDA / f"_{nome}"
    tmp.mkdir(parents=True, exist_ok=True)
    for f in tmp.glob("*.png"):
        f.unlink()
    for f in range(total):
        fn(f).save(tmp / f"{f:05d}.png")
    return tmp


def _ffmpeg(args):
    r = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                        *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg falhou:\n{r.stderr[:800]}")


def exporta(nome, total, fn):
    """Grava o .mov com alfa (o que entra no video)."""
    tmp = _render(nome, total, fn)
    mov = SAIDA / f"{nome}.mov"
    _ffmpeg(["-framerate", str(FPS), "-i", str(tmp / "%05d.png"),
             "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
             str(mov)])
    return tmp, mov


def previa(nome, partes, fundo="fundo-tracado"):
    """Junta os beats sobre o fundo chapado, so para conferir o visual."""
    base = Image.open(FUNDOS / f"{fundo}.png").convert("RGBA")
    tmp = SAIDA / f"_previa_{nome}"
    tmp.mkdir(parents=True, exist_ok=True)
    for f in tmp.glob("*.png"):
        f.unlink()
    i = 0
    for total, fn in partes:
        for f in range(total):
            Image.alpha_composite(base, fn(f)).convert("RGB").save(
                tmp / f"{i:05d}.png")
            i += 1
    mp4 = SAIDA / f"{nome}-previa.mp4"
    _ffmpeg(["-framerate", str(FPS), "-i", str(tmp / "%05d.png"),
             "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", str(mp4)])
    return tmp, mp4, i


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)

    beats = {
        "b2-393mil": beat_numero(
            393_000,
            ("afastamentos do INSS por transtornos mentais em 2025",
             "— 79% acima de 2023"),
            dur_s=4.5, formatador=formata_mil),
        "b2-5porcento": beat_grade(
            5, rotulo=("dos RHs se dizem preparados para a NR-1",),
            dur_s=5.5),
    }

    print(f"saida: {SAIDA}\n")
    partes = []
    for nome, (total, fn) in beats.items():
        tmp, mov = exporta(nome, total, fn)
        print(f"{mov.name:22s} {total:4d} frames  "
              f"{total / FPS:4.1f}s  {mov.stat().st_size // 1024:6d} KB  (alfa)")
        for p in tmp.glob("*.png"):
            p.unlink()
        tmp.rmdir()
        partes.append((total, fn))

    tmp, mp4, n = previa("b2", partes)
    print(f"{mp4.name:22s} {n:4d} frames  {n / FPS:4.1f}s  "
          f"{mp4.stat().st_size // 1024:6d} KB  (previa, nao entra no video)")
    for p in tmp.glob("*.png"):
        p.unlink()
    tmp.rmdir()


if __name__ == "__main__":
    main()
