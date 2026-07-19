import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { ScreenContainer } from "../src/components/ScreenContainer";
import { colors, spacing } from "../src/theme";

/**
 * Tela inicial (pública). Quem já tem sessão é levado pela guarda de rota
 * direto para a área do seu papel.
 */
export default function HomeScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.heading}>WaveAI</Text>
      <Text style={styles.lead}>
        Plataforma de captação e análise de EEG de consumo, com acompanhamento de
        bem-estar.
      </Text>

      <Link href="/login" style={styles.link}>
        Entrar
      </Link>
      <Link href="/register" style={styles.link}>
        Criar conta
      </Link>

      <Text style={styles.footnote}>
        Uso exploratório de bem-estar — não-clínico e não-diagnóstico.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.patient,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: spacing.sm,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
