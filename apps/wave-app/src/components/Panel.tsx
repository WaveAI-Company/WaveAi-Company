import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { shadows, useTheme, type Theme } from "../theme";

/**
 * Cartão do design "Maré" (ADR-0042).
 *
 * Difere do [`Card`](Card.tsx) legado em duas coisas: não tem a faixa lateral
 * de destaque e o cabeçalho carrega uma **sobrancelha** à direita — o lugar de
 * dizer a unidade ("% do espectro") ou a ressalva ("proprietário · não
 * validado") sem roubar o título.
 *
 * Os dois convivem enquanto o porte anda tela a tela; cada tela usa **um** dos
 * dois, nunca os dois misturados.
 */

type Props = {
  title?: string;
  /** Texto pequeno à direita do título — unidade, origem, ressalva. */
  eyebrow?: string;
  /** Nó à direita do título (chip, `InfoButton`) — vence a `eyebrow`. */
  headerAccessory?: ReactNode;
  children?: ReactNode;
  /** Preenche a altura disponível (usado nas colunas do grid). */
  grow?: boolean;
};

export function Panel({ title, eyebrow, headerAccessory, children, grow }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={[styles.painel, grow && styles.cresce]}>
      {title || eyebrow || headerAccessory ? (
        <View style={styles.cabecalho}>
          {title ? <Text style={styles.titulo}>{title}</Text> : null}
          {headerAccessory ?? (eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null)}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    painel: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderSoft,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      gap: t.spacing.sm,
      padding: t.spacing.md,
      ...shadows.card,
    },
    cresce: {
      flex: 1,
    },
    cabecalho: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      justifyContent: "space-between",
    },
    titulo: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
    },
    eyebrow: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      textAlign: "right",
      textTransform: "uppercase",
    },
  });
