/**
 * Tokens do design system (#18).
 *
 * **Semânticos, não literais:** as telas pedem `text`, `surface`, `accent` —
 * nunca um hex. É isso que permite trocar o tema inteiro sem tocar em tela.
 *
 * As cores de destaque **mudam entre os temas**, e isso não é capricho: o
 * turquesa que rende 10:1 sobre o fundo escuro cai para ~1,8:1 sobre branco,
 * ilegível como texto. Por isso cada tema tem seu par `accentX` (preenchimento)
 * e `accentXText` (texto), validados por `scripts/check-contrast.mjs`.
 */

export type ThemeName = "dark" | "light";
export type Role = "patient" | "doctor";

/**
 * O que a pessoa escolheu: seguir o sistema (padrão) ou fixar um tema.
 *
 * O seletor existe porque `userInterfaceStyle` do Expo é resolvido em **tempo
 * de build** e, no Android, exige `expo-system-ui` — dependência nativa. Sem
 * ela, o app fica preso a um tema no aparelho por mais que o sistema mude.
 * Este override é puro JavaScript e funciona em qualquer build.
 */
export type ThemePreference = "system" | "light" | "dark";

const darkColors = {
  background: "#0B1220",
  surface: "#151E32",
  surfaceAlt: "#1C2740",
  /** Terceiro nível de elevação — fundo de controle dentro de um cartão. */
  surfaceStrong: "#233152",
  /** Divisor decorativo — não carrega significado, pode ter baixo contraste. */
  border: "#243049",
  /** Divisor ainda mais discreto (separar seções dentro do mesmo cartão). */
  borderSoft: "#1B2438",
  /** Limite de controle interativo: exige 3:1 (WCAG 1.4.11) — inclusive
   *  sobre `surface`, que é o fundo mais claro e portanto o caso limite. */
  borderStrong: "#5F719A",
  text: "#F5F7FA",
  textMuted: "#9AA7BD",
  /** Texto sobre preenchimento de destaque. */
  onAccent: "#0B1220",
  accentPatient: "#4FD1C5",
  accentPatientText: "#4FD1C5",
  accentDoctor: "#7AA2F7",
  accentDoctorText: "#7AA2F7",
  warning: "#F2C94C",
  warningText: "#F2C94C",
  danger: "#F2777A",
  dangerText: "#F2777A",
  // Bandas: cores **categóricas**, não uma escala. Ver `BAND_COLORS`.
  bandDelta: "#5C7CFA",
  bandTheta: "#CC5C7E",
  bandAlpha: "#1FA695",
  bandBeta: "#C98500",
  bandGamma: "#9085E9",
};

const lightColors = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceAlt: "#EDF1F7",
  surfaceStrong: "#E2E8F1",
  border: "#D7DEE9",
  borderSoft: "#E8EDF4",
  borderStrong: "#6B7890",
  text: "#0F1726",
  textMuted: "#55637A",
  onAccent: "#FFFFFF",
  // Preenchimentos escuros o suficiente para texto branco por cima…
  accentPatient: "#0F7A70",
  accentDoctor: "#2A5BC7",
  warning: "#8A6100",
  danger: "#B3261E",
  // …e os mesmos tons servem como texto sobre fundo claro.
  accentPatientText: "#0F7A70",
  accentDoctorText: "#2A5BC7",
  warningText: "#8A6100",
  dangerText: "#B3261E",
  bandDelta: "#3E63DD",
  bandTheta: "#963061",
  bandAlpha: "#00857A",
  bandBeta: "#A96C00",
  bandGamma: "#6D5AC4",
};

export const palettes: Record<ThemeName, typeof darkColors> = {
  dark: darkColors,
  light: lightColors,
};

/**
 * Escala tipográfica com **fontes do sistema**.
 *
 * Sem `expo-font` de propósito: fonte customizada é dependência **nativa**, e
 * dependência nativa exige recompilar o app a cada mudança — o que já custou
 * caro na #17. Identidade aqui vem de escala, peso e ritmo, não do desenho da
 * letra.
 */
export const typography = {
  display: { fontSize: 32, fontWeight: "700", lineHeight: 38 },
  title: { fontSize: 26, fontWeight: "700", lineHeight: 32 },
  heading: { fontSize: 17, fontWeight: "600", lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "400", lineHeight: 18 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Cor por banda — **categórica, nunca uma escala**.
 *
 * Cada banda ganha um matiz próprio só para poder ser seguida de um gráfico a
 * outro. Não há gradiente de "pior para melhor" e nenhum tom é mais quente ou
 * mais alarmante que os outros de propósito: banda **não tem valência**, e
 * pintar alfa de verde ou beta de vermelho inventaria um juízo que a análise
 * não faz (ADR-0027).
 *
 * Os tons vêm do design "Maré", com dois ajustes de contraste: teta no escuro e
 * alfa/beta no claro foram abertos até passarem de 3:1 **sobre o trilho da
 * barra** (`surfaceAlt`), que é o fundo real do preenchimento — não sobre a
 * superfície do cartão.
 */
export const BAND_COLORS = {
  delta: "bandDelta",
  theta: "bandTheta",
  alpha: "bandAlpha",
  beta: "bandBeta",
  gamma: "bandGamma",
} as const;

/**
 * Elevação — sombra difusa e discreta, igual nos dois temas.
 *
 * Fica **fora** das paletas de propósito: sombra é profundidade, não cor de
 * conteúdo, e nenhum texto se apoia nela para ser legível.
 */
export const shadows = {
  /**
   * `boxShadow` e não as props `shadow*`: estas ficaram depreciadas no RN 0.86
   * e avisam no console a cada render. A forma em string vale nas duas pontas
   * (nativo na arquitetura nova e web).
   */
  card: {
    boxShadow: "0px 10px 24px rgba(2, 6, 16, 0.18)",
  },
} as const;

/**
 * Alvo mínimo de toque. 44 é o piso das diretrizes de acessibilidade das duas
 * plataformas — abaixo disso, o controle fica difícil de acertar.
 */
export const MIN_TOUCH = 44;
