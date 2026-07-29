import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { activeHref, navItemsFor } from "../../navigation/navItems";
import type { UserRole } from "../../auth/api";
import { useRoleAccent, useTheme, type Theme } from "../../theme";

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
      {itens.map((item) => {
        const selecionado = item.href === ativo;
        return (
          <Pressable
            key={item.href}
            accessibilityRole="link"
            accessibilityState={{ selected: selecionado }}
            accessibilityLabel={item.label}
            onPress={() => {
              // `navigate` (não `push`) não empilha: a casca substitui o fluxo
              // de "voltar" por navegação lateral.
              router.navigate(item.href as never);
              onNavigate?.();
            }}
            style={({ pressed }) => [
              styles.item,
              selecionado && { backgroundColor: t.colors.surfaceAlt },
              pressed && styles.pressionado,
            ]}
          >
            {/* Barra de seleção no tom do papel. */}
            <View
              style={[
                styles.barra,
                { backgroundColor: selecionado ? accent : "transparent" },
              ]}
            />
            <Text style={[styles.icone, { color: selecionado ? accent : t.colors.textMuted }]}>
              {item.icon}
            </Text>
            <Text
              style={[
                styles.rotulo,
                { color: selecionado ? t.colors.text : t.colors.textMuted },
                selecionado && styles.rotuloAtivo,
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
    },
    pressionado: {
      opacity: 0.7,
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
    },
    rotuloAtivo: {
      fontWeight: "600",
    },
  });
