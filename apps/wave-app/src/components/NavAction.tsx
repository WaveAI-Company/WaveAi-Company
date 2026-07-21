import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  /** Texto secundário sob o rótulo (ex.: motivo de um aviso). */
  description?: string;
  /** `attention` destaca uma pendência (ex.: consentimento faltando). */
  tone?: "neutral" | "accent" | "attention";
};

/**
 * Linha de navegação delineada.
 *
 * Substitui os `Pressable` soltos que cada tela montava à mão — que variavam
 * em altura, borda e cor, e não garantiam alvo de toque mínimo.
 */
export function NavAction({ label, onPress, description, tone = "accent" }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const corBorda =
    tone === "attention"
      ? t.colors.warningText
      : tone === "accent"
        ? papel.accent
        : t.colors.borderStrong;
  const corTexto =
    tone === "attention"
      ? t.colors.warningText
      : tone === "accent"
        ? papel.accentText
        : t.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { borderColor: corBorda },
        pressed && styles.pressionado,
      ]}
    >
      <View style={styles.conteudo}>
        <Text style={[styles.label, { color: corTexto }]}>{label}</Text>
        {description ? <Text style={styles.descricao}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    base: {
      borderRadius: t.radius.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
    pressionado: {
      opacity: 0.7,
    },
    conteudo: {
      gap: t.spacing.xs,
    },
    label: {
      ...t.typography.bodyStrong,
      textAlign: "center",
    },
    descricao: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
