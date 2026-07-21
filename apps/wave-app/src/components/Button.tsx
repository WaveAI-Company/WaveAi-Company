import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../theme";

export type ButtonVariant = "primary" | "secondary" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /**
   * `primary` usa o destaque do papel de quem está logado (o "sotaque" da
   * #18); `secondary` é delineado; `danger` marca ação destrutiva.
   */
  variant?: ButtonVariant;
  /** Sobrescreve o destaque — use só quando o papel do botão não for o do usuário. */
  accent?: string;
};

/**
 * Botão do design system.
 *
 * **Por que existe `variant` em vez de só uma cor:** antes o rótulo era sempre
 * pintado com a cor de fundo do app, então um botão "secundário" com fundo
 * escuro ficava com texto escuro sobre escuro — 1,42:1, ilegível. A variante
 * decide **fundo e texto juntos**, o que torna esse erro impossível.
 */
export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  accent,
}: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const inativo = Boolean(loading || disabled);
  const destaque = accent ?? papel.accent;

  const preenchido = variant !== "secondary";
  const fundo = variant === "danger" ? t.colors.danger : destaque;
  const corTexto = preenchido ? papel.onAccent : t.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: Boolean(loading) }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        styles.base,
        preenchido ? { backgroundColor: fundo } : styles.delineado,
        (pressed || inativo) && styles.atenuado,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[styles.label, { color: corTexto }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: "center",
      borderRadius: t.radius.md,
      justifyContent: "center",
      // Piso de acessibilidade: alvo de toque confortável.
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.lg,
    },
    delineado: {
      backgroundColor: "transparent",
      // `borderStrong` e não `border`: limite de controle precisa de 3:1.
      borderColor: t.colors.borderStrong,
      borderWidth: 1,
    },
    atenuado: {
      opacity: 0.6,
    },
    label: {
      ...t.typography.bodyStrong,
      fontSize: 16,
    },
  });
