import { Fragment, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme, type Theme } from "../../theme";

/**
 * Trilho de passos do cadastro e da recuperação — o `.steps` do design.
 *
 * **Decorativo de propósito** (`aria-hidden`, como no mockup): quem carrega a
 * informação para o leitor de tela é a sobrancelha da tela ("Criar conta ·
 * passo 2 de 3"). Repetir isso em pontinhos só faria a navegação mais longa.
 */
export function AuthSteps({
  atual,
  total = 3,
  accent,
}: {
  /** Passo em curso, começando em 1. Os anteriores ficam acesos. */
  atual: number;
  total?: number;
  accent: string;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.trilho} aria-hidden>
      {/* Pontos e barras são irmãos, como no mockup: só assim a barra (flex:1)
          divide a sobra da linha. Aninhada num par, ela cresceria dentro de um
          bloco que já tinha encolhido para o tamanho do conteúdo. */}
      {Array.from({ length: total }, (_, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.barra} /> : null}
          <View style={[styles.ponto, i < atual && { backgroundColor: accent }]} />
        </Fragment>
      ))}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    trilho: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      marginBottom: t.spacing.md,
    },
    barra: {
      backgroundColor: t.colors.border,
      flex: 1,
      height: 1,
    },
    ponto: {
      backgroundColor: t.colors.borderStrong,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
  });
