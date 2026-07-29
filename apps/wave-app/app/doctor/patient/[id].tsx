import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { getPatient, type PatientSummary } from "../../../src/api/care";
import { watchPatientLive } from "../../../src/api/liveWatch";
import { getPatientReport, type LongitudinalReport as Report } from "../../../src/api/report";
import { listPatientResults, type SessionResult } from "../../../src/api/results";
import { Button } from "../../../src/components/Button";
import { Disclaimer } from "../../../src/components/Disclaimer";
import { LiveSpectator } from "../../../src/components/LiveSpectator";
import { LongitudinalReport } from "../../../src/components/LongitudinalReport";
import { PatientOverview } from "../../../src/components/PatientOverview";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { ScreenHeading } from "../../../src/components/ScreenHeading";
import { SessionAnnotation } from "../../../src/components/SessionAnnotation";
import { SessionsDashboard } from "../../../src/components/SessionsDashboard";
import { StateView } from "../../../src/components/StateView";
import { useRoleAccent, useTheme, type Theme } from "../../../src/theme";

/** Sessão mais recente (por data) — alvo da anotação lida na tela do médico. */
function maisRecente(results: SessionResult[]): SessionResult | null {
  return results.reduce<SessionResult | null>(
    (mr, r) => (mr === null || r.created_at > mr.created_at ? r : mr),
    null,
  );
}

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
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Assistir ao vivo é opt-in: só ao ativar é que se assina (e audita). */
  const [assistindo, setAssistindo] = useState(false);

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
    // O relatório depende da Analysis; sua falha não pode blindar o resto da
    // tela — carrega à parte e some sem alarde.
    try {
      setReport(await getPatientReport(id));
    } catch {
      setReport(null);
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

          {/* Ao vivo (ADR-0039): opt-in. Ao ativar, assina a transmissão via
              CareLink e a visualização é auditada. Aparece mesmo sem sessões
              guardadas — o paciente pode estar captando agora. */}
          <Text style={styles.secao}>Ao vivo</Text>
          {assistindo && id ? (
            <LiveSpectator
              subscribe={(h) => watchPatientLive(id, h)}
              accent={accent}
              semCaptacaoTexto="O paciente não está captando agora."
            />
          ) : (
            <Button label="Assistir ao vivo" onPress={() => setAssistindo(true)} accent={accent} />
          )}

          {results.length === 0 ? (
            <Text style={styles.vazio}>
              Este paciente ainda não tem sessões registradas.
            </Text>
          ) : (
            <>
              {/* Cockpit (P3): visão geral de relance → relatório → contexto da
                  sessão → detalhe das sessões. O contexto (autorrelato) sobe
                  para perto da análise, para o profissional cruzar os dois. */}
              <PatientOverview results={results} report={report} />

              {report && report.n_sessions > 0 ? (
                <LongitudinalReport report={report} />
              ) : null}

              {/* Autorrelato do paciente (P2, ADR-0037): read-only, da sessão
                  mais recente. A API exige CareLink ativo e audita a leitura. */}
              {(() => {
                const alvo = maisRecente(results);
                return alvo && id ? (
                  <SessionAnnotation sessionId={alvo.session_id} mode="read" patientId={id} />
                ) : null;
              })()}

              <SessionsDashboard results={results} />
            </>
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
    secao: {
      ...t.typography.heading,
      color: t.colors.text,
      marginTop: t.spacing.sm,
    },
  });
