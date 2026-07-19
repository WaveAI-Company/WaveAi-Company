import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radius, spacing } from "../theme";

type Props = TextInputProps & {
  label: string;
};

/** Campo de formulário rotulado. */
export function Field({ label, ...input }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={input.autoCapitalize ?? "none"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm / 2,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
