import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  anelFoco,
  comporSombras,
  elevar,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  /** Texto secundário sob o rótulo (ex.: motivo de um aviso). */
  description?: string;
  /** `attention` destaca uma pendência (ex.: consentimento faltando). */
  tone?: "neutral" | "accent" | "attention";
};

/**
 * Linha de navegação delineada.
 *
 * Substitui os `Pressable` soltos que cada tela montava à mão — que variavam
 * em altura, borda e cor, e não garantiam alvo de toque mínimo.
 *
 * **Estados (P8-a).** Segue o cartão clicável do mockup (`.sess`, `.pcard`):
 * ao ponteiro sobe 1px, pinta o fundo um nível acima e — quando a borda é
 * neutra — puxa a borda para o destaque, que é a única pista de que a linha
 * leva a algum lugar.
 */
export function NavAction({ label, onPress, description, tone = "accent" }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers, reduzirMovimento } = useInteracao();

  const corBorda =
    tone === "attention"
      ? t.colors.warningText
      : tone === "accent"
        ? papel.accent
        : t.colors.borderStrong;
  const corTexto =
    tone === "attention"
      ? t.colors.warningText
      : tone === "accent"
        ? papel.accentText
        : t.colors.text;

  const noAr = estado.hovered && !estado.pressed;
  const sombra = comporSombras(
    estado.focoVisivel && anelFoco(papel.accent, t.colors.background),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      {...handlers}
      style={[
        styles.base,
        { borderColor: noAr && tone === "neutral" ? papel.accent : corBorda },
        noAr && styles.noAr,
        noAr && elevar(-1, reduzirMovimento),
        estado.pressed && styles.pressionado,
        sombra ? { boxShadow: sombra } : null,
      ]}
    >
      <View style={styles.conteudo}>
        <Text style={[styles.label, { color: corTexto }]}>{label}</Text>
        {description ? <Text style={styles.descricao}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    base: {
      borderRadius: t.radius.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      ...transicao(
        "transform, box-shadow, background-color, border-color",
        [motion.rapida, motion.media, motion.media, motion.media],
      ),
      ...semContornoNativo(),
    },
    noAr: {
      backgroundColor: t.colors.surfaceAlt,
    },
    pressionado: {
      opacity: 0.85,
    },
    conteudo: {
      gap: t.spacing.xs,
    },
    // O rótulo era centralizado enquanto a descrição ficava à esquerda — no
    // mesmo bloco. Não era escolha de design, era descuido, e o pente fino
    // pegou nas duas telas onde a linha tem descrição: a faixa "Autorize
    // guardar seus resultados" na home e o "Convidar uma pessoa" do perfil do
    // profissional. As linhas do mockup são alinhadas à esquerda.
    label: {
      ...t.typography.bodyStrong,
    },
    descricao: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
