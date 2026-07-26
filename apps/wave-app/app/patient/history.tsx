import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { getMyReport, type LongitudinalReport as Report } from "../../src/api/report";
import { listMyResults, type SessionResult } from "../../src/api/results";
import { Disclaimer } from "../../src/components/Disclaimer";
import { LongitudinalReport } from "../../src/components/LongitudinalReport";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { SessionsDashboard } from "../../src/components/SessionsDashboard";
import { StateView } from "../../src/components/StateView";

/**
 * Histórico e tendências do paciente (#16).
 *
 * Lê os `Result` reais do titular (#15). Sem sessões, mostra vazio honesto —
 * antes havia mock aqui, mas exibir sessão fictícia ao lado de medição real
 * confundiria as duas coisas.
 */
export default function PatientHistoryScreen() {
  const [results, setResults] = useState<SessionResult[]>([]);
  const [report, setReport] = useState<Report | null>(null);
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
    // O relatório depende da Analysis estar de pé; sua falha (ex.: 503) não pode
    // esconder as sessões — por isso carrega à parte e some sem alarde.
    try {
      setReport(await getMyReport());
    } catch {
      setReport(null);
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
      <ScreenHeading
        title="Histórico"
        lead="Suas sessões registradas e como suas medidas variam ao longo do tempo."
      />

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
        <>
          {report && report.n_sessions > 0 ? <LongitudinalReport report={report} /> : null}
          <SessionsDashboard results={results} />
        </>
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}
