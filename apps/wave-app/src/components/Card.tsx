import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  /** Faixa lateral de destaque. Sem valor, usa a borda neutra. */
  accent?: string;
  children?: ReactNode;
};

/** Bloco de conteúdo com título e faixa de destaque opcional. */
export function Card({ title, subtitle, accent, children }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={[styles.card, { borderLeftColor: accent ?? t.colors.border }]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderLeftWidth: 4,
      borderRadius: t.radius.md,
      gap: t.spacing.sm,
      padding: t.spacing.md,
    },
    title: {
      ...t.typography.heading,
      color: t.colors.text,
    },
    subtitle: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
