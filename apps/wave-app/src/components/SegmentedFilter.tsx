import { useMemo } from "react";
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
};

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Descreve o grupo inteiro para o leitor de tela (ex.: "Período"). */
  label: string;
  accent?: string;
};

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  label,
  accent,
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
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={opcao.label}
            onPress={() => onChange(opcao.value)}
            style={[styles.item, ativo && { backgroundColor: withAlpha(cor, 0.14) }]}
          >
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
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: t.spacing.md,
    },
    texto: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
  });
