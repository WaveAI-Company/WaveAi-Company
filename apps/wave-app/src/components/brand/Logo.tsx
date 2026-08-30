import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useTheme, type Theme } from "../../theme";

/**
 * Marca do WaveAI — **símbolo reduzido**: a onda com o ponto, sem o anel.
 *
 * O gradiente atravessa os dois tons de destaque (paciente → profissional): a
 * mesma marca cobre os dois papéis do produto, sem escolher um lado. As duas
 * pontas (`accentPatient` e `accentDoctor`) são pares obrigatórios do
 * `scripts/check-contrast.mjs`, então o gradiente inteiro fica coberto pelo
 * verificador — o que um PNG de marca não permitiria.
 *
 * **Por que sem o anel.** A marca tem duas formas. A completa (anel + onda +
 * ponto) vive em `assets/logo.svg` e serve onde há espaço: hero do site, ficha
 * da loja, material. O traço do anel tem 1,7% da largura da arte — a 36px da
 * sidebar isso dá 1,3px e a 16px do favicon dá 0,6px, ou seja, some. Aqui, onde
 * a marca aparece pequena, entra só a onda, que continua inteira.
 *
 * A geometria vem do desenho aprovado (`Design/logos_icones/logo_escura.png`),
 * extraída por traçado de contorno com fidelidade medida (IoU 98,0%); as cores
 * foram trocadas pelos tokens. O `d` abaixo é gerado, não escrito à mão.
 *
 * Antes disto o símbolo era uma onda de traço fino sobre um ladrilho de
 * gradiente, e os PNGs de ícone eram os do template do `create-expo-app`.
 */

/** Contorno da onda, na grade 512 do `viewBox`. */
const ONDA =
  "M 164.82 134.81 C 169.24 134.61 183.48 134.23 190.21 134.81 C 196.94 135.38 199.25 136.15 205.21 138.27 C 211.18 140.38 220.03 144.23 225.99 147.5 C 231.95 150.77 235.22 153.08 241.0 157.89 C 246.77 162.7 255.23 170.78 260.62 176.36 C 266.0 181.94 263.31 177.51 273.31 191.36 C 283.32 205.21 310.06 245.42 320.64 259.46 C 331.22 273.51 331.99 271.77 336.8 275.62 C 341.61 279.47 344.68 281.2 349.49 282.55 C 354.3 283.89 361.61 283.89 365.65 283.7 C 369.69 283.51 370.46 282.93 373.73 281.39 C 377.0 279.85 379.89 279.28 385.27 274.47 C 390.66 269.66 397.78 263.31 406.05 252.54 C 414.32 241.76 425.86 216.95 434.91 209.83 C 443.95 202.71 458.18 204.44 460.3 209.83 C 462.41 215.22 451.83 229.65 447.6 242.15 C 443.37 254.65 440.48 267.93 434.91 284.86 C 429.33 301.78 419.9 329.29 414.13 343.72 C 408.36 358.15 404.7 363.73 400.28 371.42 C 395.85 379.12 392.97 383.73 387.58 389.89 C 382.2 396.05 372.77 404.32 367.96 408.36 C 363.15 412.4 362.38 412.4 358.73 414.13 C 355.07 415.86 351.8 417.78 346.03 418.75 C 340.26 419.71 329.68 420.09 324.1 419.9 C 318.52 419.71 317.37 419.13 312.56 417.59 C 307.75 416.05 300.44 413.36 295.24 410.67 C 290.05 407.97 287.74 407.01 281.39 401.43 C 275.04 395.85 267.93 390.85 257.15 377.19 C 246.38 363.54 228.11 334.87 216.76 319.48 C 205.41 304.09 197.52 293.9 189.05 284.86 C 180.59 275.81 173.67 270.04 165.97 265.23 C 158.28 260.42 149.81 257.54 142.89 256.0 C 135.96 254.46 129.03 255.62 124.42 256.0 C 119.8 256.38 119.61 256.58 115.18 258.31 C 110.76 260.04 105.18 261.39 97.87 266.39 C 90.56 271.39 79.02 280.43 71.32 288.32 C 63.63 296.21 59.59 309.48 51.7 313.71 C 43.81 317.94 23.23 325.64 24.0 313.71 C 24.77 301.78 48.24 259.27 56.32 242.15 C 64.4 225.03 66.51 221.18 72.48 210.99 C 78.44 200.79 85.17 189.82 92.1 180.98 C 99.02 172.13 107.87 163.47 114.03 157.89 C 120.19 152.31 124.23 150.39 129.03 147.5 C 133.84 144.62 138.08 142.5 142.89 140.58 C 147.69 138.65 154.43 136.73 157.89 135.96 C 161.35 135.19 162.51 136.15 163.66 135.96 C 164.82 135.77 160.39 135.0 164.82 134.81 Z";

type Props = {
  /** Lado do símbolo. */
  size?: number;
  /** Cor sólida no lugar do gradiente (a casca usa o tom do papel ativo). */
  tint?: string;
  /** Mostra o wordmark "WaveAI" ao lado do símbolo. */
  withWordmark?: boolean;
  /** Subtítulo sob o wordmark (ex.: "bem-estar exploratório"). */
  tagline?: string;
  /**
   * Põe a tagline **na mesma linha** do wordmark, como o `.wordmark` do
   * mockup: `WaveAI <small>bem-estar exploratório</small>`.
   *
   * É prop e não o padrão porque a sidebar não tem largura para isso — nos
   * 240px da coluna de navegação "WaveAI análise de bem-estar" em linha
   * quebraria feio. Empilhado lá, em linha nas telas de autenticação.
   */
  taglineEmLinha?: boolean;
};

export function Logo({
  size = 36,
  tint,
  withWordmark = false,
  tagline,
  taglineEmLinha = false,
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const preenchimento = tint ?? "url(#marcaWave)";

  return (
    <View style={styles.linha}>
      <Svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
        <Defs>
          <LinearGradient id="marcaWave" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.colors.accentPatient} />
            <Stop offset="1" stopColor={t.colors.accentDoctor} />
          </LinearGradient>
        </Defs>
        <Path d={ONDA} fill={preenchimento} />
        <Circle cx={456.46} cy={123.77} r={32.55} fill={preenchimento} />
      </Svg>

      {withWordmark ? (
        <View style={[styles.textos, taglineEmLinha && styles.textosEmLinha]}>
          <Text style={styles.nome}>WaveAI</Text>
          {tagline ? (
            <Text style={[styles.tagline, taglineEmLinha && styles.taglineEmLinha]}>
              {tagline}
            </Text>
          ) : null}
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
    textosEmLinha: {
      alignItems: "baseline",
      flexDirection: "row",
      // Sem quebra a frase transborda: `flexShrink` é 0 por padrão no RN.
      flexWrap: "wrap",
      // O `margin-left:6px` do `small` do mockup.
      gap: 6,
    },
    nome: {
      ...t.typography.heading,
      color: t.colors.text,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    tagline: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    // `.wordmark small{font-size:12px; letter-spacing:.08em; text-transform:uppercase}`.
    taglineEmLinha: {
      fontSize: 12,
      letterSpacing: 0.96,
      textTransform: "uppercase",
    },
  });
