import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../../theme";

/**
 * Marca do WaveAI (P6-c) — derivada dos tokens, **sem dependência nativa**.
 *
 * O símbolo é um "waveform" de barras arredondadas sobre um ladrilho no tom de
 * destaque: conversa com o `BandBars` (a análise por banda é o coração do
 * produto) e é honesto — nada de reproduzir o mockup clínico. Construído com
 * `View`s, como os gráficos, para não puxar `react-native-svg`.
 *
 * `assets/logo.svg` guarda a mesma marca em vetor (fonte para gerar os PNGs de
 * ícone/splash quando o pipeline de build existir — P5/EAS).
 */

/** Alturas relativas das barras do waveform (0..1 da altura interna). */
const BARRAS = [0.45, 0.8, 0.6, 1, 0.55];

type Props = {
  /** Lado do ladrilho do símbolo. */
  size?: number;
  /** Cor do ladrilho (padrão: destaque do paciente = cor primária da marca). */
  tint?: string;
  /** Mostra o wordmark "WaveAI" ao lado do símbolo. */
  withWordmark?: boolean;
  /** Subtítulo sob o wordmark (ex.: "análise de bem-estar"). */
  tagline?: string;
};

export function Logo({ size = 36, tint, withWordmark = false, tagline }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = tint ?? t.colors.accentPatient;

  const raio = Math.round(size * 0.28);
  const alturaInterna = size * 0.56;
  const larguraBarra = Math.max(2, Math.round(size * 0.1));

  return (
    <View style={styles.linha}>
      <View
        style={[
          styles.simbolo,
          { width: size, height: size, borderRadius: raio, backgroundColor: cor },
        ]}
      >
        {BARRAS.map((h, i) => (
          <View
            key={i}
            style={{
              width: larguraBarra,
              height: Math.round(alturaInterna * h),
              borderRadius: larguraBarra / 2,
              backgroundColor: t.colors.onAccent,
            }}
          />
        ))}
      </View>

      {withWordmark ? (
        <View style={styles.textos}>
          <Text style={styles.nome}>WaveAI</Text>
          {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    linha: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    simbolo: {
      alignItems: "center",
      flexDirection: "row",
      gap: Math.max(2, t.spacing.xs / 2),
      justifyContent: "center",
    },
    textos: {
      flexShrink: 1,
    },
    nome: {
      ...t.typography.heading,
      color: t.colors.text,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    tagline: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
  });
