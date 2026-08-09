import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  withAlpha,
  type Theme,
} from "../theme";

/**
 * Grupo de opções mutuamente exclusivas, no estilo do design "Maré".
 *
 * O item ativo é marcado por **cor de destaque e `accessibilityState`**, não só
 * por peso da fonte: quem navega por leitor de tela precisa saber qual está
 * valendo, e quem enxerga pouco não deve depender de um contraste sutil.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Glifo antes do rótulo. Decorativo — quem nomeia a opção é o `label`. */
  icon?: ReactNode;
};

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Descreve o grupo inteiro para o leitor de tela (ex.: "Período"). */
  label: string;
  accent?: string;
  /** Divide a largura disponível em partes iguais, em vez de caber no texto. */
  fill?: boolean;
};

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  label,
  accent,
  fill,
}: Props<T>) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

  return (
    <View style={styles.grupo} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((opcao) => (
        <Item
          key={opcao.value}
          opcao={opcao}
          ativo={opcao.value === value}
          cor={cor}
          fill={fill}
          onPress={() => onChange(opcao.value)}
          styles={styles}
        />
      ))}
    </View>
  );
}

/**
 * Uma opção. É componente de verdade — e não uma função que devolve JSX —
 * porque cada item precisa do **próprio** estado de interação, e hook não pode
 * morar dentro de um `map`.
 */
function Item<T extends string>({
  opcao,
  ativo,
  cor,
  fill,
  onPress,
  styles,
}: {
  opcao: SegmentedOption<T>;
  ativo: boolean;
  cor: string;
  fill?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const t = useTheme();
  const { estado, handlers } = useInteracao();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: ativo, selected: ativo }}
      // Um `role="radio"` anuncia a escolha por `aria-checked`, e o
      // `accessibilityState` **não** vira esse atributo no RN-web: o
      // leitor de tela ouvia três opções e nenhuma marcada — a seleção
      // existia só como cor. A prop `aria-checked` vale nas duas pontas.
      aria-checked={ativo}
      accessibilityLabel={opcao.label}
      onPress={onPress}
      {...handlers}
      style={[
        styles.item,
        fill && styles.itemLargo,
        ativo && { backgroundColor: withAlpha(cor, 0.14) },
        // `.seg button:hover{color:var(--ink)}`: no mockup o item inativo só
        // acende o texto — pintar o fundo faria dois itens parecerem escolhidos.
        estado.pressed && !ativo && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel ? { boxShadow: anelFoco(cor, t.colors.surfaceAlt) } : null,
      ]}
    >
      {opcao.icon}
      <Text
        style={[
          styles.texto,
          ativo && { color: cor },
          !ativo && estado.hovered && { color: t.colors.text },
        ]}
      >
        {opcao.label}
      </Text>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    grupo: {
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      padding: 3,
    },
    item: {
      alignItems: "center",
      borderRadius: t.radius.pill,
      flexDirection: "row",
      gap: 7,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: t.spacing.md,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },
    itemLargo: {
      flex: 1,
    },
    texto: {
      ...t.typography.label,
      color: t.colors.textMuted,
      ...transicao("color", motion.media),
    },
  });
