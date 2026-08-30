"""Extrai a geometria do simbolo do PNG aprovado e escreve geometria.json.

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe Design/logos_icones/extrair_geometria.py

Depende so de Pillow — a mesma que a API ja usa para a foto de perfil.
"""
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]

import json
import math
from collections import Counter, deque

from PIL import Image, ImageChops, ImageDraw, ImageFilter

CAMINHO = str(RAIZ / "Design" / "logos_icones" / "logo_escura.png")
SAIDA = str(RAIZ / "Design" / "logos_icones")

LIMIAR = 60
SIMBOLO = (330, 170, 930, 760)
K_ABERTURA = 21
PASSOS_RECONSTRUCAO = 16


def dist2(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def mascara(im, fundo, limiar=LIMIAR):
    w, h = im.size
    px = im.load()
    m = Image.new("L", (w, h), 0)
    mp = m.load()
    lim2 = limiar * limiar
    for y in range(h):
        for x in range(w):
            if dist2(px[x, y], fundo) >= lim2:
                mp[x, y] = 255
    return m


def componentes(m, minimo=200):
    w, h = m.size
    px = m.load()
    vis = bytearray(w * h)
    out = []
    for s in range(w * h):
        if px[s % w, s // w] and not vis[s]:
            q = deque([s])
            vis[s] = 1
            pix = []
            while q:
                i = q.popleft()
                x, y = i % w, i // w
                pix.append((x, y))
                for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, y > 0), (i + w, y < h - 1)):
                    if ok and px[j % w, j // w] and not vis[j]:
                        vis[j] = 1
                        q.append(j)
            if len(pix) >= minimo:
                out.append(pix)
    out.sort(key=len, reverse=True)
    return out


def de_pixels(pix, size):
    m = Image.new("L", size, 0)
    p = m.load()
    for x, y in pix:
        p[x, y] = 255
    return m


def reconstruir(marcador, limite, passos):
    """Dilata o marcador dentro de `limite`. Recupera a forma sem vazar longe."""
    cur = marcador
    for _ in range(passos):
        cur = ImageChops.multiply(cur.filter(ImageFilter.MaxFilter(3)), limite)
    return cur


def ajustar_circulo(pts):
    n = len(pts)
    sx = sy = sxx = syy = sxy = sxxx = syyy = sxyy = sxxy = 0.0
    for x, y in pts:
        sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y
        sxxx += x * x * x; syyy += y * y * y; sxyy += x * y * y; sxxy += x * x * y
    c11 = 2 * (sx * sx - n * sxx); c12 = 2 * (sx * sy - n * sxy); c22 = 2 * (sy * sy - n * syy)
    r1 = sx * (sxx + syy) - n * (sxxx + sxyy)
    r2 = sy * (sxx + syy) - n * (sxxy + syyy)
    det = c11 * c22 - c12 * c12
    cx = (r1 * c22 - r2 * c12) / det
    cy = (c11 * r2 - c12 * r1) / det
    r = math.sqrt(sum((x - cx) ** 2 + (y - cy) ** 2 for x, y in pts) / n)
    return cx, cy, r


VIZ = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]


def contorno(m):
    w, h = m.size
    px = m.load()
    inicio = None
    for y in range(h):
        for x in range(w):
            if px[x, y]:
                inicio = (x, y); break
        if inicio:
            break
    if not inicio:
        return []
    borda = [inicio]; atual = inicio; d = 0
    for _ in range(8 * w * h):
        achou = False
        for k in range(8):
            di = (d + 6 + k) % 8
            dx, dy = VIZ[di]
            nx, ny = atual[0] + dx, atual[1] + dy
            if 0 <= nx < w and 0 <= ny < h and px[nx, ny]:
                atual = (nx, ny); d = di; borda.append(atual); achou = True; break
        if not achou:
            break
        if atual == inicio and len(borda) > 2:
            break
    return borda[:-1]


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    pilha = [(0, len(pts) - 1)]
    manter = [False] * len(pts)
    manter[0] = manter[-1] = True
    while pilha:
        i, j = pilha.pop()
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1.0
        pior, idx = 0.0, -1
        for k in range(i + 1, j):
            X, Y = pts[k]
            d = abs(dy * X - dx * Y + bx * ay - by * ax) / norm
            if d > pior:
                pior, idx = d, k
        if pior > eps and idx > 0:
            manter[idx] = True
            pilha.append((i, idx)); pilha.append((idx, j))
    return [p for p, mk in zip(pts, manter) if mk]


def para_bezier(pts, T):
    n = len(pts)
    d = [f"M {T(*pts[0])[0]} {T(*pts[0])[1]}"]
    for i in range(n):
        p0 = pts[(i - 1) % n]; p1 = pts[i]; p2 = pts[(i + 1) % n]; p3 = pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        a = T(*c1); b = T(*c2); c = T(*p2)
        d.append(f"C {a[0]} {a[1]} {b[0]} {b[1]} {c[0]} {c[1]}")
    d.append("Z")
    return " ".join(d)


