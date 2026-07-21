import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";

/**
 * Marca visual de conteúdo fictício.
 *
 * Regra rígida (LGPD): dados de teste devem ser **rotulados como tais** — nunca
 * exibir mock sem deixar claro que não é dado real.
 */
export function MockBadge() {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>DADOS FICTÍCIOS — amostra de teste</Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    badge: {
      alignSelf: "flex-start",
      borderColor: t.colors.warningText,
      borderRadius: t.radius.md,
      borderWidth: 1,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
    },
    text: {
      ...t.typography.caption,
      color: t.colors.warningText,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
  });
