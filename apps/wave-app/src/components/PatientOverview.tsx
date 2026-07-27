import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatDate, formatNumber, type SessionResult } from "../api/results";
import type { LongitudinalReport as Report } from "../api/report";
import { useRoleAccent, useTheme, type Theme } from "../theme";
import { Card } from "./Card";

type Props = {
  results: SessionResult[];
  report: Report | null;
  accent?: string;
};

type Tile = { valor: string; rotulo: string };

/**
 * Visão geral do paciente para o cockpit do profissional (P3): os fatos que ele
 * lê de relance antes do detalhe — quantas sessões, qualidade média, última
 * captação. Números descritivos, **sem veredito** (ADR-0027): "qualidade média"
 * é a média do score 0–1, não um selo de "bom/ruim".
 */
export function PatientOverview({ results, report, accent }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

  const nSessoes = report?.n_sessions ?? results.length;

  const maisRecente = results.reduce<SessionResult | null>(
    (mr, r) => (mr === null || r.created_at > mr.created_at ? r : mr),
    null,
  );

  const qualidadeMedia = report?.report.quality?.mean;
  const periodo = report?.period
    ? `${formatDate(report.period.first)} – ${formatDate(report.period.last)}`
    : null;

  const tiles: Tile[] = [
    { valor: String(nSessoes), rotulo: nSessoes === 1 ? "sessão" : "sessões" },
    {
      valor:
        typeof qualidadeMedia === "number" ? formatNumber(qualidadeMedia, 2) : "—",
      rotulo: "qualidade média (0–1)",
    },
    {
      valor: maisRecente ? formatDate(maisRecente.created_at) : "—",
      rotulo: "última captação",
    },
  ];

  return (
    <Card title="Visão geral" subtitle={periodo ?? undefined} accent={cor}>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.rotulo} style={styles.tile}>
            <Text style={[styles.valor, { color: t.colors.text }]}>{tile.valor}</Text>
            <Text style={styles.rotulo}>{tile.rotulo}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    tiles: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.lg,
      marginTop: t.spacing.xs,
    },
    tile: {
      minWidth: 90,
    },
    valor: {
      ...t.typography.title,
      fontSize: 24,
    },
    rotulo: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
  });
