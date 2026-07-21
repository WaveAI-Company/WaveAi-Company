import { StyleSheet, Text, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { colors, radius, spacing } from "../../theme";

type Props = {
  /** Potências **relativas** por banda (frações que somam ~1). */
  relative: Partial<Record<BandKey, number>>;
  accent?: string;
};

/**
 * Composição de bandas da sessão, em barras horizontais.
 *
 * Feito com `View`s e não SVG de propósito: barras proporcionais são um
 * problema de layout, não de geometria — assim acompanham a largura da tela
 * sozinhas, sem medir nada.
 *
 * Todas as bandas usam a mesma cor: destacar uma sugeriria que ela é a
 * "certa", e nesta fase não há interpretação clínica a fazer.
 */
export function BandBars({ relative, accent = colors.patient }: Props) {
  // A maior banda define a escala — com frações pequenas, normalizar pelo topo
  // torna a comparação legível sem distorcer a proporção entre elas.
  const valores = BANDS.map(({ key }) => relative[key] ?? 0);
  const maior = Math.max(...valores, 0);

  return (
    <View style={styles.wrapper}>
      {BANDS.map(({ key, label, range }) => {
        const valor = relative[key];
        const fracao = valor ?? 0;
        const largura = maior > 0 ? `${(fracao / maior) * 100}%` : "0%";
        return (
          <View key={key} style={styles.linha}>
            <View style={styles.rotulo}>
              <Text style={styles.nome}>{label}</Text>
              <Text style={styles.faixa}>{range}</Text>
            </View>
            <View style={styles.trilho}>
              <View
                style={[styles.barra, { width: largura as `${number}%`, backgroundColor: accent }]}
              />
            </View>
            <Text style={styles.valor}>
              {valor === undefined ? "—" : formatPercent(fracao)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
    marginTop: spacing.sm / 2,
  },
  linha: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  rotulo: {
    width: 96,
  },
  nome: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  faixa: {
    color: colors.textMuted,
    fontSize: 11,
  },
  trilho: {
    backgroundColor: colors.border,
    borderRadius: radius.md,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  barra: {
    borderRadius: radius.md,
    height: "100%",
  },
  valor: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "right",
    width: 52,
  },
});
