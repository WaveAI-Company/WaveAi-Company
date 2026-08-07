import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatDate, formatNumber } from "../api/results";
import {
  directionSymbol,
  featureLabel,
  type LongitudinalReport as Report,
} from "../api/report";
import { useTheme, type Theme } from "../theme";
import { Panel } from "./Panel";
import { InfoButton } from "./InfoButton";

type Props = {
  report: Report;
  /** Ignorado desde o porte "Maré": o painel não tem faixa de destaque. */
  accent?: string;
};

/**
 * Relatório longitudinal (N6, sobre N5): sumário em linguagem + tendências por
 * medida ao longo das sessões.
 *
 * O `summary` já vem do servidor por **template determinístico** (N5-c) —
 * descritivo e não-clínico. A lista de tendências repete isso de forma
 * escaneável. Nada aqui é veredito: "↑/↓/→" é a direção **numérica** de uma
 * feature, sem cor de "bom/ruim" (não há juízo — honestidade visual, ADR-0027).
 */
export function LongitudinalReport({ report }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const trends = Object.entries(report.report.features);
  // Maior variação primeiro — o que mais mudou fica no topo (|delta_pct|).
  trends.sort((a, b) => Math.abs(b[1].delta_pct) - Math.abs(a[1].delta_pct));

  const periodo = report.period
    ? `${formatDate(report.period.first)} – ${formatDate(report.period.last)}`
    : null;

  return (
    <View style={styles.wrapper}>
      {report.narrative ? (
        // Camada de linguagem por LLM (N6-b): prosa aterrada no sumário.
        // Rotulada como gerada por IA e não-diagnóstica (ADR-0035 / Medical/71).
        <Panel
          title="Panorama das sessões"
          eyebrow={periodo ? `${report.n_sessions} sessões · ${periodo}` : undefined}
        >
          <Text style={styles.sumario}>{report.narrative}</Text>
          <Text style={styles.aiLabel}>
            Texto gerado por IA a partir das suas medidas — não-diagnóstico.
          </Text>
        </Panel>
      ) : report.summary.length > 0 ? (
        <Panel
          title="Panorama das sessões"
          eyebrow={periodo ? `${report.n_sessions} sessões · ${periodo}` : undefined}
        >
          {report.summary.map((linha, i) => (
            <Text key={`sum-${i}`} style={styles.sumario}>
              {linha}
            </Text>
          ))}
        </Panel>
      ) : null}

      {trends.length > 0 ? (
        <Panel
          title="Tendências por medida"
          headerAccessory={<InfoButton term="trend_direction" />}
        >
          <Text style={styles.legenda}>
            Direção da medida ao longo das sessões — descrição, não diagnóstico.
          </Text>
          {trends.map(([chave, tr]) => (
            <View key={chave} style={styles.linha}>
              <Text style={styles.seta} accessibilityLabel={tr.direction}>
                {directionSymbol(tr.direction)}
              </Text>
              <Text style={styles.medida} numberOfLines={1}>
                {featureLabel(chave)}
              </Text>
              <Text style={styles.variacao}>
                {tr.direction === "estável"
                  ? "estável"
                  : `${tr.delta_pct >= 0 ? "+" : ""}${formatNumber(tr.delta_pct, 0)}%`}
              </Text>
              {/* ⓘ por medida: reusa o verbete da própria feature (glossário). */}
              <InfoButton term={chave} />
            </View>
          ))}
        </Panel>
      ) : null}

      {report.engine_version ? (
        <Text style={styles.engine}>Motor de análise: {report.engine_version}</Text>
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.md,
    },
    sumario: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    aiLabel: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
      fontStyle: "italic",
      marginTop: t.spacing.xs,
    },
    legenda: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginBottom: t.spacing.xs,
    },
    linha: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      paddingVertical: 2,
    },
    seta: {
      ...t.typography.bodyStrong,
      color: t.colors.textMuted,
      width: 16,
      textAlign: "center",
    },
    medida: {
      ...t.typography.body,
      color: t.colors.text,
      flex: 1,
      fontSize: 14,
    },
    variacao: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      fontVariant: ["tabular-nums"],
    },
    engine: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
    },
  });
