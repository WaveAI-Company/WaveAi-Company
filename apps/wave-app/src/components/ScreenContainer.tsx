import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../theme";

type Props = {
  children: ReactNode;
};

/** Container padrão das telas: fundo, respiro e rolagem (útil no web estreito). */
export function ScreenContainer({ children }: Props) {
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

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: spacing.md,
  },
});
