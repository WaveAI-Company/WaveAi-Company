import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { getPatient, type PatientSummary } from "../../../src/api/care";
import { listPatientResults, type SessionResult } from "../../../src/api/results";
import { Disclaimer } from "../../../src/components/Disclaimer";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { ScreenHeading } from "../../../src/components/ScreenHeading";
import { SessionsDashboard } from "../../../src/components/SessionsDashboard";
import { StateView } from "../../../src/components/StateView";
import { useTheme, type Theme } from "../../../src/theme";

/**
 * Detalhe do paciente com dashboards (#16).
 *
 * Os dados vêm da API, que devolve **403 sem vínculo ativo** — a autorização é
 * do servidor, esta tela só reflete o resultado, e o acesso fica auditado
 * (ADR-0026).
 */
export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErro(null);
    try {
      // As duas leituras dependem do mesmo vínculo ativo: se uma cai por 403,
      // a tela inteira não tem o que mostrar.
      const [dados, sessoes] = await Promise.all([getPatient(id), listPatientResults(id)]);
      setPatient(dados);
      setResults(sessoes);
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

      {!loading && !erro && patient ? (
        <>
          <ScreenHeading
            title={patient.display_name ?? "Paciente"}
            lead="Sessões registradas e tendências, com autorização deste paciente."
          />

          {results.length === 0 ? (
            <Text style={styles.vazio}>
              Este paciente ainda não tem sessões registradas.
            </Text>
          ) : (
            <SessionsDashboard results={results} />
          )}

          <Disclaimer variant="profissional" />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    vazio: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
