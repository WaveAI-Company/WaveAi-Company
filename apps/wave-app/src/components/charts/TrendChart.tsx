import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

import { colors, spacing } from "../../theme";

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
};

const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

/**
 * Linha de tendência ao longo das sessões.
 *
 * Escala no eixo y é **automática com o mínimo e o máximo rotulados**: sem os
 * rótulos, uma variação minúscula pareceria dramática. A leitura do que a
 * curva significa não é feita aqui — é medida, não veredito.
 */
export function TrendChart({ data, accent = colors.patient, height = 180, formatValue }: Props) {
  const [width, setWidth] = useState(0);

  const aoMedir = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const formatar = formatValue ?? ((v: number) => v.toFixed(2));

  // Só desenha depois de medir a largura (o app roda em telas muito diferentes).
  const pronto = width > 0 && data.length > 0;

  const valores = data.map((d) => d.value);
  const bruteMin = pronto ? Math.min(...valores) : 0;
  const bruteMax = pronto ? Math.max(...valores) : 0;
  // Série constante viraria uma divisão por zero; abre uma faixa mínima.
  const mesmoValor = bruteMax - bruteMin < 1e-9;
  const min = mesmoValor ? bruteMin - 0.01 : bruteMin;
  const max = mesmoValor ? bruteMax + 0.01 : bruteMax;

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotH = Math.max(height - PAD_TOP - PAD_BOTTOM, 1);

  const x = (i: number) =>
    PAD_LEFT + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

  const pontos = pronto ? data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ") : "";

  return (
    <View style={styles.wrapper} onLayout={aoMedir}>
      {pronto ? (
        <Svg width={width} height={height}>
          {/* Linhas de base: máximo e mínimo, ambos rotulados. */}
          {[max, min].map((valor) => (
            <Line
              key={`grade-${valor}`}
              x1={PAD_LEFT}
              y1={y(valor)}
              x2={PAD_LEFT + plotW}
              y2={y(valor)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {[max, min].map((valor) => (
            <SvgText
              key={`rotulo-${valor}`}
              x={PAD_LEFT - 6}
              y={y(valor) + 4}
              fill={colors.textMuted}
              fontSize={11}
              textAnchor="end"
            >
              {formatar(valor)}
            </SvgText>
          ))}

          {data.length > 1 ? (
            <Polyline
              points={pontos}
              fill="none"
              stroke={accent}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {data.map((d, i) => (
            <Circle
              key={`ponto-${d.label}-${i}`}
              cx={x(i)}
              cy={y(d.value)}
              r={3.5}
              fill={accent}
            />
          ))}

          {/* Só as pontas do eixo x: mais que isso vira poluição em tela estreita. */}
          <SvgText
            x={PAD_LEFT}
            y={height - 6}
            fill={colors.textMuted}
            fontSize={11}
            textAnchor="start"
          >
            {data[0].label}
          </SvgText>
          {data.length > 1 ? (
            <SvgText
              x={PAD_LEFT + plotW}
              y={height - 6}
              fill={colors.textMuted}
              fontSize={11}
              textAnchor="end"
            >
              {data[data.length - 1].label}
            </SvgText>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm / 2,
    width: "100%",
  },
});
