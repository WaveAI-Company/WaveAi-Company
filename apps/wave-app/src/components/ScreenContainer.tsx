import { useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { useTheme, type Theme } from "../theme";

type Props = {
  children: ReactNode;
};

/** Container padrão das telas: fundo, respiro e rolagem (útil no web estreito). */
export function ScreenContainer({ children }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    scroll: {
      backgroundColor: t.colors.background,
      flex: 1,
    },
    content: {
      flexGrow: 1,
      padding: t.spacing.lg,
    },
    inner: {
      alignSelf: "center",
      flex: 1,
      gap: t.spacing.md,
      maxWidth: 720,
      width: "100%",
    },
  });
