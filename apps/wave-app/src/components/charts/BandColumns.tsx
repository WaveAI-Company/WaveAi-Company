import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { BAND_COLORS, useTheme, type Theme } from "../../theme";

export type BandColumn = {
  /** Rótulo curto do eixo (ex.: "2/8"). */
  label: string;
  relative: Partial<Record<BandKey, number>>;
};

type Props = {
  columns: BandColumn[];
  height?: number;
};

/**
 * Composição por banda **sessão a sessão**, em colunas empilhadas.
 *
 * Cada coluna é uma sessão e vale 100%: o que se lê é a **mudança de
 * proporção** entre sessões, não a quantidade de sinal (que depende de contato,
 * ganho e ruído, e não é comparável entre dias). Nenhuma banda é "boa" ou
 * "ruim" — as cores são categóricas, as mesmas do `BandBars` e do `BandStack`
 * (ADR-0027).
 *
 * Feito com `View`s, como as outras barras: proporção é layout, não geometria.
 */
export function BandColumns({ columns, height = 140 }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  if (columns.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.colunas, { height }]}>
        {columns.map((coluna, i) => {
          const partes = BANDS.map(({ key, label }) => ({
            key,
            label,
            fracao: coluna.relative[key] ?? 0,
          }));
          const total = partes.reduce((soma, p) => soma + p.fracao, 0);
          return (
            <View
              key={`${coluna.label}-${i}`}
              style={styles.coluna}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`${coluna.label}: ${partes
                .map((p) => `${p.label} ${total > 0 ? formatPercent(p.fracao / total) : "—"}`)
                .join(", ")}`}
            >
              {total > 0 ? (
                partes.map((p) => (
                  <View
                    key={p.key}
                    style={{
                      backgroundColor: t.colors[BAND_COLORS[p.key]],
                      height: `${(p.fracao / total) * 100}%`,
                    }}
                  />
                ))
              ) : (
                <View style={styles.vazia} />
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.eixo}>
        {columns.map((coluna, i) => (
          <Text key={`${coluna.label}-${i}`} style={styles.eixoRotulo} numberOfLines={1}>
            {coluna.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.xs,
    },
    colunas: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    coluna: {
      borderRadius: t.radius.sm,
      // Empilha de baixo para cima, na ordem das bandas.
      flexDirection: "column-reverse",
      flex: 1,
      height: "100%",
      minWidth: 12,
      overflow: "hidden",
    },
    vazia: {
      backgroundColor: t.colors.surfaceAlt,
      height: "100%",
    },
    eixo: {
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    eixoRotulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      flex: 1,
      fontSize: 10,
      textAlign: "center",
    },
  });
