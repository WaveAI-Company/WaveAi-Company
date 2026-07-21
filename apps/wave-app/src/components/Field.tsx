import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../theme";

type Props = TextInputProps & {
  label: string;
  /** Mensagem de erro do campo; também marca o input para leitores de tela. */
  error?: string | null;
};

/** Campo de formulário rotulado, com foco visível. */
export function Field({ label, error, ...input }: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [focado, setFocado] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={input.accessibilityLabel ?? label}
        // Foco visível é requisito de acessibilidade e, no web, o contorno
        // padrão do navegador não aparece sobre fundo escuro.
        onFocus={(e) => {
          setFocado(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocado(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          focado && { borderColor: accent, borderWidth: 2 },
          Boolean(error) && { borderColor: t.colors.danger },
        ]}
        placeholderTextColor={t.colors.textMuted}
        autoCapitalize={input.autoCapitalize ?? "none"}
      />
      {error ? <Text style={styles.erro}>{error}</Text> : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.xs,
    },
    label: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    input: {
      ...t.typography.body,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.md,
      borderWidth: 1,
      color: t.colors.text,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
    },
    erro: {
      ...t.typography.caption,
      color: t.colors.dangerText,
    },
  });
