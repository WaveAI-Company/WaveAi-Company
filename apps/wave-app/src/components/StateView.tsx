import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme";

type Props = {
  loading?: boolean;
  error?: string | null;
  empty?: string | null;
};

/**
 * Estados de carregamento, erro e lista vazia.
 *
 * Existe para as telas não confundirem "ainda carregando" com "não há nada" —
 * distinção que importa quando o vazio pode significar "nenhum paciente
 * autorizou o acompanhamento".
 */
export function StateView({ loading, error, empty }: Props) {
  if (loading) {
    return (
      <View style={styles.caixa}>
        <ActivityIndicator color={colors.patient} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.caixa}>
        <Text style={styles.erro}>{error}</Text>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.caixa}>
        <Text style={styles.vazio}>{empty}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  caixa: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  erro: {
    color: colors.warning,
    fontSize: 14,
    textAlign: "center",
  },
  vazio: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
