/**
 * Tokens de movimento do design "Maré" (P8-a).
 *
 * Os valores não são invenção nossa: saíram das `transition` declaradas nos
 * mockups do round 1 (`Design/round1/*.html`), onde três durações se repetem —
 * transformação rápida, cor/sombra um pouco mais lenta, e um trecho longo para
 * o que é ornamento de marca.
 *
 * **Por que ficam aqui e não em cada componente:** o Fable usa a *mesma* curva
 * em toda parte, e é essa repetição que faz a interface parecer uma coisa só.
 * Espalhar `.15s` copiado à mão garante que a próxima tela vá divergir.
 */

export const motion = {
  /** Transformação (deslocar, escalar). `transform .15s ease` no mockup. */
  rapida: 150,
  /** Cor, fundo, borda, sombra. `box-shadow .2s ease` no mockup. */
  media: 200,
  /** Aparecer/sumir de blocos maiores. `opacity .25s` no mockup. */
  suave: 250,
} as const;

export const easing = {
  /** O `ease` do CSS — o que o mockup usa em quase tudo. */
  padrao: "ease",
  /** `cubic-bezier(.2,.7,.3,1)`: entra rápido e assenta. Barras e traçados. */
  assenta: "cubic-bezier(.2,.7,.3,1)",
} as const;

export type MotionDuration = (typeof motion)[keyof typeof motion];
