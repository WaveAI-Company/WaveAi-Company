"""Gera os assets de marca de apps/wave-app a partir de geometria.json.

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe Design/logos_icones/gerar_assets.py

Depende so de Pillow — a mesma que a API ja usa para a foto de perfil.
"""
import json
import math
import os
import pathlib

from PIL import Image, ImageDraw

RAIZ = pathlib.Path(__file__).resolve().parents[2]

DEST = str(RAIZ / "apps" / "wave-app" / "assets")
GEO = str(RAIZ / "Design" / "logos_icones" / "geometria.json")

A1, A2 = "#4FD1C5", "#7AA2F7"   # accentPatient -> accentDoctor (tema escuro)
TINTA = "#0B1220"               # onAccent (dark)
SS = 4
RAIO_SEGURO = 0.33              # metade dos 66% da zona segura do adaptive icon

G = json.load(open(GEO, encoding="utf8"))
VB = G["viewBox"]


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def razao(a, b):
    l1, l2 = sorted((lum(rgb(a)), lum(rgb(b))), reverse=True)
    return round((l1 + 0.05) / (l2 + 0.05), 2)


def gradiente(lado, c1, c2):
    im = Image.new("RGB", (lado, lado))
    p = im.load()
    a, b = rgb(c1), rgb(c2)
    for y in range(lado):
        for x in range(lado):
            t = (x + y) / (2 * (lado - 1))
            p[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return im


def amostrar_path(d, n=24):
    """Converte 'M x y C ... Z' na polilinha densa que a curva descreve.

    Rasterizar do POLIGONO enquanto o SVG desenha as BEZIERS faz PNG e SVG serem
    dois desenhos diferentes — e o corte reto que sobrou nas pontas da onda
    aparecia so no PNG. Aqui os dois saem da mesma curva.
    """
    t = d.replace(",", " ").split()
    pts, i, atual = [], 0, (0.0, 0.0)
    while i < len(t):
        c = t[i]
        if c == "M":
            atual = (float(t[i + 1]), float(t[i + 2]))
            pts.append(atual)
            i += 3
        elif c == "C":
            p0 = atual
            p1 = (float(t[i + 1]), float(t[i + 2]))
            p2 = (float(t[i + 3]), float(t[i + 4]))
            p3 = (float(t[i + 5]), float(t[i + 6]))
            for s in range(1, n + 1):
                u = s / n
                v = 1 - u
                pts.append((
                    v**3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u**3 * p3[0],
                    v**3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u**3 * p3[1],
                ))
            atual = p3
            i += 7
        else:
            i += 1
    return pts


def mascara(lado, completa, zona):
    m = Image.new("L", (lado, lado), 0)
    d = ImageDraw.Draw(m)
    k = lado / VB * zona
    off = lado * (1 - zona) / 2
    def tr(p):
        return (p[0] * k + off, p[1] * k + off)

    if completa:
        for anel in G["anel"]["paths"]:
            d.polygon([tr(p) for p in amostrar_path(anel)], fill=255)
        onda, pt = G["onda"], G["ponto"]
    else:
        onda, pt = G["reduzida"]["onda"], G["reduzida"]["ponto"]
    d.polygon([tr(p) for p in amostrar_path(onda)], fill=255)
    cx, cy, r = pt["cx"] * k + off, pt["cy"] * k + off, pt["r"] * k
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return m


def vazamento(zona, completa=False, lado=512):
    """Fracao da arte que cai fora do circulo seguro do icone adaptativo."""
    m = mascara(lado, completa, zona)
    px = m.load()
    c, r = lado / 2, lado * RAIO_SEGURO
    dentro = fora = 0
    for y in range(lado):
        for x in range(lado):
            if px[x, y]:
                if math.hypot(x - c, y - c) <= r:
                    dentro += 1
                else:
                    fora += 1
    return fora / (dentro + fora) if dentro + fora else 0.0


def ladrilho(lado, completa=False, zona=0.76):
    L = lado * SS
    out = Image.composite(
        Image.new("RGB", (L, L), rgb(TINTA)), gradiente(L, A1, A2), mascara(L, completa, zona)
    )
    return out.resize((lado, lado), Image.LANCZOS)


def recorte(lado, cor, completa=False, zona=0.58):
    L = lado * SS
    out = Image.new("RGBA", (L, L), (*rgb(cor), 255))
    out.putalpha(mascara(L, completa, zona))
    return out.resize((lado, lado), Image.LANCZOS)


def recorte_gradiente(lado, c1, c2, completa=False, zona=0.92):
    """Arte com o gradiente e fundo TRANSPARENTE — o formato de uso livre.

    E o que serve para redes sociais e material: a marca se apoia no fundo de
    quem a usa, em vez de carregar um retangulo proprio.
    """
    L = lado * SS
    out = gradiente(L, c1, c2).convert("RGBA")
    out.putalpha(mascara(L, completa, zona))
    return out.resize((lado, lado), Image.LANCZOS)


# ---------------- SVG (a fonte) ----------------
def svg(completa, c1=None, c2=None):
    c1 = c1 or A1
    c2 = c2 or A2
    onda = G["onda"] if completa else G["reduzida"]["onda"]
    pt = G["ponto"] if completa else G["reduzida"]["ponto"]
    corpo = ""
    if completa:
        for d in G["anel"]["paths"]:
            corpo += f'  <path d="{d}" fill="url(#marca)"/>\n'
    corpo += f'  <path d="{onda}" fill="url(#marca)"/>\n'
    corpo += f'  <circle cx="{pt["cx"]}" cy="{pt["cy"]}" r="{pt["r"]}" fill="url(#marca)"/>\n'
    nome = "marca completa (anel + onda + ponto)" if completa else "simbolo reduzido (onda + ponto)"
    uso = (
        "Usada onde ha espaco: hero do site, ficha da loja, material."
        if completa
        else "Usada na interface: header, rail, favicon, icone do app.\n       O anel sai de\n"
        "       proposito — seu traco tem 1,7% da largura da arte e some abaixo de ~48px."
    )
    return (
        f'<svg width="{int(VB)}" height="{int(VB)}" viewBox="0 0 {int(VB)} {int(VB)}"\n'
        f'     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="WaveAI">\n'
        f"  <!-- WaveAI — {nome}.\n"
        f"       {uso}\n\n"
        f"       FONTE DE VERDADE: os PNGs de icone e favicon sao gerados daqui, nao\n"
        f"       desenhados a parte. Gradiente = accentPatient -> accentDoctor do tema\n"
        f"       escuro (src/theme/tokens.ts): a marca atravessa os dois papeis do\n"
        f"       produto sem escolher um lado. -->\n"
        f'  <defs>\n'
        f'    <linearGradient id="marca" x1="0" y1="0" x2="1" y2="1">\n'
        f'      <stop offset="0" stop-color="{c1}"/>\n'
        f'      <stop offset="1" stop-color="{c2}"/>\n'
        f"    </linearGradient>\n"
        f"  </defs>\n{corpo}</svg>\n"
    )


# ---------------- zona segura: escolher medindo ----------------
print("vazamento da zona segura (66%) por tamanho da arte reduzida:")
escolhida = None
for z in (0.72, 0.66, 0.62, 0.58, 0.54, 0.50):
    v = vazamento(z)
    marca = ""
    if escolhida is None and v <= 0.002:
        escolhida = z
        marca = "  <- escolhida"
    print(f"  zona {z:.2f}: {v:.2%} da arte fora do circulo seguro{marca}")
ZONA_ADAPT = escolhida or 0.50
print(f"\nzona do adaptive icon: {ZONA_ADAPT:.2f}")

os.makedirs(DEST, exist_ok=True)
open(os.path.join(DEST, "logo.svg"), "w", encoding="utf8").write(svg(True))
open(os.path.join(DEST, "logo-simbolo.svg"), "w", encoding="utf8").write(svg(False))
print("\nSVG: logo.svg (completa) + logo-simbolo.svg (reduzida)")

saidas = [
    ("icon.png", ladrilho(1024, zona=0.76), "app.json:9 — icone iOS/geral, opaco"),
    ("favicon.png", ladrilho(256, zona=0.80), "app.json:30 — aba do navegador"),
    ("android-icon-foreground.png", recorte(432, TINTA, zona=ZONA_ADAPT), "app.json:17 — frente"),
    ("android-icon-background.png",
     gradiente(432 * SS, A1, A2).resize((432, 432), Image.LANCZOS), "app.json:18 — fundo"),
    ("android-icon-monochrome.png", recorte(432, "#FFFFFF", zona=ZONA_ADAPT),
     "app.json:19 — Material You"),
]
for nome, img, nota in saidas:
    caminho = os.path.join(DEST, nome)
    antes = os.path.getsize(caminho) if os.path.exists(caminho) else 0
    img.save(caminho, optimize=True)
    depois = os.path.getsize(caminho) / 1024
    print(f"  {nome:<30} {img.size[0]}x{img.size[1]}  "
          f"{antes / 1024:>6.1f} -> {depois:.1f} KB   {nota}")

print("\ncontraste da arte sobre as pontas do gradiente (WCAG 1.4.11: 3:1 para nao-texto):")
print(f"  {TINTA} sobre {A1} (accentPatient): {razao(TINTA, A1)}:1")
print(f"  {TINTA} sobre {A2} (accentDoctor):  {razao(TINTA, A2)}:1")

# ---------------- kit para uso fora do app ----------------
# Redes sociais, apresentacao, material impresso. Sai do MESMO vetor que o app
# usa — nao ha uma segunda arte que possa divergir com o tempo.
#
# Dois pares de cor, porque o gradiente do projeto tem dois: o par CLARO
# (accentPatient/accentDoctor do tema escuro) foi feito para pousar em fundo
# escuro, e o par ESCURO (os do tema claro) para pousar em fundo claro. Usar o
# errado e o que deixava a marca apagada no painel de autenticacao.
KIT = str(RAIZ / "Design" / "logos_icones" / "kit")
CLARO = ("#4FD1C5", "#7AA2F7")   # para FUNDO ESCURO
ESCURO = ("#0F7A70", "#2A5BC7")  # para FUNDO CLARO
os.makedirs(KIT, exist_ok=True)

print("\n-- kit (Design/logos_icones/kit) --")
kit_saidas = []
for nome_forma, completa in (("completa", True), ("simbolo", False)):
    for nome_par, (c1, c2) in (("p-fundo-escuro", CLARO), ("p-fundo-claro", ESCURO)):
        base = f"waveai-{nome_forma}-{nome_par}"
        for lado in (512, 1024, 2048):
            img = recorte_gradiente(lado, c1, c2, completa=completa)
            cam = os.path.join(KIT, f"{base}-{lado}.png")
            img.save(cam, optimize=True)
            kit_saidas.append((f"{base}-{lado}.png", os.path.getsize(cam)))
        cam = os.path.join(KIT, f"{base}.svg")
        open(cam, "w", encoding="utf8").write(svg(completa, c1, c2))
        kit_saidas.append((f"{base}.svg", os.path.getsize(cam)))

# Avatar de rede social: ladrilho cheio, porque um PNG transparente vira marca
# invisivel quando a plataforma poe fundo branco por baixo.
for nome_forma, completa, zona in (("completa", True, 0.80), ("simbolo", False, 0.72)):
    for lado in (512, 1024):
        img = ladrilho(lado, completa=completa, zona=zona)
        cam = os.path.join(KIT, f"waveai-avatar-{nome_forma}-{lado}.png")
        img.save(cam, optimize=True)
        kit_saidas.append((f"waveai-avatar-{nome_forma}-{lado}.png", os.path.getsize(cam)))

for nome, tam in kit_saidas:
    print(f"  {nome:<42} {tam / 1024:>7.1f} KB")
print(f"  ({len(kit_saidas)} arquivos)")
