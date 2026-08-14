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

/**
 * Onde o aviso está, que é o que decide tamanho e alinhamento.
 *
 * O mockup tem **três** formas para o mesmo texto, e nós tínhamos uma só:
 * `.side-foot` fecha a coluna de navegação em 11,5px; `.page-foot` fica
 * centralizado no fim da página de autenticação; e o rodapé das telas de app —
 * que o mockup não tem, porque lá o aviso da sidebar está sempre à vista.
 *
 * **O nosso tem os dois** (sidebar e rodapé de tela) de propósito: abaixo de
 * 768px a sidebar vira gaveta fechada, e o aviso da casca deixaria de estar
 * visível justamente no aparelho mais usado. Medical/71 pede o posicionamento
 * presente, não presente-se-alguém-abrir-o-menu.
 */
type Placement = "sidebar" | "footer" | "auth";

type Props = {
  variant?: keyof typeof TEXTOS;
  placement?: Placement;
};

export function Disclaimer({ variant = "curto", placement = "footer" }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return <Text style={[styles.base, styles[placement]]}>{TEXTOS[variant]}</Text>;
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    base: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    // `.side-foot{font-size:11.5px; line-height:1.45}` — o espaço acima é do
    // invólucro na casca, não do texto.
    sidebar: {
      fontSize: 11.5,
      lineHeight: 17,
    },
    /**
     * O aviso fecha a tela, e não flutua no meio dela: `marginTop: "auto"`
     * empurra para o fim da coluna quando o conteúdo é curto, e vira um
     * espaçamento normal quando é longo. Antes ele só herdava a `gap` da
     * coluna e podia terminar a meia altura numa tela vazia.
     */
    footer: {
      marginTop: "auto",
      paddingTop: t.spacing.md,
      textAlign: "center",
    },
    // `.page-foot{text-align:center}` — o posicionamento no fim é do `AuthStage`.
    auth: {
      textAlign: "center",
    },
  });
