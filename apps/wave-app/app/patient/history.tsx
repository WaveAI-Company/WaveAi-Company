import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getMyReport, type LongitudinalReport as Report } from "../../src/api/report";
import {
  dias,
  formatDuration,
  formatNumber,
  formatPercent,
  listMyResults,
  sessionDurationSeconds,
  type PeriodoOpcao,
  type SessionResult,
} from "../../src/api/results";
import { capturaDisponivel } from "../../src/capture/availability";
import { Button } from "../../src/components/Button";
import { Disclaimer } from "../../src/components/Disclaimer";
import { HeadFigure } from "../../src/components/brand/HeadFigure";
import { LongitudinalReport } from "../../src/components/LongitudinalReport";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SegmentedFilter } from "../../src/components/SegmentedFilter";
import { SessionAnnotation } from "../../src/components/SessionAnnotation";
import { SessionsDashboard } from "../../src/components/SessionsDashboard";
import { SessionRow } from "../../src/components/sessions/SessionRow";
import { Skeleton } from "../../src/components/Skeleton";
import { StateView } from "../../src/components/StateView";
import {
  larguras,
  useFaixa,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../src/theme";

/** A partir daqui a linha do tempo e o resumo ficam lado a lado. */
// `.sess-grid` do mockup: `minmax(0,1fr) 320px` acima de 1199, uma coluna
// abaixo.

/** Rótulos como o mockup do paciente escreve (`sessoes.html:342`). */
const PERIODOS: Array<{ value: PeriodoOpcao; label: string }> = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "tudo", label: "Tudo" },
];

/** Sessão mais recente (por data) — alvo da anotação editável no histórico. */
function maisRecente(results: SessionResult[]): SessionResult | null {
  return results.reduce<SessionResult | null>(
    (mr, r) => (mr === null || r.created_at > mr.created_at ? r : mr),
    null,
  );
}

