import { Platform, StyleSheet, Text } from "react-native";

import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { colors, spacing } from "../../src/theme";

/** Sessões fictícias apenas para dar forma à tela (issue #11 traz o histórico real). */
const MOCK_SESSIONS = [
  { id: "s-1", date: "12/07/2026", duration: "8 min" },
  { id: "s-2", date: "09/07/2026", duration: "12 min" },
];

/**
 * Área do paciente (placeholder).
 *
 * Captação é uma **capability por plataforma** (`Architecture/22`, §3): existe
 * no mobile (módulo nativo BLE/SPP, issue #12) e não no web puro.
 */
export default function PatientScreen() {
  const captureSupported = Platform.OS !== "web";
  const { user, signOut } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Olá, {user?.display_name ?? "paciente"}!</Text>
      <Text style={styles.lead}>
        Acompanhe suas sessões e tendências de bem-estar.
      </Text>

      <Card
        title="Captação de EEG"
        subtitle={
          captureSupported
            ? "Conexão com o MindWave chega na issue #12."
            : "Captura indisponível neste dispositivo — use o app no celular."
        }
        accent={captureSupported ? colors.patient : colors.warning}
      />

      <MockBadge />
      {MOCK_SESSIONS.map((session) => (
        <Card
          key={session.id}
          title={`Sessão de ${session.date}`}
          subtitle={`Duração ${session.duration} · resultado indisponível nesta fase`}
          accent={colors.patient}
        />
      ))}

      <Text style={styles.footnote}>
        Uso exploratório de bem-estar — não-clínico e não-diagnóstico.
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
