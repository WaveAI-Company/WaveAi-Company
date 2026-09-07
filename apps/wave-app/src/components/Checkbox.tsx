import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
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
  /**
   * Texto do rótulo. **Continua obrigatório mesmo com `rotulo`**: é ele que vai
   * para o `accessibilityLabel`, que precisa ser uma string simples — quem lê
   * ouvindo recebe a frase inteira, não um nó com links dentro.
   */
  label: string;
  /**
   * Rótulo desenhado, quando a frase precisa de mais que texto puro (links, por
   * exemplo). **Prop nova, opcional**: sem ela nada muda para quem já usa o
   * componente — `patient/consent.tsx` segue exatamente como estava.
   */
  rotulo?: ReactNode;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, rotulo, disabled }: Props) {
  const t = useTheme();
  const { accent, onAccent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers } = useInteracao();

  // O anel de foco vai na **caixa**, não na linha: o alvo de toque é a linha
  // inteira (rótulo incluído), e um anel de 300px de largura em volta de um
  // parágrafo não lê como "este controle está focado".
  const realce = estado.focoVisivel
    ? { boxShadow: anelFoco(accent, t.colors.background) }
    : null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      aria-checked={checked}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      {...handlers}
      style={[styles.linha, estado.pressed && styles.pressionada]}
    >
      <View
        style={[
          styles.caixa,
          checked
            ? { backgroundColor: accent, borderColor: accent }
            : { borderColor: estado.hovered && !disabled ? accent : t.colors.borderStrong },
          realce,
        ]}
      >
        {checked ? <Icon name="check" size={13} color={onAccent} strokeWidth={3} /> : null}
      </View>
      {/* `rotulo` embrulhado no MESMO `Text` do caso simples, e não no lugar
          dele: é isso que faz os pedaços quebrarem como texto corrido, com a
          tipografia e o `flexShrink` de sempre. Trocar por um `View` faria cada
          pedaço virar uma caixa, e a frase quebraria torta no celular. */}
      <Text style={styles.rotulo}>{rotulo ?? label}</Text>
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
      ...semContornoNativo(),
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
      ...transicao("background-color, border-color, box-shadow", motion.media),
    },
    rotulo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
    },
  });
