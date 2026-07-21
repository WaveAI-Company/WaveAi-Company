import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

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
import { Disclaimer } from "../../src/components/Disclaimer";
import { NavAction } from "../../src/components/NavAction";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { useRoleAccent, useTheme } from "../../src/theme";

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
  const t = useTheme();
  const { accent } = useRoleAccent();
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

  // Ao focar, não só ao montar: voltando do consentimento ou de uma captação,
  // o aviso e as sessões recentes precisam refletir o que acabou de mudar.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  return (
    <ScreenContainer>
      <ScreenHeading
        title={`Olá, ${user?.display_name ?? "paciente"}!`}
        lead="Acompanhe suas sessões e tendências de bem-estar."
      />

      {/* Lembrete não-bloqueante: sem consentimento, nada é guardado. */}
      {consentido === false ? (
        <NavAction
          label="Autorize guardar seus resultados"
          description="Sem consentimento, os resultados das suas sessões não são guardados. Toque para rever e autorizar."
          tone="attention"
          onPress={() => router.push("/patient/consent")}
        />
      ) : null}

      {pendentes > 0 ? (
        <NavAction
          label={
            pendentes === 1
              ? "1 convite aguardando resposta"
              : `${pendentes} convites aguardando resposta`
          }
          onPress={() => router.push("/patient/invites")}
        />
      ) : null}

      <Card
        title="Captação de EEG"
        subtitle={
          captureSupported
            ? "Conecte o MindWave na tela de estado ao vivo."
            : "Captura indisponível neste dispositivo — use o app no celular."
        }
        accent={captureSupported ? accent : t.colors.warningText}
      />

      <ScreenHeading title="Sessões recentes" size="title" />
      {recentes.length === 0 ? (
        <Card title="Nenhuma sessão registrada ainda" />
      ) : (
        recentes.map((sessao) => (
          <Card
            key={sessao.id}
            title={`Sessão de ${formatDate(sessao.created_at)}`}
            subtitle={formatDuration(sessionDurationSeconds(sessao.metrics)) ?? undefined}
            accent={accent}
          />
        ))
      )}

      <NavAction label="Estado ao vivo" onPress={() => router.push("/patient/live")} />
      <NavAction
        label="Ver histórico completo"
        onPress={() => router.push("/patient/history")}
      />
      <NavAction label="Meu perfil" onPress={() => router.push("/patient/profile")} />

      <Disclaimer />
    </ScreenContainer>
  );
}
