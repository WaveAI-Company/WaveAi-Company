import { useCallback, useMemo, useState } from "react";
import { Platform, type ViewStyle } from "react-native";

import { withAlpha } from "./color";
import { easing, motion } from "./motion";
import { useReduzirMovimento } from "./useReduzirMovimento";

/**
 * Estados de interação do design "Maré" (P8-a).
 *
 * **O problema que isto resolve:** o porte da P7 reduziu toda interação a
 * `opacity: 0.6` no toque. O mockup do Fable tem uma gramática inteira — o
 * botão sobe 1px e ganha um halo no ponteiro, o campo acende um anel ao
 * receber foco, a linha de lista pinta o fundo — e essa gramática é o que faz
 * a interface parecer viva. Reproduzi-la à mão em cada componente garantiria
 * divergência; aqui ela vira vocabulário.
 *
 * **Hover é web por natureza.** Em touch não existe ponteiro pairando, então
 * `hovered` fica sempre falso no celular — e isso está certo: o mockup é HTML,
 * e o que ele descreve como hover é feedback de ponteiro. O que precisa
 * funcionar nas duas pontas (`pressed`, foco) funciona.
 */

export type EstadoInteracao = {
  /** Ponteiro pairando. Sempre `false` onde não há ponteiro. */
  hovered: boolean;
  pressed: boolean;
  /**
   * Foco que **merece anel visível** — isto é, foco que veio do teclado.
   * Clicar num botão dá foco a ele, e desenhar o anel nesse caso deixa a
   * interface piscando para quem usa mouse.
   */
  focoVisivel: boolean;
};

type Handlers = {
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

/**
 * Última modalidade de entrada usada, em módulo e não em estado de React:
 * quem pergunta é o `onFocus`, que dispara **depois** do evento que causou o
 * foco. Um `useState` aqui chegaria sempre um render atrasado.
 *
 * Sem equivalente pronto no RN-web: `:focus-visible` é CSS e não alcança um
 * `Pressable`, que estiliza por callback.
 */
let modalidadeTeclado = false;

if (Platform.OS === "web" && typeof document !== "undefined") {
  // Fase de captura: registra a modalidade antes de qualquer handler da árvore.
  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      // Só teclas que **movem** o foco. Digitar dentro de um campo não deve
      // fazer o resto da tela passar a se achar navegada por teclado.
      if (e.key === "Tab" || e.key.startsWith("Arrow")) modalidadeTeclado = true;
    },
    true,
  );
  document.addEventListener("pointerdown", () => {
    modalidadeTeclado = false;
  }, true);
}

/** Em nativo, foco só chega por teclado externo, D-pad ou leitor: sempre visível. */
const focoVeioDoTeclado = () => (Platform.OS === "web" ? modalidadeTeclado : true);

/**
 * Estado de interação + handlers para espalhar num `Pressable`.
 *
 * Uso: `const { estado, handlers } = useInteracao();` e então
 * `<Pressable {...handlers} style={[base, estado.hovered && ...]}>`.
 *
 * O `pressed` vem daqui e não do callback `({ pressed })` do `Pressable` de
 * propósito: assim os três estados moram no mesmo lugar e podem ser combinados
 * num único array de estilos, sem metade vir de fora.
 */
export function useInteracao() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focoVisivel, setFocoVisivel] = useState(false);
  const reduzirMovimento = useReduzirMovimento();

  const onFocus = useCallback(() => setFocoVisivel(focoVeioDoTeclado()), []);

  const handlers = useMemo<Handlers>(
    () => ({
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
      onPressIn: () => setPressed(true),
      onPressOut: () => setPressed(false),
      onFocus,
      onBlur: () => setFocoVisivel(false),
    }),
    [onFocus],
  );

  const estado = useMemo<EstadoInteracao>(
    () => ({ hovered, pressed, focoVisivel }),
    [hovered, pressed, focoVisivel],
  );

  return { estado, handlers, reduzirMovimento };
}

/**
 * Transição CSS — **só no web**.
 *
 * Em nativo não existe transição declarativa de estilo, e o comportamento
 * idiomático das duas plataformas é o toque responder na hora. Então o web
 * ganha a curva do Fable e o celular ganha resposta imediata; nenhum dos dois
 * fica errado.
 *
 * O cast existe porque os tipos do RN não conhecem as props de transição
 * (mesma história do `outlineStyle`) — o RN-web as consome normalmente.
 */
