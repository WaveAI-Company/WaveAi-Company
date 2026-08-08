import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import { useRoleAccent, useTheme, type Theme } from "../theme";

/**
 * Caixa de marcação com rótulo.
 *
 * **Por que existe:** o RN não tem checkbox nas duas plataformas, e o único
 * lugar que precisava de uma até agora — o aceite do termo — não deve improvisar
 * um `Pressable` sem papel de acessibilidade. Aqui o alvo de toque é a linha
 * inteira (rótulo incluído), com `checkbox` e `aria-checked`, que é o atributo
 * que o RN-web de fato emite (o `accessibilityState` sozinho não vira ARIA).
 */

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, disabled }: Props) {
  const t = useTheme();
  const { accent, onAccent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      aria-checked={checked}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.linha, pressed && styles.pressionada]}
    >
      <View
        style={[
          styles.caixa,
          checked
            ? { backgroundColor: accent, borderColor: accent }
            : { borderColor: t.colors.borderStrong },
        ]}
      >
        {checked ? <Icon name="check" size={13} color={onAccent} strokeWidth={3} /> : null}
      </View>
      <Text style={styles.rotulo}>{label}</Text>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    linha: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: t.spacing.sm + 4,
      // O alvo é a linha toda, não os 22px da caixa.
      minHeight: t.minTouch,
      paddingVertical: t.spacing.sm,
    },
    pressionada: {
      opacity: 0.7,
    },
    caixa: {
      alignItems: "center",
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: 6,
      borderWidth: 1.5,
      height: 22,
      justifyContent: "center",
      marginTop: 1,
      width: 22,
    },
    rotulo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
    },
  });
