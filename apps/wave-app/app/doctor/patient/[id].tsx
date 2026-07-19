import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { getPatient, type PatientSummary } from "../../../src/api/care";
import { Card } from "../../../src/components/Card";
import { MockBadge } from "../../../src/components/MockBadge";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { StateView } from "../../../src/components/StateView";
import { colors, spacing } from "../../../src/theme";

/**
 * Sessões fictícias: o histórico real depende do relatório por sessão (#15).
 * Rotuladas na UI — nunca exibir mock sem deixar claro que não é dado real.
 */
const MOCK_SESSIONS = [
  { id: "s-1", date: "12/07/2026", duration: "8 min" },
  { id: "s-2", date: "09/07/2026", duration: "12 min" },
  { id: "s-3", date: "02/07/2026", duration: "6 min" },
];

/**
 * Detalhe do paciente.
 *
 * Os dados vêm da API, que devolve **403 sem vínculo ativo** — a autorização
 * é do servidor, esta tela só reflete o resultado.
 */
export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErro(null);
    try {
      setPatient(await getPatient(id));
    } catch {
      // Cobre 403 (vínculo revogado enquanto a tela estava aberta) e falhas
      // de rede: em ambos os casos não há o que mostrar.
      setErro("Não foi possível abrir este paciente. O acompanhamento pode ter sido revogado.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <ScreenContainer>
      <StateView loading={loading} error={erro} />

      {patient ? (
        <>
          <Text style={styles.heading}>{patient.display_name ?? "Paciente"}</Text>
          <Text style={styles.lead}>Sessões registradas.</Text>

          <MockBadge />
          {MOCK_SESSIONS.map((session) => (
            <Card
              key={session.id}
              title={`Sessão de ${session.date}`}
              subtitle={`Duração ${session.duration} · resultado indisponível nesta fase`}
              accent={colors.doctor}
            />
          ))}

          <Text style={styles.footnote}>
            Dados exploratórios de bem-estar — não-clínicos e não-diagnósticos.
            Não substituem avaliação profissional.
          </Text>
        </>
      ) : null}
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
