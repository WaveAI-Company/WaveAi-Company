import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { useRoleAccent, useTheme, type Theme } from "../../theme";
import { TrendChart, type TrendPoint } from "./TrendChart";

type Props = {
  /** Histórico das potências **relativas** por janela (o servidor calcula). */
  history: Array<Record<string, number>>;
  accent?: string;
};

/**
 * Gráfico ao vivo de **uma banda por vez** ao longo da sessão (P1-c).
 *
 * Mostra a fração da banda escolhida janela a janela — o sinal "oscilando" em
 * tempo real, mas de um jeito que informa (qual banda, quanto varia). Os
 * valores vêm das features que o **servidor** já manda (`onFeatures`); nada é
 * calculado no cliente.
 *
 * **Uma banda por vez, com seletor**, de propósito: sobrepor cinco linhas
 * coloridas sugeriria que alguma banda é a "certa" — a mesma razão pela qual o
 * `BandBars` usa uma cor só. Aqui a cor é do estado (seleção), não da banda.
 */
export function LiveBandTrend({ history, accent }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

  const [banda, setBanda] = useState<BandKey>("alpha");

  const data: TrendPoint[] = history.map((janela, i) => ({
    value: janela[banda] ?? 0,
    // O TrendChart só rotula a primeira e a última posição do eixo x.
    label: i === 0 ? "início" : i === history.length - 1 ? "agora" : "",
  }));

  const atual = history.length > 0 ? history[history.length - 1][banda] : undefined;

  return (
    <View style={styles.wrapper}>
      {/* Seletor: a cor marca a SELEÇÃO, não uma banda "melhor". */}
      <View style={styles.seletor}>
        {BANDS.map(({ key, label }) => {
          const ativa = key === banda;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={`Ver banda ${label}`}
              onPress={() => setBanda(key)}
              style={[
                styles.chip,
                ativa
                  ? { backgroundColor: cor, borderColor: cor }
                  : { borderColor: t.colors.borderStrong },
              ]}
            >
              <Text
                style={[
                  styles.chipTexto,
                  { color: ativa ? t.colors.onAccent : t.colors.text },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {atual !== undefined ? (
        <Text style={styles.atual}>
          {BANDS.find((b) => b.key === banda)?.label}: {formatPercent(atual)} agora
        </Text>
      ) : null}

      {data.length >= 2 ? (
        <TrendChart
          data={data}
          accent={cor}
          formatValue={formatPercent}
          accessibilityLabel={`Variação ao vivo da banda selecionada ao longo de ${data.length} leituras.`}
        />
      ) : (
        <Text style={styles.aguardando}>
          Coletando leituras… a linha aparece quando houver ao menos duas.
        </Text>
      )}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    seletor: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.xs,
    },
    chip: {
      borderRadius: t.radius.pill,
      borderWidth: 1,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
    },
    chipTexto: {
      ...t.typography.label,
    },
    atual: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 13,
    },
    aguardando: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
  });
