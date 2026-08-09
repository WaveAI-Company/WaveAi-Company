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
  /**
   * Divisor decorativo — não carrega significado, pode ter baixo contraste.
   *
   * **Com alfa e não sólido (P8-c):** é assim no mockup, e a diferença é real
   * — a mesma borda resulta em `#2B3446` sobre um cartão e `#222936` sobre o
   * fundo da página. Um valor sólido acerta um dos dois e erra o outro.
   */
  border: "rgba(245, 247, 250, 0.10)",
  /** Divisor ainda mais discreto (separar seções dentro do mesmo cartão). */
  borderSoft: "rgba(245, 247, 250, 0.055)",
  /** Limite de controle interativo: exige 3:1 (WCAG 1.4.11) — inclusive
   *  sobre `surface`, que é o fundo mais claro e portanto o caso limite.
   *  Segue **sólido**: é o único limite que carrega requisito, e com alfa o
   *  contraste passaria a depender do que estiver atrás. */
  borderStrong: "#5F719A",
  text: "#F5F7FA",
  /**
   * Texto de apoio — o `--ink-2` do mockup.
   *
   * **Eram um só (P8-c).** O design tem **dois** níveis abaixo do texto
   * principal, e o nosso `textMuted` caía exatamente no meio dos dois: tudo
   * que era secundário saía com o mesmo peso, e a hierarquia achatava.
   */
  textMuted: "#B6C1D4",
  /** Terceiro nível — legenda, unidade, ressalva, sobrancelha, placeholder. */
  textSubtle: "#8291A9",
  /** Texto sobre preenchimento que **não** é de papel (estado, alerta). */
  onAccent: "#0B1220",
  /**
   * Texto sobre o preenchimento de cada papel.
   *
   * O mockup **tinge** essa tinta com o matiz do próprio destaque — um
   * verde-escuro sobre o turquesa, um azul-escuro sobre o azul — em vez de
   * reusar o fundo da página, que era o que fazíamos.
   */
  onAccentPatient: "#06231F",
  onAccentDoctor: "#0A1430",
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
  surfaceAlt: "#EDF1F6",
  surfaceStrong: "#E2E8F1",
  border: "rgba(15, 23, 38, 0.12)",
  borderSoft: "rgba(15, 23, 38, 0.06)",
  borderStrong: "#6B7890",
  text: "#0F1726",
  textMuted: "#44526A",
  /**
   * O `--ink-3` do mockup é `#68778F`, e ele **reprova** como texto no tema
   * claro: 4,23 sobre o fundo da página e 4,00 sobre o trilho, contra o mínimo
   * de 4,5. O round 1 nasceu no escuro e não auditou o claro — mesma história
   * do `ok`/`warn`/`bad`.
   *
   * Aqui a **intenção** (um terceiro nível) fica e o valor desce: matiz 216,9°
   * e saturação 0,158 são os do Fable, só a luminosidade caiu de 0,484 para
   * 0,449, o mínimo para passar nos três fundos.
   */
  textSubtle: "#606E85",
  onAccent: "#FFFFFF",
  // No claro os dois papéis convergem para branco, como no mockup: os
  // preenchimentos são escuros o suficiente para sustentá-lo.
  onAccentPatient: "#FFFFFF",
  onAccentDoctor: "#FFFFFF",
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
  bandAlpha: "#009184",
  bandBeta: "#B87500",
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
 * Os tons vêm do design "Maré". **Alfa e beta no claro voltaram ao valor
 * original na P8-c**: eles passavam de 3:1 sobre o trilho (`surfaceAlt`) e o
 * afastamento da P7 era margem, não necessidade.
 *
 * **Teta no escuro continua nosso** (`#CC5C7E` e não `#B24468`): o tom do
 * mockup rende 2,77:1 sobre o trilho e reprova o mínimo de 3:1 da WCAG
 * 1.4.11. É o fundo real do preenchimento — não a superfície do cartão — que
 * manda aqui.
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
