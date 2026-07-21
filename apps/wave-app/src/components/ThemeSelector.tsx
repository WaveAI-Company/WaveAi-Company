import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, type Theme, type ThemePreference } from "../theme";

const OPCOES: { valor: ThemePreference; rotulo: string }[] = [
  { valor: "system", rotulo: "Sistema" },
  { valor: "light", rotulo: "Claro" },
  { valor: "dark", rotulo: "Escuro" },
];

/**
 * Escolha de tema: seguir o sistema (padrão) ou fixar claro/escuro.
 *
 * **Por que existe:** o `userInterfaceStyle` do Expo é resolvido em tempo de
 * build e, no Android, depende de `expo-system-ui` — dependência nativa. Sem
 * ela o app fica preso a um tema no aparelho, por mais que o sistema mude.
 * Este seletor é puro JavaScript, então funciona em qualquer build já
 * instalado, e mantém "seguir o sistema" como padrão.
 */
export function ThemeSelector() {
  const t = useTheme();
  const { accent, onAccent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.grupo} accessibilityRole="radiogroup" accessibilityLabel="Tema">
      {OPCOES.map(({ valor, rotulo }) => {
        const selecionado = t.preference === valor;
        return (
          <Pressable
            key={valor}
            accessibilityRole="radio"
            accessibilityState={{ selected: selecionado }}
            accessibilityLabel={rotulo}
            onPress={() => t.setPreference(valor)}
            style={[
              styles.opcao,
              selecionado
                ? { backgroundColor: accent, borderColor: accent }
                : { borderColor: t.colors.borderStrong },
            ]}
          >
            <Text
              style={[
                styles.texto,
                { color: selecionado ? onAccent : t.colors.text },
              ]}
            >
              {rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    grupo: {
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    opcao: {
      borderRadius: t.radius.md,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.sm,
    },
    texto: {
      ...t.typography.bodyStrong,
      textAlign: "center",
    },
  });
