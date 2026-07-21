import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";

type Props = {
  title: string;
  lead?: string;
  /** `display` para telas de entrada; `title` para as internas (padrão). */
  size?: "display" | "title";
};

/**
 * Título e subtítulo de tela.
 *
 * Centraliza a hierarquia tipográfica: antes cada tela escolhia seu próprio
 * `fontSize`, e os valores já haviam divergido (26, 28, 32 para o mesmo papel).
 */
export function ScreenHeading({ title, lead, size = "title" }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.wrapper}>
      <Text style={size === "display" ? styles.display : styles.title} accessibilityRole="header">
        {title}
      </Text>
      {lead ? <Text style={styles.lead}>{lead}</Text> : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.sm,
    },
    display: {
      ...t.typography.display,
      color: t.colors.text,
    },
    title: {
      ...t.typography.title,
      color: t.colors.text,
    },
    lead: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
  });