/** Agrupa por mês, do mais recente para o mais antigo. */
function porMes(results: SessionResult[]): Array<{ titulo: string; sessoes: SessionResult[] }> {
  const grupos = new Map<string, SessionResult[]>();
  // `results` chega do mais antigo ao mais recente; a linha do tempo lê ao contrário.
  for (const r of [...results].reverse()) {
    const d = new Date(r.created_at);
    const chave = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const atual = grupos.get(chave);
    if (atual) atual.push(r);
    else grupos.set(chave, [r]);
  }
  return [...grupos.entries()].map(([chave, sessoes]) => {
    const [ano, mes] = chave.split("-").map(Number);
    const nome = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long" });
    return {
      titulo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`,
      sessoes,
    };
  });
}

/**
 * Histórico e tendências do paciente — porte de `Design/round1/sessoes.html`
 * (ADR-0042).
 *
 * Lê os `Result` reais do titular (#15). Sem sessões, mostra vazio honesto —
 * antes havia mock aqui, mas exibir sessão fictícia ao lado de medição real
 * confundiria as duas coisas.
 */
export default function PatientHistoryScreen() {
  const t = useTheme();
  const papel = useRoleAccent();
  const router = useRouter();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const emColunas = useFaixa() === "largo";

  const [results, setResults] = useState<SessionResult[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Padrão **30 dias**, como o design marca (`sessoes.html`, botão com `.on`).
   * O estado vazio diz explicitamente como ver tudo — sem isso, quem capta de
   * vez em quando abriria a tela vazia e leria "perdi meus dados".
   */
  const [periodo, setPeriodo] = useState<PeriodoOpcao>("30");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setResults(await listMyResults(dias(periodo)));
    } catch {
      setErro("Não foi possível carregar suas sessões.");
    } finally {
      setLoading(false);
    }
    // O relatório depende da Analysis estar de pé; sua falha (ex.: 503) não pode
    // esconder as sessões — por isso carrega à parte e some sem alarde.
    try {
      setReport(await getMyReport(dias(periodo)));
    } catch {
      setReport(null);
    }
  }, [periodo]);

  // Recarrega **ao focar**, não só ao montar: voltando de uma captação, a
  // sessão recém-encerrada precisa aparecer sem recarregar o app (#17).
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  // O recorte é do **servidor** (P9-b): `results` já vem só com a janela
  // pedida. Antes o filtro era do cliente e a tela misturava dois períodos —
  // sessões filtradas aqui, qualidade e tendências vindas do histórico inteiro.
  const filtradas = results;

  // Resumo do período: médias **descritivas**, sem veredito (ADR-0027).
  const resumo = useMemo(() => {
    const duracoes = filtradas
      .map((r) => sessionDurationSeconds(r.metrics))
      .filter((s): s is number => typeof s === "number");
    const alfas = filtradas
      .map((r) => r.metrics?.rel_alpha)
      .filter((v): v is number => typeof v === "number");
    return {
      sessoes: filtradas.length,
      tempo: duracoes.length > 0 ? duracoes.reduce((a, b) => a + b, 0) : null,
      alfaMedio: alfas.length > 0 ? alfas.reduce((a, b) => a + b, 0) / alfas.length : null,
      // A qualidade média vem do relatório longitudinal, que é quem calcula
      // isso no servidor — o app não deriva um índice próprio.
      qualidade: report?.report.quality?.mean ?? null,
    };
  }, [filtradas, report]);

  const grupos = useMemo(() => porMes(filtradas), [filtradas]);
  /**
   * "Nunca captou" e "captou, mas não neste recorte" são coisas diferentes — e
   * confundi-las diria a alguém com histórico que ela não tem nenhum. O convite
   * da primeira sessão só aparece com o período em "Tudo".
   */
  const pronto = !loading && !erro;
  const nuncaCaptou = pronto && results.length === 0 && periodo === "tudo";
  //: A moldura (título + seletor) fica de pé mesmo com a janela vazia: é ela
  //: que dá a saída do recorte. Escondê-la prenderia a pessoa no filtro.
  const temSessoes = pronto && !nuncaCaptou;

  return (
    <ScreenContainer largura="app">
      {loading ? (
        <>
          <Text style={styles.carregandoNota}>Buscando suas sessões no servidor…</Text>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.esqueletoLinha}>
              <Skeleton width={52} height={56} radius={t.radius.md} />
              <View style={styles.esqueletoMeta}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="65%" height={12} />
              </View>
              <Skeleton width={140} height={14} />
            </View>
          ))}
        </>
      ) : null}

      <StateView error={erro} />

      {/* Vazio: convite, não erro — a tela ainda não tem o que mostrar. */}
      {nuncaCaptou ? (
        <Panel>
          <View style={styles.vazio}>
            <HeadFigure width={190} />
            <Text style={styles.vazioTitulo}>Seu histórico começa na primeira onda</Text>
            <Text style={styles.vazioTexto}>
              Cada sessão que você fizer aparece aqui, com composição por banda, qualidade
              do sinal e as suas notas de contexto — uma linha do tempo do seu bem-estar.
            </Text>
            {capturaDisponivel() ? (
              <View style={styles.vazioAcao}>
                <Button
                  label="Iniciar primeira sessão"
                  onPress={() => router.push("/patient/live")}
                  accent={papel.accent}
                />
              </View>
            ) : (
              <Text style={styles.vazioNota}>
                A captação acontece no app do celular. Por aqui você acompanha o histórico
                assim que a primeira sessão existir.
              </Text>
            )}
          </View>
        </Panel>
      ) : null}

      {temSessoes ? (
        <>
          <View style={styles.topo}>
            <View style={styles.topoTextos}>
              <Text style={styles.titulo}>Suas sessões</Text>
              <Text style={styles.subtitulo}>
                {/* O mockup diz "mostrando 8 de 12", mas o total só existiria
                    com uma segunda busca sem recorte — pedir o histórico
                    inteiro só para exibir um número desfaria a minimização que
                    o corte no servidor comprou. Dizemos o que sabemos. */}
                {`${results.length} ${results.length === 1 ? "sessão" : "sessões"}`}
                {periodo === "tudo" ? "" : ` nos últimos ${periodo} dias`}
              </Text>
            </View>
            <SegmentedFilter
              label="Período"
              options={PERIODOS}
              value={periodo}
              onChange={setPeriodo}
              accent={papel.accent}
            />
          </View>

          <View style={[styles.grade, emColunas && styles.gradeLinha]}>
            <View style={styles.coluna}>
              {filtradas.length === 0 ? (
                <Panel>
                  <Text style={styles.vazioTexto}>
                    Nenhuma sessão nos últimos {periodo} dias. Você pode ter captado
                    antes — escolha “Tudo” para ver o histórico inteiro.
                  </Text>
                </Panel>
              ) : (
                grupos.map((grupo) => (
                  <View key={grupo.titulo} style={styles.grupo}>
                    <View style={styles.grupoCabecalho}>
                      <Text style={styles.grupoTitulo}>{grupo.titulo}</Text>
                      <View style={styles.grupoRegua} />
                    </View>
                    {grupo.sessoes.map((r) => (
                      <SessionRow key={r.id} result={r} />
                    ))}
                  </View>
                ))
              )}
            </View>

            <View style={[styles.trilho, emColunas && styles.trilhoLateral]}>
              <Panel
                title="Resumo do período"
                eyebrow={periodo === "tudo" ? "tudo" : `${periodo} dias`}
              >
                <ResumoLinha rotulo="Sessões" valor={String(resumo.sessoes)} />
                <ResumoLinha
                  rotulo="Tempo captado"
                  valor={resumo.tempo !== null ? (formatDuration(resumo.tempo) ?? "—") : "—"}
                />
                <ResumoLinha
                  rotulo="Qualidade média do sinal"
                  valor={
                    resumo.qualidade !== null ? `${formatNumber(resumo.qualidade, 2)} (0–1)` : "—"
                  }
                />
                <ResumoLinha
                  rotulo="Alfa relativa média"
                  valor={resumo.alfaMedio !== null ? formatPercent(resumo.alfaMedio) : "—"}
                  cor={t.colors.bandAlpha}
                />
                <Text style={styles.resumoNota}>
                  Médias descritivas do período — sem veredito. As bandas não têm valência.
                </Text>
              </Panel>

              {capturaDisponivel() ? (
                <Button
                  label="Iniciar nova sessão"
                  onPress={() => router.push("/patient/live")}
                  accent={papel.accent}
                />
              ) : null}
            </View>
          </View>

          {report && report.n_sessions > 0 ? <LongitudinalReport report={report} /> : null}
          {/* A lista fica desligada: a linha do tempo acima já lista as
              sessões, e duas listas iguais na mesma página são ruído. */}
          <SessionsDashboard results={results} showAllSessions={false} />

          {/* Anotação de contexto (P2, ADR-0037) da sessão mais recente. */}
          {(() => {
            const alvo = maisRecente(results);
            return alvo ? (
              <Panel title="Nota de contexto" eyebrow="sessão mais recente">
                <SessionAnnotation sessionId={alvo.session_id} mode="edit" embedded />
              </Panel>
            ) : null;
          })()}
        </>
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

/** Linha do resumo: rótulo à esquerda, valor à direita. */
function ResumoLinha({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  return (
    <View style={styles.resumoLinha}>
      <Text style={styles.resumoRotulo}>{rotulo}</Text>
      <Text style={[styles.resumoValor, cor ? { color: cor } : null]}>{valor}</Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    carregandoNota: {
      ...t.typography.body,
      color: t.colors.textSubtle,
      fontSize: 14,
    },
    esqueletoLinha: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderSoft,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.spacing.md,
    },
    esqueletoMeta: {
      flex: 1,
      gap: t.spacing.sm,
    },
    topo: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
    },
    topoTextos: {
      flex: 1,
      gap: 2,
      minWidth: 180,
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    subtitulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    grade: {
      gap: t.spacing.md,
    },
    gradeLinha: {
      alignItems: "flex-start",
      flexDirection: "row",
    },
    coluna: {
      flex: 1,
      gap: t.spacing.md,
      minWidth: 0,
    },
    trilho: {
      gap: t.spacing.md,
    },
    trilhoLateral: {
      flexGrow: 0,
      flexShrink: 0,
      width: larguras.trilhoSessoes,
    },
    grupo: {
      gap: t.spacing.sm,
    },
    grupoCabecalho: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    grupoTitulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    grupoRegua: {
      backgroundColor: t.colors.borderSoft,
      flex: 1,
      height: 1,
    },
    resumoLinha: {
      alignItems: "center",
      borderBottomColor: t.colors.borderSoft,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: t.spacing.sm,
      justifyContent: "space-between",
      paddingVertical: t.spacing.sm,
    },
    resumoRotulo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
    },
    resumoValor: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    resumoNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    vazio: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.lg,
    },
    vazioTitulo: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: "center",
    },
    vazioTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 460,
      textAlign: "center",
    },
    vazioNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      maxWidth: 420,
      textAlign: "center",
    },
    vazioAcao: {
      marginTop: t.spacing.sm,
      minWidth: 240,
    },
  });
