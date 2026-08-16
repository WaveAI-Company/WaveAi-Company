import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";

import { useRoleAccent, useTheme, type Theme } from "../../theme";

export type TrendPoint = {
  value: number;
  /** Rótulo do eixo x (ex.: data da sessão). */
  label: string;
};

type Props = {
  data: TrendPoint[];
  accent?: string;
  height?: number;
  /** Formata os rótulos do eixo y (ex.: fração → porcentagem). */
  formatValue?: (value: number) => string;
  /** Descrição para leitores de tela (o gráfico em si é decorativo). */
  accessibilityLabel?: string;
  /**
   * Suaviza a linha com uma spline (Catmull-Rom) em vez de segmentos retos.
   * Para séries **densas e oscilantes** (o ao vivo), evita o ziguezague; nas
   * tendências por sessão (poucos pontos discretos) fica desligado de propósito.
   */
  smooth?: boolean;
  /** Mostra um ponto por medida. Desligue no ao vivo (denso demais). */
  showDots?: boolean;
};

const PAD_LEFT = 46;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
/** `stroke-width:2.2` do mockup. */
const ESPESSURA = 2.2;
/** `r=3.4`, e `r=4.4` no ponto mais recente — o mockup destaca a última medida. */
const PONTO = 3.4;
const PONTO_ULTIMO = 4.4;
/** Sub-pontos por segmento ao suavizar: mais = curva mais lisa. */
const SUBDIV = 12;
/**
 * Lado do sistema de coordenadas interno do SVG.
 *
 * O desenho vive num quadrado virtual `V × V` que o `preserveAspectRatio="none"`
 * estica até o retângulo do plot — **por isso o componente não mede nada**. O
 * valor em si é arbitrário; 1000 dá resolução de sobra para o `toFixed(2)` dos
 * caminhos.
 */
const V = 1000;
/**
 * Folga vertical dentro do plot, em unidades do quadrado virtual (6%).
 *
 * Sem ela o mínimo e o máximo caem exatamente nas bordas do SVG, que tem
 * `overflow:hidden` — e o traço é **cortado ao meio** nos extremos: a linha
 * tem 2,2px e metade fica fora. Pior com `smooth`: a spline Catmull-Rom
 * ultrapassa os pontos nos picos agudos (medido no ao vivo: 5 pontos em
 * `y = -14,3`, 2,1px além do topo), e é isso que achatava os picos da onda.
 */
const FOLGA_Y = 60;

type Pixel = { px: number; py: number };

/**
 * Densifica a linha com uma spline **Catmull-Rom** (passa pelos pontos, sem
 * inventar picos).
 */