# ================= execucao =================
im = Image.open(CAMINHO).convert("RGB")
fundo = Counter(im.getdata()).most_common(1)[0][0]
m = mascara(im.crop(SIMBOLO), fundo)
W, H = m.size

ab = m.filter(ImageFilter.MinFilter(K_ABERTURA)).filter(ImageFilter.MaxFilter(K_ABERTURA))
marcadores = componentes(ab, minimo=400)
print(f"marcadores: {[len(c) for c in marcadores]}")

onda = reconstruir(de_pixels(marcadores[0], (W, H)), m, PASSOS_RECONSTRUCAO)
ponto = reconstruir(de_pixels(marcadores[1], (W, H)), m, PASSOS_RECONSTRUCAO)
onda_pix = componentes(onda, minimo=2000)[0]
ponto_pix = componentes(ponto, minimo=400)[0]
print(f"onda reconstruida: {len(onda_pix)}px (marcador tinha {len(marcadores[0])}px, "
      f"+{len(onda_pix) / len(marcadores[0]) - 1:.1%})")

anel_m = ImageChops.subtract(m, ImageChops.lighter(onda, ponto))
anel_comps = componentes(anel_m, minimo=1500)
anel_pix = [p for c in anel_comps for p in c]
print(f"anel: {len(anel_pix)}px em {len(anel_comps)} arcos {[len(c) for c in anel_comps]}")

cx, cy, R = ajustar_circulo(anel_pix)
desv = sorted(abs(math.hypot(x - cx, y - cy) - R) for x, y in anel_pix)
p50, p90 = desv[len(desv) // 2], desv[int(len(desv) * 0.9)]
# espessura pela AREA do anel, nao pelo desvio: area = comprimento do arco x espessura
graus = [0] * 360
for x, y in anel_pix:
    graus[int(math.degrees(math.atan2(y - cy, x - cx)) % 360)] += 1
cobertos = sum(1 for g in graus if g > 0)
comprimento = 2 * math.pi * R * cobertos / 360
espessura = len(anel_pix) / comprimento
print(f"circulo: centro=({cx:.1f},{cy:.1f}) R={R:.1f} | desvio p50={p50:.1f} p90={p90:.1f}")
print(f"  cobertura {cobertos}/360 graus -> espessura por area = {espessura:.1f}px "
      f"({espessura / im.size[0]:.2%} da arte)")

vaos, g = [], 0
while g < 360:
    if graus[g] == 0:
        ini = g
        while g < 360 and graus[g] == 0:
            g += 1
        if g - ini >= 5:
            vaos.append((ini, g - 1))
    else:
        g += 1
print(f"  vaos: {vaos}")

b = contorno(de_pixels(onda_pix, (W, H)))
for eps in (0.6, 1.0, 1.5, 2.0):
    print(f"  RDP eps={eps}: {len(rdp(b, eps))} pontos (bruto {len(b)})")
onda_simpl = rdp(b, 1.0)

pcx = sum(p[0] for p in ponto_pix) / len(ponto_pix)
pcy = sum(p[1] for p in ponto_pix) / len(ponto_pix)
praio = math.sqrt(len(ponto_pix) / math.pi)

# --- normalizacao ---
# DUAS normalizacoes, nao uma. Enquadrar tudo pelo bbox da marca completa e
# depois esconder o anel deixa a onda fora do centro — foi o que estragou a
# primeira leva de PNGs. Cada forma se enquadra no proprio bbox.
VB, MARGEM = 512.0, 24.0


def enquadrar(pix):
    x0 = min(p[0] for p in pix); x1 = max(p[0] for p in pix)
    y0 = min(p[1] for p in pix); y1 = max(p[1] for p in pix)
    lado = max(x1 - x0, y1 - y0)
    esc = (VB - 2 * MARGEM) / lado
    offx = MARGEM - x0 * esc + (lado - (x1 - x0)) * esc / 2
    offy = MARGEM - y0 * esc + (lado - (y1 - y0)) * esc / 2
    return (lambda x, y: (round(x * esc + offx, 2), round(y * esc + offy, 2)),
            esc, (x0, y0, x1, y1))


T, esc, bbox_completa = enquadrar(anel_pix + onda_pix + ponto_pix)
T2, esc2, bbox_reduzida = enquadrar(onda_pix + ponto_pix)
x0, y0, x1, y1 = bbox_completa
print(f"enquadramento completo: bbox={bbox_completa} escala={esc:.4f}")
print(f"enquadramento reduzido: bbox={bbox_reduzida} escala={esc2:.4f}")

arcos_ang = []
if vaos:
    for i, (_, fim) in enumerate(vaos):
        arcos_ang.append((fim + 1, vaos[(i + 1) % len(vaos)][0] - 1))
else:
    arcos_ang = [(0, 359)]


def arco_svg(a, b_):
    xi, yi = T(cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a)))
    xf, yf = T(cx + R * math.cos(math.radians(b_)), cy + R * math.sin(math.radians(b_)))
    grande = 1 if (b_ - a) % 360 > 180 else 0
    return f"M {xi} {yi} A {round(R * esc, 2)} {round(R * esc, 2)} 0 {grande} 1 {xf} {yf}"


