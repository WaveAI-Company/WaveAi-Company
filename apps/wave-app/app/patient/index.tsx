import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { listPendingInvites } from "../../src/api/care";
import { getConsentStatus } from "../../src/api/consent";
import {
  formatDate,
  formatDuration,
  listMyResults,
  sessionDurationSeconds,
  type SessionResult,
} from "../../src/api/results";
import { useAuth } from "../../src/auth/AuthContext";
import { Card } from "../../src/components/Card";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { colors, radius, spacing } from "../../src/theme";

/** Quantas sessões aparecem na home antes de "ver todas". */
const RESUMO = 2;

/**
 * Home do paciente.
 *
 * Captação é uma **capability por plataforma** (`Architecture/22`, §3): existe
 * no mobile (módulo nativo BLE/SPP, #12) e não no web puro.
 *
 * Surfaça — sem bloquear — dois pontos do consent-first (ADR-0024/0026): um
 * lembrete de consentimento (o gate que libera guardar resultados) e a caixa de
 * convites, quando há algum pendente.
 */
export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const captureSupported = Platform.OS !== "web";
  const [consentido, setConsentido] = useState<boolean | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [recentes, setRecentes] = useState<SessionResult[]>([]);

  const carregar = useCallback(async () => {
    try {
      const [status, convites, sessoes] = await Promise.all([
        getConsentStatus(),
        listPendingInvites(),
        listMyResults(),
      ]);
      setConsentido(status.consent_given);
      setPendentes(convites.length);
      // Mais recentes primeiro: a home mostra só um resumo.
      setRecentes([...sessoes].reverse().slice(0, RESUMO));
    } catch {
      // A home não deve quebrar se os avisos falharem; ficam ocultos.
      setConsentido(null);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Olá, {user?.display_name ?? "paciente"}!</Text>
      <Text style={styles.lead}>
        Acompanhe suas sessões e tendências de bem-estar.
      </Text>

      {/* Lembrete não-bloqueante: sem consentimento, nada é guardado. */}
      {consentido === false ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/patient/consent")}
          style={({ pressed }) => [styles.aviso, pressed && styles.pressed]}
        >
          <Text style={styles.avisoTitulo}>Autorize guardar seus resultados</Text>
          <Text style={styles.avisoTexto}>
            Sem consentimento, os resultados das suas sessões não são guardados.
            Toque para rever e autorizar.
          </Text>
        </Pressable>
      ) : null}

      {pendentes > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/patient/invites")}
          style={({ pressed }) => [styles.convite, pressed && styles.pressed]}
        >
          <Text style={styles.conviteTexto}>
            {pendentes === 1
              ? "1 convite aguardando resposta"
              : `${pendentes} convites aguardando resposta`}
          </Text>
        </Pressable>
      ) : null}

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
      {recentes.length === 0 ? (
        <Text style={styles.vazio}>
          Nenhuma sessão registrada ainda.
        </Text>
      ) : (
        recentes.map((sessao) => (
          <Card
            key={sessao.id}
            title={`Sessão de ${formatDate(sessao.created_at)}`}
            subtitle={
              formatDuration(sessionDurationSeconds(sessao.metrics)) ?? undefined
            }
            accent={colors.patient}
          />
        ))
      )}

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
  aviso: {
    backgroundColor: colors.surface,
    borderColor: colors.warning,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm / 2,
    padding: spacing.md,
  },
  avisoTitulo: {
    color: colors.warning,
    fontSize: 15,
    fontWeight: "700",
  },
  avisoTexto: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  convite: {
    borderColor: colors.doctor,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  conviteTexto: {
    color: colors.doctor,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  secao: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  vazio: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
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
