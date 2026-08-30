import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  /** Faixa lateral de destaque. Sem valor, usa a borda neutra. */
  accent?: string;
  /** Acessório à direita do título (ex.: um `InfoButton` didático). */
  titleAccessory?: ReactNode;
  /** Preenche a altura disponível — para emparelhar com a coluna vizinha. */
  grow?: boolean;
  /**
   * Fecha a borda nos quatro lados, mantendo a faixa de destaque à esquerda.
   *
   * O padrão continua sendo só a faixa: dentro de um painel, um cartão por
   * bloco, ela basta e pesa menos. Numa **lista de itens escolhíveis** ela não
   * basta — os cartões encostam e viram um bloco só, sem dizer onde cada um
   * termina. É prop e não o novo padrão para não mudar as telas que já estão
   * ajustadas.
   */
  contorno?: boolean;
  children?: ReactNode;
};

/** Bloco de conteúdo com título e faixa de destaque opcional. */
export function Card({
  title,
  subtitle,
  accent,
  titleAccessory,
  grow,
  contorno,
  children,
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View
      style={[
        styles.card,
        grow && styles.cresce,
        contorno && styles.contorno,
        { borderLeftColor: accent ?? t.colors.border },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {titleAccessory}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderLeftWidth: 4,
      borderRadius: t.radius.md,
      gap: t.spacing.sm,
      padding: t.spacing.md,
    },
    cresce: {
      flex: 1,
    },
    // Só os três lados que faltavam: a faixa da esquerda continua sendo a do
    // `borderLeftWidth: 4` acima, com a cor do destaque.
    contorno: {
      borderColor: t.colors.border,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
    },
    title: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
    },
    subtitle: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
