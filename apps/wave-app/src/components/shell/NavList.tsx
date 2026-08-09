import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { activeHref, navItemsFor } from "../../navigation/navItems";
import type { UserRole } from "../../auth/api";
import { Icon, type IconName } from "../Icon";
import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../theme";

type Props = {
  role: UserRole;
  /** Pathname atual (para destacar o item ativo). */
  pathname: string;
  /** Chamado após navegar — o drawer mobile usa para se fechar. */
  onNavigate?: () => void;
  /**
   * Navegação recolhida a ícones (a faixa 768–1199 do mockup).
   *
   * O rótulo **não** some do leitor de tela: sai da tela e continua no
   * `accessibilityLabel`, que já era obrigatório aqui.
   */
  rail?: boolean;
};

/** Lista de navegação da casca (P6-a), usada na sidebar e no drawer. */
export function NavList({ role, pathname, onNavigate, rail }: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const router = useRouter();

  const itens = navItemsFor(role);
  const ativo = activeHref(pathname, role);

  return (
    <View style={styles.lista}>
      {itens.map((item) => (
        <ItemNav
          key={item.href}
          label={item.label}
          icone={item.icon}
          selecionado={item.href === ativo}
          accent={accent}
          rail={rail}
          styles={styles}
          onPress={() => {
            // `navigate` (não `push`) não empilha: a casca substitui o fluxo
            // de "voltar" por navegação lateral.
            router.navigate(item.href as never);
            onNavigate?.();
          }}
        />
      ))}
    </View>
  );
}

/**
 * Um item da navegação — o `.nav a` do mockup, que ao ponteiro pinta o fundo e
 * acende o texto. Componente próprio porque cada linha tem seu estado de
 * interação, e hook não vive dentro de `map`.
 */
function ItemNav({
  label,
  icone,
  selecionado,
  accent,
  rail,
  onPress,
  styles,
}: {
  label: string;
  icone: IconName;
  selecionado: boolean;
  accent: string;
  rail?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const t = useTheme();
  const { estado, handlers } = useInteracao();
  const realce = estado.hovered || estado.pressed;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: selecionado }}
      // `accessibilityState` não vira ARIA no RN-web; `aria-current` vira.
      aria-current={selecionado ? "page" : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      {...handlers}
      style={[
        styles.item,
        rail && styles.itemRail,
        (selecionado || realce) && { backgroundColor: t.colors.surfaceAlt },
        estado.pressed && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel ? { boxShadow: anelFoco(accent, t.colors.surface) } : null,
      ]}
    >
      {/* Barra de seleção no tom do papel. No rail ela sairia colada na borda
          da coluna de 76px; lá quem marca a seleção é o fundo e a cor do ícone. */}
      {rail ? null : (
        <View
          style={[styles.barra, { backgroundColor: selecionado ? accent : "transparent" }]}
        />
      )}
      <View style={styles.icone}>
        <Icon
          name={icone}
          size={19}
          color={selecionado ? accent : realce ? t.colors.text : t.colors.textMuted}
        />
      </View>
      {rail ? null : (
        <Text
          style={[
            styles.rotulo,
            { color: selecionado || realce ? t.colors.text : t.colors.textMuted },
            selecionado && styles.rotuloAtivo,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    lista: {
      gap: t.spacing.xs,
    },
    item: {
      alignItems: "center",
      borderRadius: t.radius.md,
      flexDirection: "row",
      gap: t.spacing.sm,
      minHeight: t.minTouch,
      paddingRight: t.spacing.sm,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },
    // No rail o alvo é um quadrado centrado: sem barra, sem rótulo, sem o
    // respiro à direita que só existe para separar ícone de texto.
    itemRail: {
      justifyContent: "center",
      paddingRight: 0,
      width: "100%",
    },
    barra: {
      alignSelf: "stretch",
      borderRadius: t.radius.pill,
      marginVertical: t.spacing.xs,
      width: 3,
    },
    // Largura fixa para os rótulos alinharem entre si, independente do ícone.
    icone: {
      alignItems: "center",
      justifyContent: "center",
      width: 20,
    },
    rotulo: {
      ...t.typography.body,
      flexShrink: 1,
      ...transicao("color", motion.media),
    },
    rotuloAtivo: {
      fontWeight: "600",
    },
  });
