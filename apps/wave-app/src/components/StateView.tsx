import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../theme";
import { Button } from "./Button";

type Props = {
  loading?: boolean;
  error?: string | null;
  empty?: string | null;
  /**
   * Com erro, oferece tentar de novo. Sem isto a tela de erro era um beco:
   * a mensagem sozinha, sem filtro nem botão, até a pessoa sair e voltar.
   */
  onRetry?: () => void;
};

/**
 * Estados de carregamento, erro e lista vazia.
 *
 * Existe para as telas não confundirem "ainda carregando" com "não há nada" —
 * distinção que importa quando o vazio pode significar "nenhum paciente
 * autorizou o acompanhamento".
 */
export function StateView({ loading, error, empty, onRetry }: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  if (loading) {
    return (
      <View style={styles.caixa} accessibilityRole="progressbar" accessibilityLabel="Carregando">
        <ActivityIndicator color={accent} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.caixa}>
        <Text style={styles.erro} accessibilityRole="alert">
          {error}
        </Text>
        {onRetry ? (
          <View style={styles.acao}>
            <Button label="Tentar de novo" onPress={onRetry} variant="secondary" accent={accent} />
          </View>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.caixa}>
        <Text style={styles.vazio}>{empty}</Text>
      </View>
    );
  }
  return null;
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    caixa: {
      alignItems: "center",
      paddingVertical: t.spacing.xl,
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
      fontSize: 14,
      textAlign: "center",
    },
    acao: {
      marginTop: t.spacing.md,
    },
    vazio: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
  });
