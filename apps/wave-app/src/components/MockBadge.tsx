import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../theme";

/**
 * Marca visual de conteúdo fictício.
 *
 * Regra rígida (LGPD): dados de teste devem ser **rotulados como tais** — nunca
 * exibir mock sem deixar claro que não é dado real.
 */
export function MockBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>DADOS FICTÍCIOS — amostra de teste</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(242, 201, 76, 0.15)",
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  text: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
