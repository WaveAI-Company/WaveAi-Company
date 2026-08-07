import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { BAND_COLORS, useTheme, type Theme } from "../../theme";

type Props = {
  relative: Partial<Record<BandKey, number>>;
};

/**
 * Legenda das bandas com o valor de cada uma.
 *
 * Acompanha o `BandStack`, que mostra a proporção mas não diz os números — e
 * cor sozinha não pode ser a única forma de identificar a banda (quem não
 * distingue os matizes ficaria sem leitura). Aqui cada cor vem **com o nome**.
 */
export function BandLegend({ relative }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const total = BANDS.reduce((soma, { key }) => soma + (relative[key] ?? 0), 0);

  return (
    <View style={styles.linha}>
      {BANDS.map(({ key, label }) => {
        const fracao = relative[key];
        return (
          <View key={key} style={styles.item}>
            <View style={[styles.ponto, { backgroundColor: t.colors[BAND_COLORS[key]] }]} />
            <Text style={styles.rotulo}>
              {label.toLowerCase()}{" "}
              <Text style={styles.valor}>
                {fracao !== undefined && total > 0 ? formatPercent(fracao / total, 0) : "—"}
              </Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    linha: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    item: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
    },
    ponto: {
      borderRadius: 3,
      height: 8,
      width: 8,
    },
    rotulo: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    valor: {
      color: t.colors.text,
      fontWeight: "700",
    },
  });
