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
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

export type ButtonVariant = "primary" | "secondary" | "danger";

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
 */
export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  accent,
}: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers, reduzirMovimento } = useInteracao();

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
        <Text style={[styles.label, { color: corTexto }]}>{label}</Text>
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
  });
