import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

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
const ESPESSURA = 2;
const PONTO = 7;
/** Sub-pontos por segmento ao suavizar: mais = curva mais lisa, mais Views. */
const SUBDIV = 12;

type Pixel = { px: number; py: number };

/**
 * Densifica a linha com uma spline **Catmull-Rom** (passa pelos pontos, sem
 * inventar picos). Trabalha em pixels e devolve muitos sub-pontos; os segmentos
 * retos entre eles ficam curtos o bastante para a linha parecer uma onda — sem
 * SVG, mantendo a abordagem de `View`s girados.
 */
function suavizar(pts: Pixel[], subdiv: number): Pixel[] {
  if (pts.length < 3) return pts;
  const out: Pixel[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    for (let s = 0; s < subdiv; s += 1) {
      const tt = s / subdiv;
      const t2 = tt * tt;
      const t3 = t2 * tt;
      const eixo = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({
        px: eixo(p0.px, p1.px, p2.px, p3.px),
        py: eixo(p0.py, p1.py, p2.py, p3.py),
      });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/**
 * Linha de tendência ao longo das sessões.
 *
 * Desenhada com `View`s, **sem dependência nativa** (ADR-0027, revisada): cada
 * segmento é um retângulo fino rotacionado entre dois pontos. Um gráfico de
 * linha simples não justifica arrastar um módulo nativo — que precisa ser
 * recompilado no app a cada mudança e virou impedimento concreto de build.
 *
 * Escala no eixo y é **automática com o mínimo e o máximo rotulados**: sem os
 * rótulos, uma variação minúscula pareceria dramática. A leitura do que a
 * curva significa não é feita aqui — é medida, não veredito.
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
  const [width, setWidth] = useState(0);

  const cor = accent ?? papel.accent;
  const aoMedir = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const formatar = formatValue ?? ((v: number) => v.toFixed(2));

  // Só desenha depois de medir a largura (o app roda em telas muito diferentes).
  const pronto = width > 0 && data.length > 0;
  if (!pronto) {
    return <View style={[styles.wrapper, { height }]} onLayout={aoMedir} />;
  }

  const valores = data.map((d) => d.value);
  const bruteMin = Math.min(...valores);
  const bruteMax = Math.max(...valores);
  // Série constante viraria uma divisão por zero; abre uma faixa mínima.
  const mesmoValor = bruteMax - bruteMin < 1e-9;
  const min = mesmoValor ? bruteMin - 0.01 : bruteMin;
  const max = mesmoValor ? bruteMax + 0.01 : bruteMax;

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotH = Math.max(height - PAD_TOP - PAD_BOTTOM, 1);

  const x = (i: number) =>
    PAD_LEFT + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

  // Pontos em pixel; quando `smooth`, a spline densifica antes de virar
  // segmentos, então cada retângulo fica curto e a linha parece uma onda.
  const pontosPixel: Pixel[] = data.map((d, i) => ({ px: x(i), py: y(d.value) }));
  const linha = smooth ? suavizar(pontosPixel, SUBDIV) : pontosPixel;

  // Um retângulo por segmento: posicionado no ponto médio e girado para ligar
  // os extremos. Rotação em RN é em torno do centro, então centralizar o
  // retângulo no meio do segmento faz as pontas caírem exatamente nos pontos.
  const segmentos = linha.slice(1).map((p2, i) => {
    const { px: x1, py: y1 } = linha[i];
    const { px: x2, py: y2 } = p2;
    const comprimento = Math.hypot(x2 - x1, y2 - y1);
    const angulo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return {
      chave: `seg-${i}`,
      // +0,5 no comprimento fecha micro-frestas entre sub-segmentos girados.
      left: (x1 + x2) / 2 - (comprimento + 0.5) / 2,
      top: (y1 + y2) / 2 - ESPESSURA / 2,
      width: comprimento + 0.5,
      angulo,
    };
  });

  const descricao =
    accessibilityLabel ??
    `Tendência de ${data.length} sessões, de ${formatar(data[0].value)} em ${data[0].label} a ${formatar(
      data[data.length - 1].value,
    )} em ${data[data.length - 1].label}.`;

  return (
    <View
      style={[styles.wrapper, { height }]}
      onLayout={aoMedir}
      accessible
      accessibilityRole="image"
      accessibilityLabel={descricao}
    >
      {/* Linhas de base: máximo e mínimo, ambos rotulados. */}
      {[max, min].map((valor) => (
        <View
          key={`grade-${valor}`}
          style={[styles.grade, { left: PAD_LEFT, top: y(valor), width: plotW }]}
        />
      ))}
      {[max, min].map((valor) => (
        <Text
          key={`rotulo-${valor}`}
          style={[styles.rotuloY, { top: y(valor) - 8, width: PAD_LEFT - 6 }]}
          numberOfLines={1}
        >
          {formatar(valor)}
        </Text>
      ))}

      {segmentos.map((s) => (
        <View
          key={s.chave}
          style={[
            styles.segmento,
            {
              left: s.left,
              top: s.top,
              width: s.width,
              backgroundColor: cor,
              transform: [{ rotate: `${s.angulo}deg` }],
            },
          ]}
        />
      ))}

      {showDots
        ? data.map((d, i) => (
            <View
              key={`ponto-${d.label}-${i}`}
              style={[
                styles.ponto,
                { left: x(i) - PONTO / 2, top: y(d.value) - PONTO / 2, backgroundColor: cor },
              ]}
            />
          ))
        : null}

      {/* Só as pontas do eixo x: mais que isso vira poluição em tela estreita. */}
      <Text style={[styles.rotuloX, { left: PAD_LEFT }]} numberOfLines={1}>
        {data[0].label}
      </Text>
      {data.length > 1 ? (
        <Text
          style={[styles.rotuloX, styles.rotuloXFim, { width: plotW, left: PAD_LEFT }]}
          numberOfLines={1}
        >
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
    grade: {
      backgroundColor: t.colors.border,
      height: 1,
      position: "absolute",
    },
    rotuloY: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
      left: 0,
      position: "absolute",
      textAlign: "right",
    },
    segmento: {
      borderRadius: ESPESSURA / 2,
      height: ESPESSURA,
      position: "absolute",
    },
    ponto: {
      borderRadius: PONTO / 2,
      height: PONTO,
      position: "absolute",
      width: PONTO,
    },
    rotuloX: {
      ...t.typography.caption,
      bottom: 4,
      color: t.colors.textMuted,
      fontSize: 11,
      position: "absolute",
    },
    rotuloXFim: {
      textAlign: "right",
    },
  });
