import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent?: string;
};

export function Button({ label, onPress, loading, disabled, accent = colors.patient }: Props) {
  const inativo = Boolean(loading || disabled);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: accent },
        (pressed || inativo) && styles.atenuado,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  atenuado: {
    opacity: 0.6,
  },
  label: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "700",
  },
});
