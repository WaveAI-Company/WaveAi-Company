import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import {
  anelCampo,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";
import { Icon } from "./Icon";

type Props = TextInputProps & {
  label: string;
  /** Mensagem de erro do campo; também marca o input para leitores de tela. */
  error?: string | null;
  /**
   * Texto de apoio sob o campo — o `.hint` do design. Explica o que o campo
   * faz **antes** de a pessoa errar; o `error` fala depois. Some quando há
   * erro, para as duas linhas não competirem.
   */
  hint?: string;
  /**
   * Mostra um botão **Mostrar/Ocultar** para campos de senha. Controla o
   * `secureTextEntry` internamente — passe também `secureTextEntry` para o
   * estado inicial oculto.
   */
  revealable?: boolean;
};

/** Campo de formulário rotulado, com foco visível e revelar-senha opcional. */
export function Field({ label, error, hint, revealable, ...input }: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [focado, setFocado] = useState(false);
  const [revelado, setRevelado] = useState(false);
  // Estado do botão de revelar senha — `.reveal` no mockup.
  const revelar = useInteracao();

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
            // `.field textarea` do mockup: 88px de altura mínima. O
            // `textAlignVertical` é o que impede o texto de nascer centrado
            // verticalmente no Android.
            input.multiline && styles.inputMultilinha,
            revealable && styles.inputComBotao,
            // Anel em vez de engrossar a borda: o mockup faz
            // `border-color: accent; box-shadow: 0 0 0 3px accent-soft`, e
            // engrossar de 1px para 2px empurrava o texto do campo 1px a cada
            // foco — um tremor visível ao percorrer o formulário com Tab.
            focado && { borderColor: accent, boxShadow: anelCampo(accent, t.isDark) },
            Boolean(error) && { borderColor: t.colors.danger },
          ]}
          placeholderTextColor={t.colors.textSubtle}
          autoCapitalize={input.autoCapitalize ?? "none"}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revelado ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setRevelado((v) => !v)}
            {...revelar.handlers}
            style={[
              styles.revelar,
              revelar.estado.hovered && { backgroundColor: t.colors.surfaceStrong },
              revelar.estado.focoVisivel
                ? { boxShadow: anelCampo(accent, t.isDark), backgroundColor: t.colors.surfaceStrong }
                : null,
            ]}
            hitSlop={8}
          >
            {/* Ícone, não a palavra "Mostrar": o rótulo acessível já diz a ação
                e o texto disputava espaço com senhas longas. */}
            <Icon name={revelado ? "eyeOff" : "eye"} size={20} color={accent} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.erro}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
    inputMultilinha: {
      minHeight: 88,
      paddingTop: t.spacing.sm + 2,
      textAlignVertical: "top",
    },
    hint: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 12,
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
      ...transicao("border-color, box-shadow", motion.rapida),
      ...semContornoNativo(),
    },
    // Espaço à direita para o texto não correr sob o botão de revelar.
    inputComBotao: {
      paddingRight: 52,
    },
    revelar: {
      position: "absolute",
      right: t.spacing.xs,
      alignItems: "center",
      borderRadius: t.radius.sm,
      justifyContent: "center",
      // Menor que o campo para o fundo do hover não encostar na borda. O alvo
      // real continua acima do piso de 44px pelo `hitSlop={8}` (36 + 8 + 8).
      height: t.minTouch - 8,
      marginRight: 2,
      width: t.minTouch - 8,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },
    erro: {
      ...t.typography.caption,
      color: t.colors.dangerText,
    },
  });
