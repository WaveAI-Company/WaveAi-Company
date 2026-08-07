import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, withAlpha, type Theme } from "../theme";

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
      {options.map((opcao) => {
        const ativo = opcao.value === value;
        return (
          <Pressable
            key={opcao.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativo, selected: ativo }}
            // Um `role="radio"` anuncia a escolha por `aria-checked`, e o
            // `accessibilityState` **não** vira esse atributo no RN-web: o
            // leitor de tela ouvia três opções e nenhuma marcada — a seleção
            // existia só como cor. A prop `aria-checked` vale nas duas pontas.
            aria-checked={ativo}
            accessibilityLabel={opcao.label}
            onPress={() => onChange(opcao.value)}
            style={[
              styles.item,
              fill && styles.itemLargo,
              ativo && { backgroundColor: withAlpha(cor, 0.14) },
            ]}
          >
            {opcao.icon}
            <Text style={[styles.texto, ativo && { color: cor }]}>{opcao.label}</Text>
          </Pressable>
        );
      })}
    </View>
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
    },
    itemLargo: {
      flex: 1,
    },
    texto: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
  });
