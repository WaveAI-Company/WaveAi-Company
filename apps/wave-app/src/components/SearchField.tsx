import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Icon } from "./Icon";
import {
  anelCampo,
  motion,
  semContornoNativo,
  transicao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

/**
 * Campo de busca do design "Maré".
 *
 * Separado do [`Field`](Field.tsx) porque aqui o rótulo **não** fica visível —
 * a lupa e o placeholder já dizem o que é, e um rótulo por cima roubaria a
 * linha. Quem navega ouvindo continua ouvindo o rótulo pelo
 * `accessibilityLabel`, que é obrigatório.
 */

type Props = {
  value: string;
  onChangeText: (texto: string) => void;
  /** Nome do campo para o leitor de tela — ex.: "Buscar pessoa". */
  label: string;
  placeholder?: string;
};

export function SearchField({ value, onChangeText, label, placeholder }: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [focado, setFocado] = useState(false);

  return (
    <View
      style={[
        styles.caixa,
        // `.search:focus-within` do mockup. O alfa vem do `anelCampo`, que é o
        // mesmo do `Field` — antes daqui eram 0,18 aqui e nada lá.
        focado && { borderColor: accent, boxShadow: anelCampo(accent, t.isDark) },
      ]}
    >
      <Icon name="search" size={16} color={t.colors.textMuted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholder={placeholder ?? label}
        placeholderTextColor={t.colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        style={styles.entrada}
      />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    caixa: {
      alignItems: "center",
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: 9,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md - 2,
      ...transicao("border-color, box-shadow", motion.rapida),
    },
    entrada: {
      ...t.typography.body,
      color: t.colors.text,
      flex: 1,
      fontSize: 14,
      paddingVertical: t.spacing.sm,
      ...semContornoNativo(),
    },
  });