function suavizar(pts: Pixel[], subdiv: number): Pixel[] {
  if (pts.length < 3) return pts;
  const out: Pixel[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, n - 1)];
    for (let s = 0; s < subdiv; s += 1) {
      const u = s / subdiv;
      const u2 = u * u;
      const u3 = u2 * u;
      const eixo = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push({
        px: eixo(p0.px, p1.px, p2.px, p3.px),
        py: eixo(p0.py, p1.py, p2.py, p3.py),
      });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** `M x y L x y …` a partir dos pontos já em pixel. */
function paraCaminho(pts: Pixel[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(2)} ${p.py.toFixed(2)}`)
    .join(" ");
}

/**
 * Tendência de uma medida ao longo das sessões.
 *
 * **Em SVG (pente fino de UI, causa 8).** Foi desenhada com `View`s giradas
 * entre a #17 e agora, quando o `react-native-svg` estava fora do projeto; a
 * **ADR-0042 readotou** a dependência, e a **ADR-0027** já previa SVG
 * exatamente aqui — "onde há geometria real (a linha de tendência)". Com
 * `View`s não havia como pintar a **área sob a curva**, que é o que o mockup
 * faz (`linearGradient` da cor da banda, de `.22` a `0`) e o que fazia o nosso
 * parecer mais pobre lado a lado. De quebra, a linha inteira virou **um**
 * `Path` no lugar de uma `View` por segmento — no ao vivo eram centenas.
 *
 * **E não mede mais a largura, o que o consertou.** Ele dependia de `onLayout`
 * e ficava preso em `width === 0`: o cartão "Tendências rápidas" reservava
 * 180px e não desenhava **nada**. O `WaveField` já registrava a mesma
 * armadilha ("medir com `onLayout` daria 0 na montagem"). Agora a geometria
 * vive num quadrado virtual que o `preserveAspectRatio="none"` estica até o
 * retângulo do plot — a linha e os pontos ficam imunes à distorção por
 * `vectorEffect="non-scaling-stroke"`, e os rótulos seguem como `Text` do RN,
 * fora do SVG, para a fonte não esticar junto.
 *
 * Escala no eixo y é **automática com o mínimo e o máximo rotulados**: sem os
 * rótulos, uma variação minúscula pareceria dramática. A leitura do que a
 * curva significa não é feita aqui — é medida, não veredito (ADR-0027).
 */
export function TrendChart({
  data,
  accent,
  height = 180,
  formatValue,
  accessibilityLabel,
  smooth = false,
  showDots = true,
}: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const cor = accent ?? papel.accent;
  const formatar = formatValue ?? ((v: number) => v.toFixed(2));

  if (data.length === 0) return <View style={[styles.wrapper, { height }]} />;

  const valores = data.map((d) => d.value);
  const bruteMin = Math.min(...valores);
  const bruteMax = Math.max(...valores);
  // Série constante viraria uma divisão por zero; abre uma faixa mínima.
  const mesmoValor = bruteMax - bruteMin < 1e-9;
  const min = mesmoValor ? bruteMin - 0.01 : bruteMin;
  const max = mesmoValor ? bruteMax + 0.01 : bruteMax;

  /** Altura do retângulo do plot, em pixels — só os rótulos precisam dela. */
  const plotH = Math.max(height - PAD_TOP - PAD_BOTTOM, 1);

  // Tudo em coordenadas do quadrado virtual: x pelo índice, y pelo valor.
  const x = (i: number) => (data.length === 1 ? V / 2 : (i / (data.length - 1)) * V);
  const y = (v: number) => V - FOLGA_Y - ((v - min) / (max - min)) * (V - 2 * FOLGA_Y);

  const pontosPixel: Pixel[] = data.map((d, i) => ({ px: x(i), py: y(d.value) }));
  const linha = smooth ? suavizar(pontosPixel, SUBDIV) : pontosPixel;

  const caminho = paraCaminho(linha);
  // A área fecha a linha contra a base do gráfico. Com um ponto só não há
  // polígono a fechar, e o `Path` sairia degenerado.
  const area =
    linha.length > 1
      ? `${caminho} L${linha[linha.length - 1].px.toFixed(2)} ${V} L${linha[0].px.toFixed(2)} ${V} Z`
      : null;

  // Um id por instância: dois gráficos na mesma tela (composição e alfa)
  // compartilhariam o gradiente e o segundo herdaria a cor do primeiro.
  const idGradiente = `trend-${cor.replace(/[^a-zA-Z0-9]/g, "")}-${Math.round(height)}`;

  const descricao =
    accessibilityLabel ??
    `Tendência de ${data.length} sessões, de ${formatar(data[0].value)} em ${data[0].label} a ${formatar(
      data[data.length - 1].value,
    )} em ${data[data.length - 1].label}.`;

  return (
    <View
      style={[styles.wrapper, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={descricao}
    >
      {/* O SVG ocupa exatamente o retângulo do plot; as margens ficam para os
          rótulos, que são texto do RN e não escalam com ele. */}
      <View style={styles.plot} aria-hidden>
        <Svg width="100%" height="100%" viewBox={`0 0 ${V} ${V}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={cor} stopOpacity={0.22} />
              <Stop offset="1" stopColor={cor} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Linhas de base: máximo e mínimo, ambos rotulados. */}
          {[max, min].map((valor) => (
            <Line
              key={`grade-${valor}`}
              x1={0}
              y1={y(valor)}
              x2={V}
              y2={y(valor)}
              stroke={t.colors.border}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {area ? <Path d={area} fill={`url(#${idGradiente})`} /> : null}

          <Path
            d={caminho}
            fill="none"
            stroke={cor}
            strokeWidth={ESPESSURA}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Cada ponto é um segmento de comprimento zero com ponta redonda:
              um `Circle` viraria elipse no eixo esticado, este não. */}
          {showDots
            ? data.map((d, i) => (
                <Line
                  key={`ponto-${d.label}-${i}`}
                  x1={x(i)}
                  y1={y(d.value)}
                  x2={x(i)}
                  y2={y(d.value)}
                  stroke={cor}
                  strokeWidth={(i === data.length - 1 ? PONTO_ULTIMO : PONTO) * 2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}
        </Svg>
      </View>

      {[max, min].map((valor) => (
        <Text
          key={`rotulo-${valor}`}
          style={[styles.rotuloY, { top: PAD_TOP + (y(valor) / V) * plotH - 7 }]}
          numberOfLines={1}
        >
          {formatar(valor)}
        </Text>
      ))}

      {/* Só as pontas do eixo x: mais que isso vira poluição em tela estreita. */}
      <Text style={[styles.rotuloX, styles.rotuloXInicio]} numberOfLines={1}>
        {data[0].label}
      </Text>
      {data.length > 1 ? (
        <Text style={[styles.rotuloX, styles.rotuloXFim]} numberOfLines={1}>
          {data[data.length - 1].label}
        </Text>
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      marginTop: t.spacing.xs,
      position: "relative",
      width: "100%",
    },
    plot: {
      bottom: PAD_BOTTOM,
      left: PAD_LEFT,
      position: "absolute",
      right: PAD_RIGHT,
      top: PAD_TOP,
    },
    rotuloY: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 10.5,
      left: 0,
      position: "absolute",
      textAlign: "right",
      width: PAD_LEFT - 6,
    },
    rotuloX: {
      ...t.typography.caption,
      bottom: 4,
      color: t.colors.textSubtle,
      fontSize: 10.5,
      position: "absolute",
    },
    rotuloXInicio: {
      left: PAD_LEFT,
    },
    rotuloXFim: {
      right: PAD_RIGHT,
    },
  });
