import { StyleSheet, Text } from "react-native";

import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { colors, spacing } from "../../src/theme";

/** Pacientes fictícios apenas para dar forma à tela (issue #10 traz a lista real). */
const MOCK_PATIENTS = [
  { id: "p-1", name: "Paciente A", lastSession: "12/07/2026" },
  { id: "p-2", name: "Paciente B", lastSession: "05/07/2026" },
];

/**
 * Área do médico (placeholder).
 *
 * A lista real depende do vínculo médico-paciente com RBAC (issue #9) e das
 * telas de detalhe (issue #10).
 */
export default function DoctorScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Pacientes</Text>
      <Text style={styles.lead}>
        {user?.display_name ? `${user.display_name} — a` : "A"}companhamento dos
        pacientes vinculados a você.
      </Text>

      <MockBadge />
      {MOCK_PATIENTS.map((patient) => (
        <Card
          key={patient.id}
          title={patient.name}
          subtitle={`Última sessão em ${patient.lastSession}`}
          accent={colors.doctor}
        />
      ))}

      <Text style={styles.footnote}>
        Dados exploratórios de bem-estar — não-clínicos e não-diagnósticos. Não
        substituem avaliação profissional.
      </Text>

      <Button label="Sair" onPress={signOut} accent={colors.border} />
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
