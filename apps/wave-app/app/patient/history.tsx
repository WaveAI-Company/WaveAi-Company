import { StyleSheet, Text } from "react-native";

import { Card } from "../../src/components/Card";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { MOCK_SESSIONS, RESULTADO_INDISPONIVEL } from "../../src/mocks/mockSessions";
import { colors, spacing } from "../../src/theme";

/**
 * Histórico de sessões do paciente.
 *
 * Os dados são **fictícios** e rotulados: o histórico real depende do
 * relatório por sessão (#15), que ainda não existe.
 */
export default function PatientHistoryScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.heading}>Histórico</Text>
      <Text style={styles.lead}>Suas sessões registradas, da mais recente à mais antiga.</Text>

      <MockBadge />
      {MOCK_SESSIONS.map((session) => (
        <Card
          key={session.id}
          title={`Sessão de ${session.date}`}
          subtitle={`Duração ${session.duration} · ${RESULTADO_INDISPONIVEL}`}
          accent={colors.patient}
        />
      ))}

      <Text style={styles.footnote}>
        Uso exploratório de bem-estar — não-clínico e não-diagnóstico. Estes
        números não indicam diagnóstico nem substituem avaliação profissional.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
