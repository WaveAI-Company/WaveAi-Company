import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { listMyResults, type SessionResult } from "../../src/api/results";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SessionsDashboard } from "../../src/components/SessionsDashboard";
import { StateView } from "../../src/components/StateView";
import { colors, spacing } from "../../src/theme";

/**
 * Histórico e tendências do paciente (#16).
 *
 * Lê os `Result` reais do titular (#15). Sem sessões, mostra vazio honesto —
 * antes havia mock aqui, mas exibir sessão fictícia ao lado de medição real
 * confundiria as duas coisas.
 */
export default function PatientHistoryScreen() {
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setResults(await listMyResults());
    } catch {
      setErro("Não foi possível carregar suas sessões.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega **ao focar**, não só ao montar: voltando de uma captação, a
  // sessão recém-encerrada precisa aparecer sem recarregar o app (#17).
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Histórico</Text>
      <Text style={styles.lead}>
        Suas sessões registradas e como suas medidas variam ao longo do tempo.
      </Text>

      <StateView
        loading={loading}
        error={erro}
        empty={
          !loading && !erro && results.length === 0
            ? "Nenhuma sessão registrada ainda. Quando você captar uma sessão, ela aparece aqui."
            : null
        }
      />

      {!loading && !erro && results.length > 0 ? (
        <SessionsDashboard results={results} accent={colors.patient} />
      ) : null}

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
