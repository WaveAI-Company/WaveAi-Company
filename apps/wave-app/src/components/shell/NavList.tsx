import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { activeHref, navItemsFor } from "../../navigation/navItems";
import type { UserRole } from "../../auth/api";
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
};

/** Lista de navegação da casca (P6-a), usada na sidebar e no drawer. */
export function NavList({ role, pathname, onNavigate }: Props) {
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
  onPress,
  styles,
}: {
  label: string;
  icone: string;
  selecionado: boolean;
  accent: string;
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
        (selecionado || realce) && { backgroundColor: t.colors.surfaceAlt },
        estado.pressed && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel ? { boxShadow: anelFoco(accent, t.colors.surface) } : null,
      ]}
    >
      {/* Barra de seleção no tom do papel. */}
      <View
        style={[styles.barra, { backgroundColor: selecionado ? accent : "transparent" }]}
      />
      <Text style={[styles.icone, { color: selecionado ? accent : t.colors.textMuted }]}>
        {icone}
      </Text>
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
    barra: {
      alignSelf: "stretch",
      borderRadius: t.radius.pill,
      marginVertical: t.spacing.xs,
      width: 3,
    },
    icone: {
      ...t.typography.bodyStrong,
      textAlign: "center",
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
