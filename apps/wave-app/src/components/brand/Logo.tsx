import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useTheme, type Theme } from "../../theme";

/**
 * Marca do WaveAI — símbolo do design "Maré" (ADR-0042).
 *
 * O símbolo é uma **onda de traço contínuo** sobre um ladrilho de gradiente
 * que atravessa os dois tons de destaque (paciente → profissional): a mesma
 * marca cobre os dois papéis do produto, sem escolher um lado.
 *
 * Antes da `react-native-svg` (P6-c) isto eram `View`s empilhadas simulando um
 * waveform de barras — o que a onda de verdade agora substitui, na casca, no
 * login e na landing de uma vez só.
 *
 * O traço usa `onAccent`, e as duas pontas do gradiente (`accentPatient` e
 * `accentDoctor`) são pares obrigatórios do `scripts/check-contrast.mjs` — o
 * gradiente inteiro fica coberto pelo verificador, não só as extremidades.
 */

type Props = {
  /** Lado do ladrilho do símbolo. */
  size?: number;
  /** Cor sólida no lugar do gradiente (a casca usa o tom do papel ativo). */
  tint?: string;
  /** Mostra o wordmark "WaveAI" ao lado do símbolo. */
  withWordmark?: boolean;
  /** Subtítulo sob o wordmark (ex.: "bem-estar exploratório"). */
  tagline?: string;
};

export function Logo({ size = 36, tint, withWordmark = false, tagline }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const raio = Math.round(size * 0.29);
  const preenchimento = tint ?? "url(#marca)";

  return (
    <View style={styles.linha}>
      <Svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
        <Defs>
          <LinearGradient id="marca" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.colors.accentPatient} />
            <Stop offset="1" stopColor={t.colors.accentDoctor} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={36} height={36} rx={(raio * 36) / size} fill={preenchimento} />
        <Path
          // A onda do mockup (grade 24) reescalada para a grade 36 do ladrilho.
          d="M9.67 18c2.083 0 2.083-4.167 4.167-4.167s2.083 6.667 4.167 6.667 2.083-6.667 4.166-6.667 2.084 4.167 4.167 4.167"
          stroke={t.colors.onAccent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>

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
