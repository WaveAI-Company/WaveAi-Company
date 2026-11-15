"""Estagio 2 da montagem: constroi cada bloco de video e junta tudo.

Uso (da raiz do repo), DEPOIS de montar_audio.py:
    python Faculdade/Conecta_Pitch_2026/montar_video.py

Depende de Pillow e ffmpeg. Le:
  pitch/_build/audio/*.wav   (narracao ja normalizada)
  pitch/...                   (abertura de IA, telas, aparelho, linkedin)
  fundos/*.png
Escreve pitch/_build/video/ e o corte final em pitch/_build/pitch-waveai.mp4

PRINCIPIO: a duracao de cada bloco vem do AUDIO, nao do roteiro. E o tempo de
cada animacao vem da MARCACAO POR PALAVRA da transcricao -- o numero entra na
tela no instante em que a palavra e falada, nao num tempo estimado.
"""

import json
import pathlib
import subprocess
import sys
import unicodedata

import animar as an
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

AQUI = pathlib.Path(__file__).resolve().parent
PITCH = AQUI / "pitch"
AUDIO = PITCH / "_build" / "audio"
VIDEO = PITCH / "_build" / "video"
TRANSCR = pathlib.Path(
    "C:/Users/TIAGO_~1/AppData/Local/Temp/claude/"
    "C--Users-tiago-0mao8ei-Claude-Projects-WaveAI/"
    "ae878d66-d7f4-4ab7-878c-38c84ebbb392/scratchpad/transcricao")
FF = an.FFMPEG

# `python montar_video.py b6 b7 card` refaz so esses; sem argumento, refaz
# o que estiver faltando. Rerenderizar tudo custa ~25 min.
REFAZER = set(sys.argv[1:])

# Sobreposicao das transicoes. Cada bloco e renderizado com XF segundos a
# mais de cauda e o encadeamento usa `xfade` com offset = duracao ACUMULADA
# DO AUDIO. A transicao come a cauda, nao o conteudo, entao a sincronia com
# a narracao nao se mexe em nenhum ponto do video.
XF = 0.6
# Sobreposicao entre as gravacoes de tela, dentro do bloco 5.
XD = 0.45
L, A, FPS = an.L, an.A, an.FPS
NAVY, TEAL, AZUL, GELO, CINZA = an.NAVY, an.TEAL, an.AZUL, an.GELO, an.CINZA
PALE = (0x7A, 0xA2, 0xF7)


def ff(args):
    r = subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", *args],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg falhou:\n{' '.join(map(str, args))[:400]}\n"
                         f"{r.stderr[:900]}")


def dur(caminho):
    return float(subprocess.run(
        ["C:/ProgramData/chocolatey/bin/ffprobe.exe", "-v", "error",
         "-show_entries", "format=duration", "-of", "default=nw=1:nk=1",
         str(caminho)], capture_output=True, text=True).stdout.strip())


# ----------------------------------------------------- tempos pela transcricao

def _simples(t):
    t = unicodedata.normalize("NFD", t.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn" and
                   (c.isalnum() or c == " ")).strip()


def quando(chave, frase, desloca, cortes=()):
    """Instante (no bloco) em que `frase` comeca a ser falada.

    Le a marcacao por palavra da transcricao. `desloca` e o inicio do recorte
    do bloco; `cortes` sao trechos removidos, para descontar.
    """
    d = json.loads((TRANSCR / f"{chave}.json").read_text(encoding="utf-8"))
    palavras = [w for s in d["segmentos"] for w in s["palavras"]]
    alvo = _simples(frase).split()
    for i in range(len(palavras) - len(alvo) + 1):
        if [_simples(p["p"]) for p in palavras[i:i + len(alvo)]] == alvo:
            t = palavras[i]["i"]
            for de, ate in cortes:
                if t >= ate:
                    t -= (ate - de)
            return round(t - desloca, 2)
    raise SystemExit(f"frase nao encontrada em {chave}: {frase!r}")


# ------------------------------------------------------------- blocos pintados

def _fundo(nome):
    return Image.open(an.FUNDOS / f"{nome}.png").convert("RGBA")


