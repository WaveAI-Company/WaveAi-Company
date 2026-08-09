import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import {
  anelFoco,
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
  /** Cor do texto — padrão: o destaque do papel. */
  accent?: string;
};

/**
 * Link de texto dentro de uma frase ("Primeiro acesso? **Criar conta**").
 *
 * **Por que virou componente (P8-a):** login e cadastro montavam o mesmo
 * `Pressable` com `hitSlop`, e nenhum dos dois sublinhava no ponteiro nem
 * mostrava foco de teclado — o mockup faz `a:hover{text-decoration:underline}`
 * e tem anel de foco global. Duas cópias divergiriam na terceira tela.
 *
 * O sublinhado só no hover é fiel ao Fable e não custa acessibilidade: o link
 * já se distingue do texto ao redor pela cor **e** pelo peso, então não é a
 * cor sozinha que carrega a informação.
 */
export function TextLink({ label, onPress, accent }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers } = useInteracao();
  const cor = accent ?? papel.accentText;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      {...handlers}
      style={[
        styles.alvo,
        estado.focoVisivel ? { boxShadow: anelFoco(cor, t.colors.background) } : null,
      ]}
    >
      <Text
        style={[
          styles.texto,
          { color: cor },
          (estado.hovered || estado.pressed) && styles.sublinhado,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    alvo: {
      borderRadius: 4,
      ...transicao("box-shadow", motion.media),
      ...semContornoNativo(),
    },
    texto: {
      ...t.typography.bodyStrong,
    },
    sublinhado: {
      textDecorationLine: "underline",
    },
  });
