import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

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

const PAD_LEFT = 46;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const ESPESSURA = 2;
const PONTO = 7;

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
export function TrendChart({ data, accent = colors.patient, height = 180, formatValue }: Props) {
  const [width, setWidth] = useState(0);

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

  // Um retângulo por segmento: posicionado no ponto médio e girado para ligar
  // os extremos. Rotação em RN é em torno do centro, então centralizar o
  // retângulo no meio do segmento faz as pontas caírem exatamente nos pontos.
  const segmentos = data.slice(1).map((ponto, i) => {
    const x1 = x(i);
    const y1 = y(data[i].value);
    const x2 = x(i + 1);
    const y2 = y(ponto.value);
    const comprimento = Math.hypot(x2 - x1, y2 - y1);
    const angulo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return {
      chave: `${ponto.label}-${i}`,
      left: (x1 + x2) / 2 - comprimento / 2,
      top: (y1 + y2) / 2 - ESPESSURA / 2,
      width: comprimento,
      angulo,
    };
  });

  return (
    <View style={[styles.wrapper, { height }]} onLayout={aoMedir}>
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
              backgroundColor: accent,
              transform: [{ rotate: `${s.angulo}deg` }],
            },
          ]}
        />
      ))}

      {data.map((d, i) => (
        <View
          key={`ponto-${d.label}-${i}`}
          style={[
            styles.ponto,
            { left: x(i) - PONTO / 2, top: y(d.value) - PONTO / 2, backgroundColor: accent },
          ]}
        />
      ))}

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

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm / 2,
    position: "relative",
    width: "100%",
  },
  grade: {
    backgroundColor: colors.border,
    height: 1,
    position: "absolute",
  },
  rotuloY: {
    color: colors.textMuted,
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
    bottom: 4,
    color: colors.textMuted,
    fontSize: 11,
    position: "absolute",
  },
  rotuloXFim: {
    textAlign: "right",
  },
});
