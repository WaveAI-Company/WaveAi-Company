import { useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { teto, useTheme, type Theme } from "../theme";

/**
 * Quanto a tela pode ocupar.
 *
 * **O teto é por tela, e sai do mockup** (P8-d): o painel do profissional vai a
 * 1720px, as telas de app com colunas a 1600, o perfil a 1400, as listas mais
 * leves a 1100 e um documento corrido para em 720. Antes havia um teto único
 * de 1280 para tudo, e num monitor largo isso deixava quase meio milhar de
 * pixels vazios de cada lado da tela mais densa do produto.
 */
export type LarguraTela = keyof typeof teto;

type Props = {
  children: ReactNode;
  /**
   * Teto de largura. O padrão `documento` serve a texto e listas — linha longa
   * demais cansa de ler. Telas que se organizam em colunas pedem o seu.
   */
  largura?: LarguraTela;
};

/** Container padrão das telas: fundo, respiro e rolagem (útil no web estreito). */
export function ScreenContainer({ children, largura = "documento" }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.inner, { maxWidth: teto[largura] }]}>{children}</View>
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
      width: "100%",
    },
  });
