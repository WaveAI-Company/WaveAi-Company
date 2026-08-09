import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useReduzirMovimento,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

/**
 * Interruptor de efeito **imediato**.
 *
 * **Por que não reusar o `Checkbox`:** o design usa caixa de marcação para um
 * aceite que só vale depois de um botão ("Aceitar e guardar minhas sessões", em
 * `Design/round1/consentimento.html`). Aqui o gesto vale **na hora** — desligar
 * corta a transmissão no mesmo instante (ADR-0045) —, e uma caixa que já agiu
 * sem confirmação mente sobre a própria natureza.
 *
 * O round 1 não desenhou nenhum interruptor: este nasce da linguagem "Maré" já
 * portada (trilho, destaque por papel, anel de foco, durações do `motion`).
 *
 * Acessibilidade: `role="switch"` + `aria-checked` — no RN-web o
 * `accessibilityState` sozinho **não** vira ARIA. O alvo de toque é a linha
 * inteira, com altura mínima real.
 */

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  /** Texto de apoio abaixo do rótulo — o que este gesto significa. */
  description?: string;
  disabled?: boolean;
};

const TRILHO_LARGURA = 46;
const TRILHO_ALTURA = 26;
const BOTAO = 20;

export function Switch({ value, onChange, label, description, disabled }: Props) {
  const t = useTheme();
  const { accent, onAccent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers } = useInteracao();
  const reduzirMovimento = useReduzirMovimento();

  const realce = estado.focoVisivel
    ? { boxShadow: anelFoco(accent, t.colors.background) }
    : null;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      aria-checked={value}
      accessibilityLabel={label}
      accessibilityHint={description}
      disabled={disabled}
      onPress={() => onChange(!value)}
      {...handlers}
      style={[styles.linha, disabled && styles.desabilitada]}
    >
      <View style={styles.textos}>
        <Text style={styles.rotulo}>{label}</Text>
        {description ? <Text style={styles.descricao}>{description}</Text> : null}
      </View>
      <View
        style={[
          styles.trilho,
          value
            ? { backgroundColor: accent, borderColor: accent }
            : {
                borderColor:
                  estado.hovered && !disabled ? accent : t.colors.borderStrong,
              },
          realce,
        ]}
      >
        <View
          style={[
            styles.botao,
            {
              backgroundColor: value ? onAccent : t.colors.textSubtle,
              // Sem transição, o botão precisa aparecer já no lugar certo — daí
              // a posição vir do estilo, e não de uma animação.
              transform: [{ translateX: value ? TRILHO_LARGURA - BOTAO - 6 : 0 }],
            },
            !reduzirMovimento && styles.botaoAnimado,
          ]}
        />
      </View>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    linha: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.md,
      minHeight: t.minTouch,
      paddingVertical: t.spacing.sm,
      ...semContornoNativo(),
    },
    desabilitada: {
      opacity: 0.5,
    },
    textos: {
      // `flexShrink` no RN é 0 por padrão: sem isto o bloco de texto não quebra
      // e empurra o trilho para fora do cartão.
      flexShrink: 1,
      gap: 2,
    },
    rotulo: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    descricao: {
      ...t.typography.body,
      color: t.colors.textSubtle,
      fontSize: 12.5,
    },
    trilho: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: TRILHO_ALTURA / 2,
      borderWidth: 1.5,
      height: TRILHO_ALTURA,
      justifyContent: "center",
      // Largura fixa: sem estilo próprio, o `flex` do RN-web venceria o `width`.
      marginLeft: "auto",
      paddingHorizontal: 2,
      width: TRILHO_LARGURA,
      ...transicao("background-color, border-color, box-shadow", motion.media),
    },
    botao: {
      borderRadius: BOTAO / 2,
      height: BOTAO,
      width: BOTAO,
    },
    botaoAnimado: transicao("transform, background-color", motion.rapida),
  });
