import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme, type Theme } from "../theme";

/**
 * Barra de preenchimento do design "Maré".
 *
 * Puro layout (`View` sobre `View`), sem SVG: proporção é problema de largura,
 * então a barra acompanha o container sozinha, sem se medir.
 *
 * A cor vem sempre de fora. É de propósito: quem usa decide se aquilo tem
 * valência (contato do sensor tem; banda **não** tem — ADR-0027), e o
 * componente não arbitra isso por conta própria.
 */

type Props = {
  /** 0 a 1. Valores fora da faixa são aparados. */
  value: number;
  color: string;
  height?: number;
  /** Descrição para leitor de tela; sem ela a barra é decorativa. */
  accessibilityLabel?: string;
};

export function Meter({ value, color, height = 8, accessibilityLabel }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const fracao = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  return (
    <View
      style={[styles.trilho, { height, borderRadius: height / 2 }]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fracao * 100) }}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: height / 2,
          height: "100%",
          width: `${fracao * 100}%`,
        }}
      />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    trilho: {
      backgroundColor: t.colors.surfaceAlt,
      overflow: "hidden",
      width: "100%",
    },
  });
