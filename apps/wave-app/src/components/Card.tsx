import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  accent?: string;
  children?: ReactNode;
};

/** Bloco de conteúdo com título e faixa de destaque opcional. */
export function Card({ title, subtitle, accent = colors.border, children }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
