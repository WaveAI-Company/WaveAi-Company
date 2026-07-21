import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { useTheme, type Theme } from "../theme";

/**
 * Aviso de posicionamento **não-clínico e não-diagnóstico**.
 *
 * É componente, e não texto solto em cada tela, porque isto é **regra rígida**
 * do produto (`Medical/71`): a redação não pode divergir nem sumir de uma tela
 * por descuido. Antes existiam ao menos três variações espalhadas.
 *
 * Alterar estes textos é decisão de posicionamento — não de UI.
 */
const TEXTOS = {
  /** Padrão, para telas que não exibem medidas. */
  curto: "Uso exploratório de bem-estar — não-clínico e não-diagnóstico.",
  /** Onde há números na tela: reforça que medida não é diagnóstico. */
  medidas:
    "Uso exploratório de bem-estar — não-clínico e não-diagnóstico. Estes números não indicam diagnóstico nem substituem avaliação profissional.",
  /** Visão do médico: acrescenta que não substitui avaliação dele. */
  profissional:
    "Dados exploratórios de bem-estar — não-clínicos e não-diagnósticos. Não substituem avaliação profissional.",
} as const;

type Props = {
  variant?: keyof typeof TEXTOS;
};

export function Disclaimer({ variant = "curto" }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return <Text style={styles.texto}>{TEXTOS[variant]}</Text>;
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    texto: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.md,
    },
  });
