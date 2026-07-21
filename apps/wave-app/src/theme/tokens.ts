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

const darkColors = {
  background: "#0B1220",
  surface: "#151E32",
  surfaceAlt: "#1C2740",
  /** Divisor decorativo — não carrega significado, pode ter baixo contraste. */
  border: "#243049",
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
};

const lightColors = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceAlt: "#EDF1F7",
  border: "#D7DEE9",
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
 * Alvo mínimo de toque. 44 é o piso das diretrizes de acessibilidade das duas
 * plataformas — abaixo disso, o controle fica difícil de acertar.
 */
export const MIN_TOUCH = 44;
