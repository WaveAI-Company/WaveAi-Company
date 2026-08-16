import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import {
  anelFoco,
  comporSombras,
  elevar,
  motion,
  sombraDestaque,
  semContornoNativo,
  transicao,
  useFaixa,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonLargura = "conteudo" | "bloco";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /**
   * `primary` usa o destaque do papel de quem está logado (o "sotaque" da
   * #18); `secondary` é delineado; `danger` marca ação destrutiva.
   */
  variant?: ButtonVariant;
  /** Sobrescreve o destaque — use só quando o papel do botão não for o do usuário. */
  accent?: string;
  /**
   * Quanto o botão ocupa.
   *
   * `conteudo` (padrão) é o `.btn` do mockup: `display:inline-flex`, ou seja,
   * a largura do rótulo mais o respiro — **no celular ele volta a ocupar a
   * linha**, que é o que os mockups fazem em `@media (max-width:767px)` (sete
   * dos nove têm a regra). `bloco` é o `.btn-block`, usado em todos os botões
   * das telas de autenticação.
   */
  largura?: ButtonLargura;
  /**
   * Botão menor — o `padding:0 16px; font-size:13.5px` que os mockups aplicam
   * quando dois botões dividem uma coluna estreita (a dupla da sessão guiada,
   * o par de "Acompanhamento" na home do paciente). É o que devolve largura ao
   * rótulo antes que ele quebre em duas linhas.
   *
   * **A altura não encolhe junto.** O mockup pede `min-height:40px` e o nosso
   * piso de toque é 44; o round 1 é alvo visual, não especificação de
   * acessibilidade, então aqui fica o nosso (ADR-0042 / pente fino).
   */
  compacto?: boolean;
};

/**
 * Botão do design system.
 *
 * **Por que existe `variant` em vez de só uma cor:** antes o rótulo era sempre
 * pintado com a cor de fundo do app, então um botão "secundário" com fundo
 * escuro ficava com texto escuro sobre escuro — 1,42:1, ilegível. A variante
 * decide **fundo e texto juntos**, o que torna esse erro impossível.
 *
 * **Estados (P8-a).** O mockup do Fable descreve o botão preenchido como
 * `hover { translateY(-1px); box-shadow: 0 6px 18px accent-soft }` e
 * `active { translateY(0) }` — ou seja, o botão *sobe* ao ponteiro e *volta*
 * ao ser apertado. O delineado segue o `.btn-ghost`, que só pinta o fundo.
 * O `pressed` mantém uma perda leve de opacidade porque no celular não há
 * hover para de onde voltar: sem isso o toque não teria resposta nenhuma.
 *
 * **Largura (pente fino de UI).** O padrão é a largura do conteúdo, como o
 * `.btn` do mockup. Antes o componente não dizia nada sobre largura, e num pai
 * em coluna — que é o caso quase sempre — o RN estica o filho: todo botão do
 * app saía com 100%, o que o pente fino apontou em sete telas. Quatro delas
 * já remendavam isso à mão, embrulhando o botão num `View` com
 * `alignSelf: "flex-start"`.
 */
export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  accent,
  largura = "conteudo",
  compacto,
}: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers, reduzirMovimento } = useInteracao();
  const faixa = useFaixa();

  // No celular o botão volta a ocupar a linha (o `width:100%` dos mockups em
  // `max-width:767px`). "Volta" no sentido literal: basta não declarar
  // `alignSelf` e o pai em coluna estica de novo — e num pai em linha a
  // largura segue sendo a do conteúdo, que é o que se quer nos dois casos.
  const porConteudo = largura === "conteudo" && faixa !== "movel";

  const inativo = Boolean(loading || disabled);
  const destaque = accent ?? papel.accent;

  const preenchido = variant !== "secondary";
  const fundo = variant === "danger" ? t.colors.danger : destaque;
  const corTexto = preenchido ? papel.onAccent : t.colors.text;

  // Estado inativo não reage: um botão que sobe ao ponteiro mas não obedece
  // promete uma ação que não vai acontecer.
  const reagindo = !inativo;
  const noAr = reagindo && estado.hovered && !estado.pressed;

  const sombra = comporSombras(
    noAr && preenchido && sombraDestaque(fundo, t.isDark),
    estado.focoVisivel && anelFoco(destaque, t.colors.background),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: Boolean(loading) }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={inativo}
      {...handlers}
      style={[
        styles.base,
        compacto && styles.compacto,
        porConteudo && styles.porConteudo,
        preenchido ? { backgroundColor: fundo } : styles.delineado,
        // O delineado ganha o fundo do `.btn-ghost` no ponteiro.
        !preenchido && noAr && { backgroundColor: t.colors.surfaceAlt },
        noAr && elevar(-1, reduzirMovimento),
        reagindo && estado.pressed && styles.pressionado,
        inativo && styles.atenuado,
        sombra ? { boxShadow: sombra } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[styles.label, compacto && styles.labelCompacto, { color: corTexto }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: "center",
      borderRadius: t.radius.md,
      justifyContent: "center",
      // Piso de acessibilidade: alvo de toque confortável.
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.lg,
      ...transicao(
        "transform, box-shadow, background-color, opacity",
        [motion.rapida, motion.media, motion.media, motion.media],
      ),
      ...semContornoNativo(),
    },
    // `padding:0 16px` do override compacto — a altura segue no piso de toque.
    compacto: {
      paddingHorizontal: t.spacing.md,
    },
    // Num pai em coluna isto é o que impede o RN de esticar o botão; num pai
    // em linha, o alinhamento no eixo transversal (o botão já tem `minHeight`).
    porConteudo: {
      alignSelf: "flex-start",
    },
    delineado: {
      backgroundColor: "transparent",
      // `borderStrong` e não `border`: limite de controle precisa de 3:1.
      borderColor: t.colors.borderStrong,
      borderWidth: 1,
    },
    pressionado: {
      opacity: 0.85,
    },
    atenuado: {
      opacity: 0.6,
    },
    label: {
      ...t.typography.bodyStrong,
      fontSize: 16,
    },
    // `font-size:13.5px` do override compacto.
    labelCompacto: {
      fontSize: 13.5,
    },
  });
