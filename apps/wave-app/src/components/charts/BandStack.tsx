import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { BAND_COLORS, useTheme, type Theme } from "../../theme";

type Props = {
  /** Potências **relativas** por banda (frações que somam ~1). */
  relative: Partial<Record<BandKey, number>>;
  height?: number;
};

/**
 * Composição por banda numa **única barra empilhada** (design "Maré").
 *
 * É a versão de relance do `BandBars`: cabe numa linha de lista, onde cinco
 * barras não caberiam, e mostra a proporção entre as bandas de uma vez. Serve
 * para **comparar sessões**, não para ler valor — quem quer o número abre a
 * sessão.
 *
 * As cores são as mesmas do `BandBars` (`BAND_COLORS`), o que permite seguir
 * uma banda da lista para o detalhe. Categóricas, sem valência (ADR-0027).
 */
export function BandStack({ relative, height = 10 }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const partes = BANDS.map(({ key, label }) => ({
    key,
    label,
    fracao: relative[key] ?? 0,
  }));
  const total = partes.reduce((soma, p) => soma + p.fracao, 0);

  if (total <= 0) return <View style={[styles.trilho, { height }]} />;

  return (
    <View
      style={[styles.trilho, { height, borderRadius: height / 2 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Composição por banda: ${partes
        .map((p) => `${p.label} ${formatPercent(p.fracao / total)}`)
        .join(", ")}`}
    >
      {partes.map((p) => (
        <View
          key={p.key}
          style={{
            backgroundColor: t.colors[BAND_COLORS[p.key]],
            width: `${(p.fracao / total) * 100}%`,
          }}
        />
      ))}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    trilho: {
      backgroundColor: t.colors.surfaceAlt,
      flexDirection: "row",
      overflow: "hidden",
      width: "100%",
    },
  });
