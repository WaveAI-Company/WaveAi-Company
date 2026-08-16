import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  formatDate,
  formatDuration,
  formatPercent,
  sessionDurationSeconds,
  type SessionResult,
} from "../api/results";
import { useRoleAccent, useTheme, type Theme } from "../theme";
import { BandBars } from "./charts/BandBars";
import { SignalQuality } from "./charts/SignalQuality";
import { TrendChart, type TrendPoint } from "./charts/TrendChart";
import { Panel } from "./Panel";
import { SessionRow } from "./sessions/SessionRow";
import { InfoButton } from "./InfoButton";

type Props = {
  results: SessionResult[];
  accent?: string;
  /**
   * Mostra a lista "Todas as sessões" ao final.
   *
   * A tela de histórico do paciente desliga: ela já traz a linha do tempo
   * portada do design, e duas listas das mesmas sessões na mesma página é
   * ruído. A tela do profissional segue com a lista até ganhar a sua.
   */
  showAllSessions?: boolean;
  /**
   * Mostra a "Tendência de alfa relativo".
   *
   * O painel do profissional desliga: o porte do design já abre com o mesmo
   * gráfico como figura principal, e repeti-lo trinta linhas abaixo faria o
   * leitor procurar a diferença entre dois gráficos idênticos.
   */
  showTrend?: boolean;
  /**
   * Mostra o cartão "Última sessão".
   *
   * Existe para o **panorama do histórico** poder pôr a tendência e a última
   * sessão em colunas diferentes: o gráfico ganha com largura, o cartão
   * compacto não. Sem isso os dois viriam sempre colados, um sob o outro.
   */
  showLast?: boolean;
  /**
   * Estica o painel até a altura da célula, para emparelhar com o cartão ao
   * lado. Pensado para quando **um** painel está visível.
   */
  grow?: boolean;
};

/**
 * Dashboard de sessões, compartilhado pelos dois papéis (#16).
 *
 * O paciente vê as próprias sessões; o médico vê as de um paciente autorizado.
 * A leitura é a mesma — o que muda é a origem dos dados e a cor de destaque —,
 * então manter um componente só evita que os dois lados divirjam.
 *
 * `results` chega ordenado do mais antigo ao mais recente.
 */
export function SessionsDashboard({
  results,
  accent,
  showAllSessions = true,
  showTrend = true,
  showLast = true,
  grow,
}: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

  // Só entram sessões que realmente têm a métrica: plotar 0 por ausência
  // inventaria uma medição que não existe.
  const tendencia: TrendPoint[] = results
    .filter((r) => typeof r.metrics?.rel_alpha === "number")
    .map((r) => ({
      value: r.metrics.rel_alpha as number,
      label: formatDate(r.created_at),
    }));

  const ultima = results.length > 0 ? results[results.length - 1] : null;
  const relativas = ultima?.metrics?.relative_band_powers;
  const qualidade = ultima?.metrics?.quality;

  return (
    <View style={[styles.wrapper, grow && styles.cresce]}>
      {showTrend && tendencia.length > 0 ? (
        <Panel
          title="Tendência de alfa relativo"
          headerAccessory={<InfoButton term="rel_alpha" />}
          grow
        >
          <Text style={styles.explicacao}>
            Fração da potência total do sinal na banda alfa (8–13 Hz), sessão a
            sessão.
            {tendencia.length === 1 ? " Com mais sessões, a linha aparece." : ""}
          </Text>
          <TrendChart data={tendencia} accent={cor} formatValue={formatPercent} />
        </Panel>
      ) : null}

      {showLast && ultima ? (
        <Panel
          title="Última sessão"
          grow
          eyebrow={[
            formatDate(ultima.created_at),
            formatDuration(sessionDurationSeconds(ultima.metrics)),
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {relativas ? (
            <>
              <View style={styles.secaoLinha}>
                <Text style={styles.secao}>Composição por banda</Text>
                <InfoButton term="band_composition" />
              </View>
              <BandBars relative={relativas} />
            </>
          ) : null}

          {qualidade ? (
            <>
              <View style={styles.secaoLinha}>
                <Text style={styles.secao}>Qualidade do sinal</Text>
                <InfoButton term="signal_quality" />
              </View>
              <SignalQuality quality={qualidade} />
            </>
          ) : null}

          {/* Rastreabilidade: todo resultado carrega a versão do engine. */}
          <Text style={styles.engine}>Motor de análise: {ultima.engine_version}</Text>
        </Panel>
      ) : null}

      {showAllSessions && results.length > 1 ? (
        <>
          <Text style={styles.tituloLista}>Todas as sessões</Text>
          {/**
           * `SessionRow`, e não o `Panel` de título e sobrancelha que estava
           * aqui.
           *
           * Havia **duas** representações da mesma linha de sessão: esta, que é
           * anterior ao porte, e a do design "Maré" (`sessoes.html`), que o
           * histórico do paciente já usava. A daqui ignorava o
           * `has_annotation` que o servidor manda desde a emenda à ADR-0037 —
           * o painel do profissional recebia a informação de quais sessões têm
           * autorrelato e não a mostrava.
           *
           * O selo diz que a nota **existe**; ler o texto continua sendo um ato
           * à parte e auditado. Nenhuma leitura nova acontece por causa desta
           * troca: o dado vem da mesma chamada que a tela já fazia.
           */}
          {[...results].reverse().map((r) => (
            <SessionRow key={r.id} result={r} />
          ))}
        </>
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cresce: {
      flex: 1,
    },
    wrapper: {
      gap: t.spacing.md,
    },
    explicacao: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    secaoLinha: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
    },
    secao: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    engine: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      marginTop: t.spacing.xs,
    },
    tituloLista: {
      ...t.typography.heading,
      color: t.colors.text,
      marginTop: t.spacing.sm,
    },
  });
