import { StyleSheet, Text, View } from "react-native";

import {
  formatDate,
  formatDuration,
  formatPercent,
  sessionDurationSeconds,
  type SessionResult,
} from "../api/results";
import { colors, spacing } from "../theme";
import { BandBars } from "./charts/BandBars";
import { SignalQuality } from "./charts/SignalQuality";
import { TrendChart, type TrendPoint } from "./charts/TrendChart";
import { Card } from "./Card";

type Props = {
  results: SessionResult[];
  accent?: string;
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
export function SessionsDashboard({ results, accent = colors.patient }: Props) {
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
    <View style={styles.wrapper}>
      {tendencia.length > 0 ? (
        <Card title="Tendência de alfa relativo" accent={accent}>
          <Text style={styles.explicacao}>
            Fração da potência total do sinal na banda alfa (8–13 Hz), sessão a
            sessão.
            {tendencia.length === 1 ? " Com mais sessões, a linha aparece." : ""}
          </Text>
          <TrendChart data={tendencia} accent={accent} formatValue={formatPercent} />
        </Card>
      ) : null}

      {ultima ? (
        <Card
          title="Última sessão"
          subtitle={[
            formatDate(ultima.created_at),
            formatDuration(sessionDurationSeconds(ultima.metrics)),
          ]
            .filter(Boolean)
            .join(" · ")}
          accent={accent}
        >
          {relativas ? (
            <>
              <Text style={styles.secao}>Composição por banda</Text>
              <BandBars relative={relativas} accent={accent} />
            </>
          ) : null}

          {qualidade ? (
            <>
              <Text style={styles.secao}>Qualidade do sinal</Text>
              <SignalQuality quality={qualidade} />
            </>
          ) : null}

          {/* Rastreabilidade: todo resultado carrega a versão do engine. */}
          <Text style={styles.engine}>Motor de análise: {ultima.engine_version}</Text>
        </Card>
      ) : null}

      {results.length > 1 ? (
        <>
          <Text style={styles.tituloLista}>Todas as sessões</Text>
          {[...results].reverse().map((r) => {
            const duracao = formatDuration(sessionDurationSeconds(r.metrics));
            const alfa = r.metrics?.rel_alpha;
            return (
              <Card
                key={r.id}
                title={`Sessão de ${formatDate(r.created_at)}`}
                subtitle={[
                  duracao,
                  typeof alfa === "number" ? `alfa ${formatPercent(alfa)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                accent={accent}
              />
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  explicacao: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  secao: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.sm / 2,
  },
  engine: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm / 2,
  },
  tituloLista: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
});
