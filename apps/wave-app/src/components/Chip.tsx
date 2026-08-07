import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, withAlpha, type Theme } from "../theme";

/**
 * Pílula de rótulo do design "Maré" (ADR-0042).
 *
 * As variantes existem para manter honesta a única distinção que importa aqui:
 * `cautela` marca o que é **proprietário ou não validado** (ADR-0034) e é a
 * única que empresta cor de alerta. `estado` só brilha porque algo está
 * acontecendo agora — não porque seja bom. `neutro` não opina.
 */

export type ChipVariant = "neutro" | "estado" | "cautela";

type Props = {
  label: string;
  variant?: ChipVariant;
  /** Ponto colorido antes do texto (usado por "AO VIVO"). */
  dot?: boolean;
  /** Cor do ponto e do texto na variante `estado`. */
  accent?: string;
  icon?: ReactNode;
};

export function Chip({ label, variant = "neutro", dot, accent, icon }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const cor =
    variant === "cautela"
      ? t.colors.warningText
      : variant === "estado"
        ? accent ?? t.colors.accentPatientText
        : t.colors.textMuted;

  return (
    <View
      style={[
        styles.chip,
        variant === "cautela" && { borderColor: t.colors.warningText },
        variant === "estado" && { backgroundColor: withAlpha(cor, 0.12) },
      ]}
    >
      {dot ? <View style={[styles.ponto, { backgroundColor: cor }]} /> : null}
      {icon}
      <Text style={[styles.texto, { color: cor }]}>{label}</Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    chip: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: t.spacing.sm + 2,
      paddingVertical: 4,
    },
    ponto: {
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    texto: {
      ...t.typography.caption,
      fontWeight: "700",
    },
  });