# O anel tem espessura VARIAVEL (traco caligrafico, como a onda): modelado como
# arco de stroke uniforme ele rendeu IoU 65%. Tracado como contorno preenchido,
# igual a onda, a forma passa a ser a do desenho. Perde-se a espessura como
# parametro — irrelevante, porque o simbolo reduzido nao leva o anel.
arcos_path = []
for c in anel_comps:
    bc = contorno(de_pixels(c, (W, H)))
    arcos_path.append(para_bezier(rdp(bc, 1.0), T))
print(f"anel tracado: {len(arcos_path)} contornos, "
      f"{[len(rdp(contorno(de_pixels(c, (W, H))), 1.0)) for c in anel_comps]} pontos")

geo = {
    "viewBox": VB,
    "onda": para_bezier(onda_simpl, T),
    "anel": {
        "paths": arcos_path,
        "r_ajustado": round(R * esc, 2), "espessura_media": round(espessura * esc, 2),
        "arcos_parametricos": [arco_svg(a, b_) for a, b_ in arcos_ang],
    },
    "ponto": {"cx": T(pcx, pcy)[0], "cy": T(pcx, pcy)[1], "r": round(praio * esc, 2)},
    "bbox_original": [x0, y0, x1, y1],
    # o simbolo reduzido tem enquadramento PROPRIO — centrado no seu bbox
    "reduzida": {
        "onda": para_bezier(onda_simpl, T2),
        "ponto": {"cx": T2(pcx, pcy)[0], "cy": T2(pcx, pcy)[1], "r": round(praio * esc2, 2)},
    },
    # poligonos normalizados: e deles que os PNGs sao rasterizados (Pillow desenha
    # poligono, nao Bezier). Sao os MESMOS pontos que geraram os paths do SVG.
    "poligonos": {
        "onda": [list(T(x, y)) for x, y in onda_simpl],
        "anel": [
            [list(T(x, y)) for x, y in rdp(contorno(de_pixels(c, (W, H))), 1.0)]
            for c in anel_comps
        ],
        "onda_reduzida": [list(T2(x, y)) for x, y in onda_simpl],
    },
}
with open(SAIDA + r"\geometria.json", "w", encoding="utf8") as f:
    json.dump(geo, f, indent=1)
print(f"\nnormalizado: ponto r={geo['ponto']['r']} | onda {len(geo['onda'])} chars | "
      f"anel {sum(len(p) for p in arcos_path)} chars")

# ---------------- conferencia, peca por peca ----------------
def iou(a, b_):
    da, db = list(a.getdata()), list(b_.getdata())
    i = sum(1 for x, y in zip(da, db) if x and y)
    u = sum(1 for x, y in zip(da, db) if x or y)
    return i / u if u else 0.0


# onda: poligono simplificado vs onda reconstruida
cf = Image.new("L", (W, H), 0)
ImageDraw.Draw(cf).polygon(onda_simpl, fill=255)
print("\n-- fidelidade por peca --")
print(f"  onda  (poligono RDP vs onda extraida): IoU {iou(cf, de_pixels(onda_pix, (W, H))):.1%}")

# anel: os contornos tracados, preenchidos
ca = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(ca)
for c in anel_comps:
    d.polygon(rdp(contorno(de_pixels(c, (W, H))), 1.0), fill=255)
print(f"  anel  (contorno tracado vs anel extraido): IoU {iou(ca, anel_m):.1%}")

# e o que o arco parametrico teria dado, para registro
cpar = Image.new("L", (W, H), 0)
dp = ImageDraw.Draw(cpar)
rr = R + espessura / 2
for a, b_ in arcos_ang:
    dp.arc([cx - rr, cy - rr, cx + rr, cy + rr], a, b_, fill=255, width=int(round(espessura)))
print(f"  anel  (arco parametrico, descartado):      IoU {iou(cpar, anel_m):.1%}")

cp = Image.new("L", (W, H), 0)
ImageDraw.Draw(cp).ellipse([pcx - praio, pcy - praio, pcx + praio, pcy + praio], fill=255)
print(f"  ponto (circulo vs ponto extraido):      IoU {iou(cp, de_pixels(ponto_pix, (W, H))):.1%}")

total = ImageChops.lighter(ImageChops.lighter(cf, ca), cp)
print(f"  TOTAL (tudo vs mascara original):       IoU {iou(total, m):.1%}")
total.save(SAIDA + r"\confere.png")
m.save(SAIDA + r"\mascara.png")
