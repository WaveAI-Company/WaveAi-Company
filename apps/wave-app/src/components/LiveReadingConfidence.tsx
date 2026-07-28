import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { readingReliability } from "../device/contactQuality";
import { useTheme, type Theme } from "../theme";
import { InfoButton } from "./InfoButton";

/**
 * Faixa de "quando confiar" na leitura ao vivo (P4-b).
 *
 * Traduz o contato atual (`poorSignal`) numa mensagem sobre **quanto confiar**
 * nos números logo abaixo — o elo entre o contato (P4-a) e as features. É
 * qualificador de confiabilidade da medida, não juízo do estado mental: a cor de
 * alerta é honesta (ADR-0027). Aparece só durante a captação; o número cru
 * continua no card de contato acima.
 */

type Props = {
  poorSignal: number;
  /** Cor de destaque do papel (paciente). */
  accent: string;
};

export function LiveReadingConfidence({ poorSignal, accent }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const confianca = readingReliability(poorSignal);

  const cor =
    confianca.level === "bom"
      ? accent
      : confianca.level === "solto"
        ? t.colors.dangerText
        : t.colors.warningText;

  return (
    <View style={[styles.faixa, { borderLeftColor: cor }]}>
      <View style={styles.cabecalho}>
        <Text style={[styles.label, { color: cor }]}>{confianca.label}</Text>
        <InfoButton term="signal_quality" accent={accent} />
      </View>
      <Text style={styles.nota}>{confianca.note}</Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    faixa: {
      backgroundColor: t.colors.surface,
      borderLeftWidth: 4,
      borderRadius: t.radius.md,
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    cabecalho: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
    },
    label: {
      ...t.typography.label,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    nota: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
