import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { useRoleAccent, useTheme, type Theme } from "../../theme";

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
export function BandBars({ relative, accent }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

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
        const texto = valor === undefined ? "—" : formatPercent(fracao);
        return (
          <View
            key={key}
            style={styles.linha}
            accessible
            accessibilityLabel={`${label}, ${range}: ${texto}`}
          >
            <View style={styles.rotulo}>
              <Text style={styles.nome}>{label}</Text>
              <Text style={styles.faixa}>{range}</Text>
            </View>
            <View style={styles.trilho}>
              <View
                style={[styles.barra, { width: largura as `${number}%`, backgroundColor: cor }]}
              />
            </View>
            <Text style={styles.valor}>{texto}</Text>
          </View>
        );
      })}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    linha: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    rotulo: {
      width: 96,
    },
    nome: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    faixa: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
    },
    trilho: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.pill,
      flex: 1,
      height: 10,
      overflow: "hidden",
    },
    barra: {
      borderRadius: t.radius.pill,
      height: "100%",
    },
    valor: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 13,
      textAlign: "right",
      width: 52,
    },
  });
