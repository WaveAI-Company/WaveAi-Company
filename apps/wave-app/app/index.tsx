import { Link } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { Card } from "../src/components/Card";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { colors, radius, spacing } from "../src/theme";

/**
 * Tela inicial: escolha de papel.
 *
 * A seleção é **mock** — autenticação real (JWT + papéis) é a issue #7/#8.
 * Aqui só validamos boot e navegação em web e mobile.
 */
export default function HomeScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.heading}>WaveAI</Text>
      <Text style={styles.lead}>
        Plataforma de captação e análise de EEG de consumo, com acompanhamento de
        bem-estar. Escolha um papel para ver a área correspondente.
      </Text>

      <Link href="/patient" asChild>
        <Pressable style={({ pressed }) => [styles.role, pressed && styles.pressed]}>
          <Card
            title="Entrar como paciente"
            subtitle="Sessões, histórico pessoal e estado ao vivo."
            accent={colors.patient}
          />
        </Pressable>
      </Link>

      <Link href="/doctor" asChild>
        <Pressable style={({ pressed }) => [styles.role, pressed && styles.pressed]}>
          <Card
            title="Entrar como médico"
            subtitle="Lista de pacientes vinculados e dashboards por sessão."
            accent={colors.doctor}
          />
        </Pressable>
      </Link>

      <Text style={styles.footnote}>
        Seleção de papel simulada (sem login). Uso exploratório de bem-estar —
        não-clínico e não-diagnóstico.
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
  role: {
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.7,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
