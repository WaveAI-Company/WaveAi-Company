import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../../theme";

/**
 * Sobrancelha de seção com a régua que atravessa a coluna — o `.sec-label` do
 * design. Divide o perfil em blocos sem gastar um cartão para isso.
 */
export function ProfileSection({ label }: { label: string }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.secao}>
      <Text style={styles.texto}>{label}</Text>
      <View style={styles.regua} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    secao: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    texto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    regua: {
      backgroundColor: t.colors.border,
      flex: 1,
      height: 1,
    },
  });
