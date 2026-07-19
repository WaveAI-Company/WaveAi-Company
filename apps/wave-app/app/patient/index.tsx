import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { useAuth } from "../../src/auth/AuthContext";
import { Card } from "../../src/components/Card";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { MOCK_SESSIONS, RESULTADO_INDISPONIVEL } from "../../src/mocks/mockSessions";
import { colors, radius, spacing } from "../../src/theme";

/** Quantas sessões aparecem na home antes de "ver todas". */
const RESUMO = 2;

/**
 * Home do paciente.
 *
 * Captação é uma **capability por plataforma** (`Architecture/22`, §3): existe
 * no mobile (módulo nativo BLE/SPP, #12) e não no web puro.
 */
export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const captureSupported = Platform.OS !== "web";

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

      <Text style={styles.secao}>Sessões recentes</Text>
      <MockBadge />
      {MOCK_SESSIONS.slice(0, RESUMO).map((session) => (
        <Card
          key={session.id}
          title={`Sessão de ${session.date}`}
          subtitle={`Duração ${session.duration} · ${RESULTADO_INDISPONIVEL}`}
          accent={colors.patient}
        />
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/live")}
        style={({ pressed }) => [styles.acao, pressed && styles.pressed]}
      >
        <Text style={styles.acaoTexto}>Estado ao vivo (simulado)</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/history")}
        style={({ pressed }) => [styles.acao, pressed && styles.pressed]}
      >
        <Text style={styles.acaoTexto}>Ver histórico completo</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/profile")}
        style={({ pressed }) => [styles.acao, pressed && styles.pressed]}
      >
        <Text style={styles.acaoTexto}>Meu perfil</Text>
      </Pressable>

      <Text style={styles.footnote}>
        Uso exploratório de bem-estar — não-clínico e não-diagnóstico.
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
  secao: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  acao: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  acaoTexto: {
    color: colors.patient,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