export function transicao(
  propriedades: string,
  /**
   * Uma duração para tudo, ou uma por propriedade — o mockup move a
   * transformação em `.15s` e a cor/sombra em `.2s`, e essa diferença é
   * perceptível: o botão salta e o halo o alcança.
   */
  duracao: number | number[] = motion.media,
  curva: string = easing.padrao,
): ViewStyle {
  if (Platform.OS !== "web") return {};
  const duracoes = Array.isArray(duracao) ? duracao : [duracao];
  return {
    transitionProperty: propriedades,
    transitionDuration: duracoes.map((ms) => `${ms}ms`).join(", "),
    transitionTimingFunction: curva,
  } as unknown as ViewStyle;
}

/**
 * Apaga o contorno de foco do **navegador**.
 *
 * Use **sempre junto** com `anelFoco`/`anelCampo`, nunca sozinho: sem um anel
 * próprio no lugar, isto deixaria quem navega por teclado sem saber onde está.
 *
 * Existe porque o RN-web não desliga o `outline: auto` do agente de usuário, e
 * o smoke da P8-a flagrou os dois desenhando ao mesmo tempo — um traço laranja
 * de 1px do Chrome em volta do anel turquesa do design.
 *
 * Cast pelo mesmo motivo das transições: `outlineStyle` não existe nos tipos
 * do RN (só no RN-web).
 */
export function semContornoNativo(): ViewStyle {
  if (Platform.OS !== "web") return {};
  return { outlineStyle: "none" } as unknown as ViewStyle;
}

/**
 * Deslocamento vertical do hover, obedecendo "reduzir movimento".
 *
 * Quem pediu menos movimento **continua vendo** o estado de hover: a sombra e
 * a borda ficam, só o pulo sai. Feedback não é ornamento.
 */
export function elevar(y: number, reduzirMovimento: boolean): ViewStyle {
  return reduzirMovimento ? {} : { transform: [{ translateY: y }] };
}

/**
 * `--accent-soft` do mockup: o próprio destaque, bem diluído — halo de hover e
 * anel de foco de campo. É deliberadamente fraco; **não** carrega informação
 * sozinho, sempre acompanha uma mudança de borda ou de posição.
 *
 * **O alfa muda com o tema (P8-c):** 12% no escuro e 10% no claro, como no
 * mockup. Não é capricho — sobre fundo claro o mesmo alfa rende um halo mais
 * pesado, porque a diferença de luminância entre o destaque e o fundo é maior.
 */
export const accentSoft = (accent: string, escuro: boolean) =>
  withAlpha(accent, escuro ? 0.12 : 0.1);

/** Halo do botão primário no ponteiro: `0 6px 18px var(--accent-soft)`. */
export const sombraDestaque = (accent: string, escuro: boolean) =>
  `0px 6px 18px ${accentSoft(accent, escuro)}, 0px 2px 6px rgba(0, 0, 0, 0.15)`;

/**
 * Anel de foco de teclado: equivale a `outline: 2px solid accent` com
 * `outline-offset: 2px` do mockup.
 *
 * Feito com `boxShadow` e não `outline*` por duas razões: `outlineOffset` não
 * existe nos tipos do RN, e a sombra acompanha o `borderRadius` do controle —
 * o `outline` do navegador desenharia um retângulo por cima de um botão
 * arredondado.
 *
 * O primeiro anel é da cor do **fundo**, e é ele que cria o respiro de 2px.
 */
export const anelFoco = (accent: string, fundo: string) =>
  `0px 0px 0px 2px ${fundo}, 0px 0px 0px 4px ${accent}`;

/** Anel suave de foco de campo: `0 0 0 3px var(--accent-soft)`. */
export const anelCampo = (accent: string, escuro: boolean) =>
  `0px 0px 0px 3px ${accentSoft(accent, escuro)}`;

/** Junta sombras não vazias numa única `boxShadow`. */
export const comporSombras = (...partes: (string | false | null | undefined)[]) =>
  partes.filter(Boolean).join(", ");