def _zoom(base, f, total, de=1.0, ate=1.045):
    """Zoom lento no fundo: da vida sem acrescentar elemento."""
    e = de + (ate - de) * (f / max(total - 1, 1))
    w, h = int(L * e), int(A * e)
    return base.resize((w, h), Image.LANCZOS).crop(
        ((w - L) // 2, (h - A) // 2, (w - L) // 2 + L, (h - A) // 2 + A))


def pinta_bloco(nome, segundos, fundo, beats, parado=False, camadas=()):
    """Renderiza um bloco: fundo com zoom lento + beats em sequencia.

    `camadas` sao elementos PERSISTENTES (o aparelho, por exemplo): entram
    antes dos beats e NAO sofrem o corte. Sem essa separacao, uma camada que
    comeca no mesmo instante de um beat era cortada em 9 quadros -- foi o que
    sumiu com o aparelho na segunda montagem.

    Um beat e CORTADO quando o proximo comeca. Sem isso eles se sobrepoem e
    dois textos ficam na tela ao mesmo tempo, um por cima do outro -- foi o
    que aconteceu em b6 e b7 na primeira montagem, visivel na folha de
    contato. O corte tem 8 quadros de esmaecimento para nao piscar.
    """
    saida = VIDEO / f"{nome}.mp4"
    if saida.exists() and nome not in REFAZER:
        return saida
    util = round(segundos * FPS)
    total = util + round(XF * FPS)      # cauda para a transicao morder
    beats = sorted(beats, key=lambda b: b[0])
    limites = [round(beats[i + 1][0] * FPS) if i + 1 < len(beats) else util
               for i in range(len(beats))]
    base = _fundo(fundo)
    tmp = VIDEO / f"_{nome}"
    tmp.mkdir(parents=True, exist_ok=True)
    for p in tmp.glob("*.png"):
        p.unlink()
    # pre-renderiza os quadros de cada beat uma vez
    for f in range(total):
        quadro = base.copy() if parado else _zoom(base, f, total)
        for inicio, n_cam, fn in camadas:
            i = round(inicio * FPS)
            if i <= f < i + n_cam:
                quadro = Image.alpha_composite(quadro, fn(f - i))
        for k, (inicio, n_beat, fn) in enumerate(beats):
            i = round(inicio * FPS)
            fim = min(i + n_beat, limites[k])
            if not (i <= f < fim):
                continue
            camada = fn(f - i)
            restam = fim - f
            if restam < 8 and fim < i + n_beat:   # cortado pelo proximo beat
                camada.putalpha(camada.getchannel("A").point(
                    lambda v, _k=restam / 8: round(v * _k)))
            quadro = Image.alpha_composite(quadro, camada)
        quadro.convert("RGB").save(tmp / f"{f:05d}.png")
    ff(["-framerate", str(FPS), "-i", str(tmp / "%05d.png"),
        "-c:v", "libx264", "-crf", "17", "-preset", "medium",
        "-pix_fmt", "yuv420p", str(saida)])
    for p in tmp.glob("*.png"):
        p.unlink()
    tmp.rmdir()
    return saida


# -------------------------------------------------------------- beats extras

def beat_barras(grupos, dur_s=5.0):
    """Grupos de barras lado a lado.

    `grupos` e [(titulo, [valores], [rotulos], destaque)]. Dois grupos num beat
    so porque o Nickolas fala "ansiedade" e "burnout" com 1,64 s de intervalo:
    beats separados se atropelavam -- foi o que aconteceu no primeiro corte.
    """
    total = round(dur_s * FPS)
    ft = an.fonte(an.F_TXT_B, 38)
    fr = an.fonte(an.F_TXT, 30)
    fn = an.fonte(an.F_NUM, 104)
    larg, gap, entre = 120, 56, 300
    base_y, alt_max = 700, 290
    bloco = [len(v) * larg + (len(v) - 1) * gap for _, v, _, _ in grupos]
    total_w = sum(bloco) + entre * (len(grupos) - 1)
    x = an.ZONA_CX - total_w // 2

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 8, 12)
        xi = x
        for g, (titulo, vals, rots, destaque) in enumerate(grupos):
            atraso = g * 16
            pico = max(vals)
            an.texto(d, (xi + bloco[g] // 2, 318), titulo, ft, GELO,
                     op * an.suave(an.janela(f, 4 + atraso, 14)))
            for i, v in enumerate(vals):
                pv = an.suave(an.janela(f, 12 + atraso + i * 8, 20))
                h = alt_max * (v / pico) * pv
                bx = xi + i * (larg + gap)
                cor = TEAL if i == len(vals) - 1 else (0x2A, 0x3A, 0x55)
                d.rounded_rectangle([bx, base_y - h, bx + larg, base_y],
                                    radius=10, fill=(*cor, round(240 * op)))
                an.texto(d, (bx + larg // 2, base_y + 40), rots[i], fr, CINZA,
                         op * pv)
            pn = an.suave(an.janela(f, 12 + atraso + len(vals) * 8 + 10, 14))
            an.texto(d, (xi + bloco[g] // 2, 850), destaque, fn, TEAL, op * pn)
            xi += bloco[g] + entre
        return img

    return total, render


def beat_lista(titulo, itens, dur_s=6.0, cor_num=TEAL, x0=None,
               larg_max=None):
    """Itens entrando um a um, com marcador. Para receitas e para o pedido."""
    total = round(dur_s * FPS)
    ft = an.fonte(an.F_TXT_B, 40)
    fd = an.fonte(an.F_TXT, 36)
    passo = max(14, (total - 30) // max(len(itens), 1))
    # Centraliza o grupo verticalmente. Antes o texto comecava em y=390 fixo e,
    # com um item so, sobrava meia tela vazia embaixo -- visto na folha de
    # contato do primeiro corte.
    alt_item = [162 if sub else 108 for _, sub in itens]
    alt = sum(alt_item) + (76 if titulo else 0)
    y0 = max(300, 540 - alt // 2)
    x0 = an.ZONA_X0 if x0 is None else x0
    larg = larg_max or (an.ZONA_X1 - x0)

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 8, 12)
        y = y0
        if titulo:
            an.texto(d, (x0, y), titulo, ft, cor_num, op, "lm")
            y += 76
        for i, (cab, sub) in enumerate(itens):
            p = an.suave(an.janela(f, 12 + i * passo, 16))
            if p <= 0:
                continue
            dx = (1 - p) * 40
            fcab = an.cabe(cab, an.F_TXT_B, 62, larg - 76)
            d.ellipse([x0 + dx, y + 22, x0 + 26 + dx, y + 48],
                      fill=(*cor_num, round(255 * op * p)))
            an.texto(d, (x0 + 58 + dx, y + 35), cab, fcab, GELO,
                     op * p, "lm")
            if sub:
                an.texto(d, (x0 + 58 + dx, y + 100), sub, fd, CINZA,
                         op * p, "lm")
            y += alt_item[i]
        return img

    return total, render


def beat_texto(linhas, dur_s=4.0, tam=78, cor=GELO, y=500, fonte=None,
               cx=None, larg=None):
    """Texto grande centralizado na zona. Para perguntas e frases de virada."""
    total = round(dur_s * FPS)

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 10, 12)
        n = len(linhas)
        y0 = y - (n - 1) * (tam + 26) // 2
        for i, ln in enumerate(linhas):
            p = an.suave(an.janela(f, 6 + i * 9, 16))
            fl = an.cabe(ln, fonte or an.F_TXT_B, tam,
                         larg or (an.ZONA_X1 - an.ZONA_X0))
            an.texto(d, (cx or an.ZONA_CX,
                         y0 + i * (tam + 26) - (1 - p) * 18),
                     ln, fl, cor, op * p)
        return img

    return total, render


def beat_abertura(linhas, dur_s=5.0, tam=72):
    """Frase de abertura: entra palavra por palavra, com um risco crescendo.

    Existe para tapar o vazio: no primeiro corte os 5,25 s ate o primeiro
    numero ficavam com voz e tela parada.
    """
    total = round(dur_s * FPS)

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 10, 14)
        y0 = 500 - (len(linhas) - 1) * (tam + 24) // 2
        for i, ln in enumerate(linhas):
            palavras = ln.split()
            fl = an.cabe(ln, an.F_TXT_B, tam, an.ZONA_X1 - an.ZONA_X0)
            larg = fl.getbbox(ln)[2] - fl.getbbox(ln)[0]
            x = an.ZONA_CX - larg // 2
            for j, w in enumerate(palavras):
                pw = an.suave(an.janela(f, 6 + i * 10 + j * 5, 12))
                wl = fl.getbbox(w + " ")[2] - fl.getbbox(w + " ")[0]
                an.texto(d, (x, y0 + i * (tam + 24) - (1 - pw) * 12), w, fl,
                         GELO, op * pw, "lm")
                x += wl
        pl = an.suave(an.janela(f, 6 + len(linhas) * 10 + 10, 20))
        if pl > 0:
            lw = 190 * pl
            yy = y0 + (len(linhas) - 1) * (tam + 24) + tam
            d.line([(an.ZONA_CX - lw, yy), (an.ZONA_CX + lw, yy)],
                   fill=(*TEAL, round(190 * op)), width=4)
        return img

    return total, render


def beat_data(dia, meio, baixo, dur_s=8.0):
    """Data grande com um selo. Para a janela longa da NR-1 (11,8 s)."""
    total = round(dur_s * FPS)
    fm = an.fonte(an.F_TXT_B, 54)
    fb = an.fonte(an.F_TXT, 38)

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 10, 14)
        p1 = an.suave(an.janela(f, 4, 18))
        fdl = an.cabe(dia, an.F_NUM, 150, an.ZONA_X1 - an.ZONA_X0 - 80)
        an.texto(d, (an.ZONA_CX, 400 - (1 - p1) * 20), dia, fdl, GELO, op * p1)
        p2 = an.suave(an.janela(f, 20, 18))
        larg = 430 * p2
        d.line([(an.ZONA_CX - larg, 500), (an.ZONA_CX + larg, 500)],
               fill=(*TEAL, round(170 * op)), width=3)
        p3 = an.suave(an.janela(f, 28, 18))
        an.texto(d, (an.ZONA_CX, 588), meio, fm, TEAL, op * p3)
        p4 = an.suave(an.janela(f, 44, 18))
        for i, ln in enumerate(baixo):
            an.texto(d, (an.ZONA_CX, 686 + i * 52), ln, fb, CINZA, op * p4)
        return img

    return total, render


def beat_escala(dur_s=6.0):
    """A escala de 1 a 5 do questionario, e o carimbo 'autorrelato'."""
    total = round(dur_s * FPS)
    fnum = an.fonte(an.F_NUM, 56)
    ft = an.fonte(an.F_TXT_B, 62)
    r, gap = 56, 172
    x0 = an.ZONA_CX - 2 * gap

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 8, 12)
        for i in range(5):
            p = an.suave(an.janela(f, 4 + i * 5, 14))
            x, y = x0 + i * gap, 440
            d.ellipse([x - r, y - r, x + r, y + r],
                      outline=(*CINZA, round(190 * op * p)), width=3)
            an.texto(d, (x, y), str(i + 1), fnum, CINZA, op * p * 0.9)
        pc = an.suave(an.janela(f, 36, 16))
        # texto grande + risco FINO no meio: a 34 pt com 5 px a linha
        # parecia uma barra por cima da palavra, nao um risco.
        apaga = max(0.45, 1 - max(0.0, pc - 0.55) * 1.4)
        an.texto(d, (an.ZONA_CX, 660), "autorrelato", ft, GELO,
                 op * pc * apaga)
        # O risco tem de cruzar a ALTURA-X, nao a caixa de tinta da palavra:
        # as hastes do "t" e do "l" puxam o topo da caixa para cima e o meio
        # dela fica 7 px acima do corpo das minusculas (medido). A letra "o"
        # na mesma ancora da exatamente a faixa de altura-x.
        cx0, _, cx1, _ = d.textbbox((an.ZONA_CX, 660), "autorrelato",
                                    font=ft, anchor="mm")
        _, oy0, _, oy1 = d.textbbox((an.ZONA_CX, 660), "o",
                                    font=ft, anchor="mm")
        meia = (cx1 - cx0) / 2 + 16
        ymeio = (oy0 + oy1) / 2
        if pc > 0.45:
            larg = meia * min(1.0, (pc - 0.45) * 2.6)
            d.line([(an.ZONA_CX - larg, ymeio), (an.ZONA_CX + larg, ymeio)],
                   fill=(*TEAL, round(220 * op)), width=4)
        return img

    return total, render


# ------------------------------------------------------- aparelho recortado

def recorta_aparelho(destino):
    """Recorta o fundo branco do aparelho, do PRIMEIRO quadro apenas.

    O video "foto cinematografica" amplia ao longo dos 7 s e, no fim, o zoom
    ja empurrou a bateria e o topo do arco para FORA do quadro -- o corte esta
    gravado na origem, entao reduzir a caixa de composicao nao resolve.
    Uso so o primeiro quadro, onde o aparelho esta inteiro, e aplico um zoom
    proprio em `beat_aparelho`, que eu controlo e nunca estoura.

    Duas etapas na mascara, porque uma so nao resolve (medido em 29/10):
      1. preenchimento a partir das bordas -> fundo externo;
      2. branco grande (erosao morfologica) -> o vao DENTRO do arco.
    O reflexo branco sobre a haste e fino, some na erosao e por isso fica.
    """
    src = PITCH / "neurosky" / "foto-cinematografica.mp4"
    tmp = VIDEO / "_ap.png"
    ff(["-i", str(src), "-vframes", "1", str(tmp)])
    im = Image.open(tmp).convert("RGB")
    im = im.crop((6, 6, im.width - 6, im.height - 6))
    w, h = im.size
    trab = im.copy()
    for pt in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(trab, pt, (255, 0, 255), thresh=42)
    arr = np.asarray(trab)
    marcado = ((arr[:, :, 0] == 255) & (arr[:, :, 1] == 0) &
               (arr[:, :, 2] == 255))
    borda = Image.fromarray((marcado * 255).astype(np.uint8), "L")
    branco = im.convert("L").point(lambda v: 255 if v > 228 else 0)
    grande = branco.filter(ImageFilter.MinFilter(15))
    grande = grande.filter(ImageFilter.MaxFilter(21))
    grande = ImageChops.multiply(grande, branco)
    masc = ImageChops.invert(ImageChops.lighter(borda, grande))
    masc = masc.filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert("RGBA")
    out.putalpha(masc)
    out.save(destino)
    tmp.unlink()
    return out.size


def beat_aparelho(caminho, dur_s, x, y, alt0=520, alt1=580):
    """O aparelho entrando, com zoom lento proprio. Nunca sai do quadro."""
    total = round(dur_s * FPS)
    base = Image.open(caminho).convert("RGBA")

    def render(f):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        t = f / max(total - 1, 1)
        alt = alt0 + (alt1 - alt0) * t
        larg = round(base.width * alt / base.height)
        dev = base.resize((larg, round(alt)), Image.LANCZOS)
        op = an.entra_sai(f, total, 14, 16)
        if op < 1.0:
            dev.putalpha(dev.getchannel("A").point(
                lambda v, _o=op: round(v * _o)))
        img.alpha_composite(dev, (x - larg // 2, y - round(alt) // 2))
        return img

    return total, render





def titulo_wave(destino, dur_s):
    """Nome do projeto, para entrar sobre a cidade de ondas da abertura.

    Posicao medida no quadro da IA: a cidade fica em y~555 e a linha de base
    em y~585, entao o nome entra logo abaixo, com a metade de baixo livre.
    """
    total = round(dur_s * FPS)
    tmp = VIDEO / "_tit"
    tmp.mkdir(parents=True, exist_ok=True)
    for q in tmp.glob("*.png"):
        q.unlink()
    f_nome = an.fonte(an.F_NUM, 104)
    f_tag = an.fonte(an.F_TXT, 34)
    for f in range(total):
        img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 20, 10)
        p1 = an.suave(an.janela(f, 2, 26))
        # as duas metades entram deslizando uma para cada lado e se encontram
        wa = f_nome.getbbox("Wave")[2] - f_nome.getbbox("Wave")[0]
        ai = f_nome.getbbox("AI")[2] - f_nome.getbbox("AI")[0]
        meio = (wa + ai) / 2
        desl = (1 - p1) * 70
        an.texto(d, (L // 2 - meio + wa / 2 - desl, 752), "Wave", f_nome,
                 GELO, op * p1)
        an.texto(d, (L // 2 - meio + wa + ai / 2 + desl, 752), "AI", f_nome,
                 TEAL, op * p1)
        p2 = an.suave(an.janela(f, 24, 24))
        if p2 > 0:
            lw = (meio + 26) * p2
            d.line([(L // 2 - lw, 818), (L // 2 + lw, 818)],
                   fill=(*TEAL, round(190 * op * p2)), width=3)
        p3 = an.suave(an.janela(f, 40, 22))
        an.texto(d, (L // 2, 874), "Sua mente em ondas.", f_tag, CINZA,
                 op * p3)
        img.save(tmp / f"{f:05d}.png")
    ff(["-framerate", str(FPS), "-i", str(tmp / "%05d.png"),
        "-c:v", "prores_ks", "-profile:v", "4444",
        "-pix_fmt", "yuva444p10le", str(destino)])
    for q in tmp.glob("*.png"):
        q.unlink()
    tmp.rmdir()
    return total


def fmt_bilhoes(v):
    """2.7 -> 'US$ 2,7'. Virgula decimal, como se fala em portugues."""
    return ("US$ " + f"{v:.1f}").replace(".", ",")


# ------------------------------------------------------------ card do LinkedIn

def card_linkedin(segundos):
    """Cartao final: slogan grande e os tres perfis."""
    pronto = VIDEO / "card.mp4"
    if pronto.exists() and "card" not in REFAZER:
        return pronto
    total = round(segundos * FPS)
    base = _fundo("fundo-onda-cidade")
    pessoas = [
        ("Tiago Bryan Ramos de Oliveira", "linkedin/tiagooriginal.jpeg",
         "in/tiago-bryan-ramos-de-oliveira", (0, 230, 1200, 1430)),
        ("Nickolas Maia de Araujo", "linkedin/nickolas.jpeg",
         "in/nickolas-maia", None),
        ("Gustavo Mendes Ventieri Mariano", "linkedin/gustavo.png",
         "in/gustavo-ventieri", (205, 255, 560, 610)),
    ]
    D = 260
    fotos = []
    for _, rel, _, crop in pessoas:
        im = Image.open(PITCH / rel).convert("RGB")
        if crop:
            im = im.crop(crop)
        else:
            lado = min(im.size)
            im = im.crop(((im.width - lado) // 2, (im.height - lado) // 2,
                          (im.width - lado) // 2 + lado,
                          (im.height - lado) // 2 + lado))
        im = im.resize((D, D), Image.LANCZOS)
        masc = Image.new("L", (D * 4, D * 4), 0)
        ImageDraw.Draw(masc).ellipse([0, 0, D * 4, D * 4], fill=255)
        im.putalpha(masc.resize((D, D), Image.LANCZOS))
        fotos.append(im)

    f_slog = an.cabe("Sua mente em ondas.", an.F_NUM, 76, 1500)
    f_nome = an.fonte(an.F_TXT_B, 26)
    f_in = an.fonte(an.F_TXT, 21)
    cx, gap = L // 2, 420
    tmp = VIDEO / "_card"
    tmp.mkdir(parents=True, exist_ok=True)
    for p in tmp.glob("*.png"):
        p.unlink()
    for f in range(total):
        img = base.copy()
        d = ImageDraw.Draw(img)
        op = an.entra_sai(f, total, 12, 18)
        p1 = an.suave(an.janela(f, 4, 18))
        an.texto(d, (cx, 196 - (1 - p1) * 16), "Sua mente em ondas.",
                 f_slog, GELO, op * p1)
        p2 = an.suave(an.janela(f, 16, 18))
        an.texto(d, (cx, 292 - (1 - p2) * 16), "Seu bem-estar em movimento.",
                 f_slog, TEAL, op * p2)
        p3 = an.suave(an.janela(f, 32, 18))
        an.texto(d, (cx, 452), "CONECTE-SE COM A GENTE NO LINKEDIN",
                 an.fonte(an.F_TXT_B, 34), PALE, op * p3 * 0.95)
        for i, (nome, _, perfil, _) in enumerate(pessoas):
            pp = an.suave(an.janela(f, 48 + i * 10, 18))
            if pp <= 0:
                continue
            x = cx + (i - 1) * gap
            y = 566 + round((1 - pp) * 22)
            anel = Image.new("RGBA", (D + 16, D + 16), (0, 0, 0, 0))
            ImageDraw.Draw(anel).ellipse(
                [0, 0, D + 15, D + 15], outline=(*TEAL, round(210 * op * pp)),
                width=3)
            img.alpha_composite(anel, (x - D // 2 - 8, y - 8))
            foto = fotos[i].copy()
            # default args: sem isso a lambda le op/pp do escopo do laco
            foto.putalpha(foto.getchannel("A").point(
                lambda v, _o=op, _p=pp: round(v * _o * _p)))
            img.alpha_composite(foto, (x - D // 2, y))
            an.texto(d, (x, y + D + 44), nome, f_nome, GELO, op * pp)
            an.texto(d, (x, y + D + 80), perfil, f_in, PALE, op * pp * 0.95)
        img.convert("RGB").save(tmp / f"{f:05d}.png")
    saida = VIDEO / "card.mp4"
    ff(["-framerate", str(FPS), "-i", str(tmp / "%05d.png"),
        "-c:v", "libx264", "-crf", "17", "-preset", "medium",
        "-pix_fmt", "yuv420p", str(saida)])
    for p in tmp.glob("*.png"):
        p.unlink()
    tmp.rmdir()
    return saida


# ------------------------------------------------------------------ bloco 5

def bloco_demo(segundos):
    """As gravacoes de tela, cortadas nos instantes da narracao do Gustavo."""
    pronto = VIDEO / "b5.mp4"
    g = "gustavo__gustavo3"
    off, cortes = 1.65, [(17.53, 19.65)]
    if pronto.exists() and "b5" not in REFAZER:
        return pronto, {}
    marcas = {
        "painel": quando(g, "Este e o painel", off, cortes),
        "conecta": quando(g, "Conecta o aparelho", off, cortes),
        "encerrada": quando(g, "Sessao encerrada", off, cortes),
        "ponto": quando(g, "E aqui esta o ponto", off, cortes),
        "outro": quando(g, "Do outro lado", off, cortes),
    }
    # (fonte, inicio no bloco, fim no bloco, ponto de entrada na fonte)
    cortes_tela = [
        ("demo/login.mp4", 0.0, marcas["painel"] - 0.3, 0.0),
        ("demo/patient_index.mp4", marcas["painel"] - 0.3,
         marcas["conecta"] - 0.3, 0.5),
        ("demo/patient_live (2).mp4", marcas["conecta"] - 0.3,
         marcas["ponto"] - 0.3, 1.0),
        ("demo/patient_history.mp4", marcas["ponto"] - 0.3,
         marcas["outro"] - 0.3, 1.0),
        ("demo/doctor.mp4", marcas["outro"] - 0.3, segundos + XF, 0.8),
    ]
    partes = []
    for i, (rel, ini, fim, entrada) in enumerate(cortes_tela):
        alvo = fim - ini + (XD if i < len(cortes_tela) - 1 else 0)
        fonte = PITCH / rel
        disp = dur(fonte) - entrada
        # se a gravacao e mais curta que o trecho, desacelera o suficiente
        pts = max(1.0, alvo / disp)
        p = VIDEO / f"_demo{i}.mp4"
        ff(["-ss", str(entrada), "-i", str(fonte), "-an",
            "-vf", f"setpts={pts:.4f}*PTS,fps=30,scale=1920:1080,"
                   f"trim=duration={alvo:.3f},setpts=N/FRAME_RATE/TB",
            "-c:v", "libx264", "-crf", "17", "-preset", "medium",
            "-pix_fmt", "yuv420p", str(p)])
        partes.append(p)
    # Dissolucao entre as gravacoes: corte seco entre telas ficava seco demais.
    # Cada trecho foi renderizado com XD a mais, entao o offset de cada
    # transicao e a duracao acumulada SEM a sobreposicao -- a dissolucao come
    # a sobra, nao o conteudo.
    saida = VIDEO / "b5.mp4"
    ent, filtro, atual, acum = [], "", "[0:v]", 0.0
    for p in partes:
        ent += ["-i", str(p)]
    for i in range(1, len(partes)):
        acum += cortes_tela[i - 1][2] - cortes_tela[i - 1][1]
        rot = f"[x{i}]"
        # offset = duracao acumulada SEM descontar XD: o clipe anterior foi
        # renderizado com XD de cauda e a dissolucao come justamente ela.
        filtro += (f"{atual}[{i}:v]xfade=transition=dissolve:duration={XD}:"
                   f"offset={acum:.3f}{rot};")
        atual = rot
    ff([*ent, "-filter_complex", filtro.rstrip(";"), "-map", atual,
        "-c:v", "libx264", "-crf", "17", "-preset", "medium",
        "-pix_fmt", "yuv420p", str(saida)])
    for p in partes:
        p.unlink()
    return saida, marcas


# ----------------------------------------------------------------- montagem

def main():
    VIDEO.mkdir(parents=True, exist_ok=True)
    d = json.loads((AUDIO / "duracoes.json").read_text(encoding="utf-8"))
    N, G, T = "nickolas__nickolas", "gustavo__gustavo", "tiago__"
    partes = []

    def reg(nome, caminho, segundos):
        partes.append((nome, caminho, segundos))
        print(f"  {nome:26s} {segundos:6.2f}s  {caminho.name}", flush=True)

    print("montando blocos:", flush=True)

    # b1 -- abertura de IA. O video tem 32,07 s e a narracao 32,45: o ultimo
    # quadro segura a diferenca, que e menor que meio segundo.
    s = d["b1-tiago-pe-na-porta"]
    p = VIDEO / "b1.mp4"
    if not p.exists() or "b1" in REFAZER:
        tit = VIDEO / "titulo.mov"
        if not tit.exists() or "b1" in REFAZER:
            titulo_wave(tit, s + XF - 28.0)
        bruto = VIDEO / "_b1bruto.mp4"
        ff(["-i", str(PITCH / "00-inicio" / "Video_IA.mp4"), "-an",
            "-vf", "fps=30,scale=1920:1080,"
                   "tpad=stop_mode=clone:stop_duration=3,"
                   "trim=duration=" + f"{s + XF:.3f}" + ",setpts=N/FRAME_RATE/TB",
            "-c:v", "libx264", "-crf", "17", "-preset", "medium",
            "-pix_fmt", "yuv420p", str(bruto)])
        # o nome entra aos 28 s, logo abaixo da cidade de ondas
        ff(["-i", str(bruto), "-i", str(tit), "-filter_complex",
            "[1:v]setpts=PTS+28/TB[t];[0:v][t]overlay=0:0:format=auto",
            "-c:v", "libx264", "-crf", "17", "-preset", "medium",
            "-pix_fmt", "yuv420p", str(p)])
        bruto.unlink()
    reg("b1 abertura", p, s)

    # b2 -- o problema. Cada numero entra na palavra falada, e os vazios
    # medidos entre as falas ganham beat proprio: os primeiros 5,25 s ficavam
    # com voz e tela parada no primeiro corte.
    s = d["b2-nickolas-problema"]
    o = 0.25
    t393 = quando(N, "393 mil", o) - 0.5
    b2 = [
        (0.25, *beat_abertura(["O problema cresceu", "enquanto ninguém media."],
                              t393 - 0.35)),
        (t393, *an.beat_numero(
            393_000, ("afastamentos do INSS por transtornos mentais, em 2025",),
            5.3, formatador=an.formata_mil)),
        (quando(N, "e 79", o) - 0.4, *an.beat_numero(
            79, ("a mais que em 2023 — em dois anos",), 4.3, sufixo="%")),
        # ansiedade e burnout num beat so: sao faladas com 1,64 s de intervalo
        (quando(N, "A ansiedade", o) - 0.35, *beat_barras([
            ("ansiedade", [1, 1.92], ["2023", "2025"], "quase 2x"),
            ("burnout", [1, 3.97], ["2023", "2025"], "3x"),
        ], 4.15)),
        (quando(N, "So em beneficios", o) - 0.2, *an.beat_numero(
            954, ("milhões de reais em benefícios, só no último ano",),
            5.7, sufixo=" mi", tam_num=260)),
        (quando(N, "E desde 26", o) - 0.2, *beat_data(
            "26 · maio · 2026", "a NR-1 passou a exigir",
            ("identificar, avaliar e controlar",
             "o risco psicossocial no PGR"), 11.7)),
        (quando(N, "e fiscalizacao", o) - 0.2, *beat_texto(
            ["fiscalização", "com multa"], 1.85, tam=86, cor=TEAL)),
        (quando(N, "So que apenas", o) - 0.3, *an.beat_grade(
            5, rotulo=("dos RHs se dizem preparados",), dur_s=4.3)),
    ]
    reg("b2 problema", pinta_bloco("b2", s, "fundo-tracado", b2), s)

    # b3a -- a pergunta de virada
    s = d["b3a-nickolas-pergunta"]
    # fundo preto e tela parada: a pergunta-chave fica sozinha, sem concorrencia
    b3a = [(0.5, *beat_texto(["Com o que essas empresas", "vão medir?"],
                             s - 0.7, tam=96, cor=GELO, y=540))]
    reg("b3a pergunta", pinta_bloco("b3a", s, "fundo-preto", b3a, parado=True), s)

    # b3b -- a lacuna: o questionario
    s = d["b3b-gustavo-lacuna"]
    o = 1.05
    t_sinal = quando(G + "1", "Existe um sinal", o)
    t_esc = quando(G + "1", "numa escala", o) - 0.4
    b3b = [
        (0.2, *beat_abertura(["Com o questionário."], t_esc - 0.3, tam=84)),
        (t_esc, *beat_escala(t_sinal - t_esc - 0.25)),
        (t_sinal - 0.3, *beat_texto(
            ["Existe um sinal objetivo.", "Ele só nunca saiu do hospital."],
            s - t_sinal + 0.1, tam=66, cor=TEAL, y=520)),
    ]
    reg("b3b lacuna", pinta_bloco("b3b", s, "fundo-grade", b3b), s)

    # b4 -- a solucao. O aparelho e uma CAMADA a esquerda e o texto corre a
    # direita; centralizar os dois faria um passar por cima do outro.
    s = d["b4-gustavo-solucao"]
    o = 1.00
    CXD, X0D = 1290, 980          # centro e margem do texto deste bloco
    t512 = quando(G + "2", "por segundo", o) - 1.4
    t_nao = quando(G + "2", "nao diagnostica nada", o) - 1.2
    t_prof = quando(G + "2", "um profissional", o) - 0.6
    b4 = [
        (0.3, *beat_abertura(["O WaveAI tira o", "eletroencefalograma",
                              "do hospital."], t512 - 0.4, tam=58)),
        (t512, *an.beat_numero(
            512, ("amostras por segundo,", "no córtex frontal"),
            t_nao - t512 - 0.2, sufixo=" Hz", tam_num=190, cx=CXD, larg=700)),
        (t_nao, *beat_lista("O WaveAI", [("mede", ""), ("registra", ""),
                                         ("mostra a tendência", "")],
                            t_prof - t_nao - 0.2, x0=X0D, larg_max=760)),
        (t_prof, *beat_texto(
            ["quem interpreta é o", "profissional de bem-estar"],
            s - t_prof + 0.1, tam=50, cor=GELO, y=540, cx=CXD, larg=740)),
    ]
    ap = VIDEO / "aparelho.png"
    if not ap.exists():
        print(f"  recortando o aparelho... {recorta_aparelho(ap)}", flush=True)
    aparelho = [(0.3, *beat_aparelho(ap, s - 0.3, 470, 580, 520, 592))]
    p = pinta_bloco("b4", s, "fundo-centro", b4, camadas=aparelho)
    reg("b4 solucao", p, s)

    # b5 -- demonstracao
    s = d["b5-gustavo-demo"]
    p, _ = bloco_demo(s)
    reg("b5 demo", p, s)

    # b6 -- diferenciais
    s = d["b6-tiago-diferenciais"]
    t2 = T + "2-Tiago"
    t_terc = quando(t2, "Terceira", 0.0)
    b6 = [
        (quando(t2, "Primeira", 0.0) - 0.3, *beat_lista(
            "", [("A tela nunca mente",
                  "se a medida saiu ruim, está escrito que saiu ruim")], 11.0)),
        (quando(t2, "Segunda", 0.0) - 0.3, *beat_lista(
            "", [("O dado é do titular",
                  "cifrado, auditado, exclusão imediata")], 8.2)),
        (t_terc - 0.3, *beat_lista(
            "", [("Já está em produção",
                  "três estudantes, custo de nuvem quase zero")],
            s - t_terc + 0.2)),
    ]
    reg("b6 diferenciais", pinta_bloco("b6", s, "fundo-centro", b6), s)

    # b7 -- modelo de negocio
    s = d["b7-nickolas-negocio"]
    o = 50.65
    t_merc = quando(N, "O mercado", o)
    b7 = [
        (quando(N, "Assinante", o) - 1.2, *beat_lista(
            "COMO ISSO VIRA NEGÓCIO",
            [("1 · Profissional de bem-estar",
              "assinatura por paciente acompanhado")], 8.6)),
        (quando(N, "criou uma obrigacao", o) - 2.4, *beat_lista(
            "", [("2 · Empresas · NR-1",
                  "indicador agregado e anônimo, adesão voluntária")], 10.5)),
        (quando(N, "O empregador", o) - 0.5, *beat_texto(
            ["o empregador nunca vê", "o dado de um indivíduo"],
            quando(N, "O motor", o) - quando(N, "O empregador", o) - 0.3,
            tam=62, cor=TEAL, y=520)),
        (quando(N, "O motor", o) - 0.6, *beat_lista(
            "", [("3 · Motor de análise como API",
                  "para quem tem o aparelho e não tem a inteligência")], 6.6)),
        (t_merc - 0.3, *an.beat_numero(
            2.7, ("bilhões de dólares — o mercado de EEG vestível em 2030",),
            s - t_merc + 0.2, formatador=fmt_bilhoes, tam_num=140)),
    ]
    reg("b7 negocio", pinta_bloco("b7", s, "fundo-onda-cidade", b7), s)

    # b8 -- o pedido
    s = d["b8-tiago-pedido"]
    t3 = T + "3-Tiago"
    t_prec = quando(t3, "Precisamos", 0.35)
    b8 = [
        (0.2, *beat_texto(["O que falta não é código.", "É validação."],
                          max(2.5, t_prec - 0.4), tam=72, cor=GELO, y=520)),
        (t_prec - 0.3, *beat_lista(
            "", [("Laboratório com EEG de referência", ""),
                 ("Parecer regulatório", ""),
                 ("Piloto com profissionais reais", "")],
            s - t_prec + 0.2)),
    ]
    reg("b8 pedido", pinta_bloco("b8", s, "fundo-grade", b8), s)

    # b9 -- slogan falado, emendando no card
    s = d["b9-gustavo-slogan"]
    b9 = [(0.0, *beat_texto(["Sua mente em ondas."], s, tam=92, cor=GELO,
                            y=520, fonte=an.F_NUM))]
    reg("b9 slogan", pinta_bloco("b9", s, "fundo-onda-cidade", b9), s)

    # card final -- preenche sem passar de 5:00
    usado = sum(x[2] for x in partes)
    s_card = max(12.0, min(18.0, 294.0 - usado))
    reg("card linkedin", card_linkedin(s_card), s_card)

    # ---- junta o video com transicao entre cada bloco
    # Uma transicao diferente por fronteira, escolhida pelo sentido da virada:
    # `fadeblack` quando a ideia muda de assunto, `circleopen` para revelar o
    # aparelho, `slideleft` para entrar no produto, e assim por diante.
    TRANSICOES = ["fade", "fadeblack", "fadeblack", "circleopen", "slideleft",
                  "wipeleft", "slideup", "fade", "fadeblack", "fade"]
    ent, filtro, atual, acum = [], "", "[0:v]", 0.0
    for _, caminho, _ in partes:
        ent += ["-i", str(caminho)]
    for i in range(1, len(partes)):
        acum += partes[i - 1][2]        # duracao do AUDIO, nao do video
        tr = TRANSICOES[min(i - 1, len(TRANSICOES) - 1)]
        rot = f"[t{i}]"
        # Sem descontar XF: cada bloco tem XF de cauda e a transicao come ela.
        # Descontando, toda transicao mordia 0,6 s de conteudo -- media: o
        # corte final saia 0,6 s curto e a emenda b5->b6 parecia um salto.
        filtro += (f"{atual}[{i}:v]xfade=transition={tr}:duration={XF}:"
                   f"offset={acum:.3f}{rot};")
        atual = rot
    mudo = VIDEO / "_mudo.mp4"
    ff([*ent, "-filter_complex", filtro.rstrip(";"), "-map", atual,
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-pix_fmt", "yuv420p", str(mudo)])

    # ---- junta a narracao na mesma ordem
    ordem = ["b1-tiago-pe-na-porta", "b2-nickolas-problema",
             "b3a-nickolas-pergunta", "b3b-gustavo-lacuna",
             "b4-gustavo-solucao", "b5-gustavo-demo",
             "b6-tiago-diferenciais", "b7-nickolas-negocio",
             "b8-tiago-pedido", "b9-gustavo-slogan"]
    entradas, filtro = [], ""
    for i, nome in enumerate(ordem):
        entradas += ["-i", str(AUDIO / (nome + ".wav"))]
        filtro += "[" + str(i) + ":a]"
    filtro += "concat=n=" + str(len(ordem)) + ":v=0:a=1[fala]"
    fala = VIDEO / "_fala.wav"
    ff([*entradas, "-filter_complex", filtro, "-map", "[fala]",
        "-c:a", "pcm_s16le", str(fala)])

    # A trilha de suspense do video de IA fica por baixo da narracao do bloco
    # 1. Medido: ela esta em -27,1 LUFS e a voz em -16, ou seja ja 11 dB
    # abaixo; -4 dB a mais levam para ~15 dB, que e faixa de leito sonoro.
    amb = VIDEO / "_amb.wav"
    ff(["-i", str(PITCH / "00-inicio" / "Video_IA.mp4"), "-vn",
        "-af", f"volume=-4dB,afade=t=out:st={d['b1-tiago-pe-na-porta'] - 2.2:.2f}"
               ":d=2.2,aformat=sample_rates=48000:channel_layouts=mono",
        "-c:a", "pcm_s16le", str(amb)])
    mix = VIDEO / "_mix.wav"
    ff(["-i", str(fala), "-i", str(amb), "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0:"
        "normalize=0[m]", "-map", "[m]", "-c:a", "pcm_s16le", str(mix)])
    fala.unlink()
    fala = mix
    amb.unlink()

    final = PITCH / "_build" / "pitch-waveai.mp4"
    # -shortest e OBRIGATORIO aqui: `apad` deixa o audio INFINITO (e para isso
    # que ele serve -- completar o silencio ate o fim do video). Sem -shortest
    # o ffmpeg escreve para sempre; medido, o arquivo passou de 87 MB ainda
    # crescendo antes de eu matar o processo.
    ff(["-i", str(mudo), "-i", str(fala), "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k", "-af", "apad", "-shortest",
        str(final)])
    mudo.unlink()
    fala.unlink()
    t = dur(final)
    print("\nFINAL: " + str(final))
    print(f"  {t:.2f}s = {int(t // 60)}:{t % 60:05.2f}   "
          f"{final.stat().st_size // 1024 // 1024} MB")


if __name__ == "__main__":
    main()
