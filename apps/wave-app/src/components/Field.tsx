import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../theme";
import { Icon } from "./Icon";

type Props = TextInputProps & {
  label: string;
  /** Mensagem de erro do campo; também marca o input para leitores de tela. */
  error?: string | null;
  /**
   * Mostra um botão **Mostrar/Ocultar** para campos de senha. Controla o
   * `secureTextEntry` internamente — passe também `secureTextEntry` para o
   * estado inicial oculto.
   */
  revealable?: boolean;
};

/** Campo de formulário rotulado, com foco visível e revelar-senha opcional. */
export function Field({ label, error, revealable, ...input }: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [focado, setFocado] = useState(false);
  const [revelado, setRevelado] = useState(false);

  // Com o toggle, a visibilidade é controlada aqui; sem ele, respeita a prop.
  const oculto = revealable ? !revelado : input.secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...input}
          secureTextEntry={oculto}
          accessibilityLabel={input.accessibilityLabel ?? label}
          // Foco visível é requisito de acessibilidade e, no web, o contorno
          // padrão do navegador não aparece sobre fundo escuro.
          onFocus={(e) => {
            setFocado(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            input.onBlur?.(e);
          }}
          style={[
            styles.input,
            revealable && styles.inputComBotao,
            focado && { borderColor: accent, borderWidth: 2 },
            Boolean(error) && { borderColor: t.colors.danger },
          ]}
          placeholderTextColor={t.colors.textMuted}
          autoCapitalize={input.autoCapitalize ?? "none"}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revelado ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setRevelado((v) => !v)}
            style={styles.revelar}
            hitSlop={8}
          >
            {/* Ícone, não a palavra "Mostrar": o rótulo acessível já diz a ação
                e o texto disputava espaço com senhas longas. */}
            <Icon name={revelado ? "eyeOff" : "eye"} size={20} color={accent} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.erro}>{error}</Text> : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.xs,
    },
    label: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    inputRow: {
      justifyContent: "center",
    },
    input: {
      ...t.typography.body,
      // "Maré" assenta o campo num nível abaixo da superfície do cartão; o
      // limite continua em `borderStrong` (3:1, WCAG 1.4.11) e não no traço
      // fino do mockup, que não passaria.
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.md,
      borderWidth: 1,
      color: t.colors.text,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
    },
    // Espaço à direita para o texto não correr sob o botão de revelar.
    inputComBotao: {
      paddingRight: 52,
    },
    revelar: {
      position: "absolute",
      right: t.spacing.xs,
      alignItems: "center",
      justifyContent: "center",
      minHeight: t.minTouch,
      width: t.minTouch,
    },
    erro: {
      ...t.typography.caption,
      color: t.colors.dangerText,
    },
  });
