import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  formatNumber,
  formatPercent,
  type SignalQuality as Quality,
} from "../../api/results";
import { useTheme, type Theme } from "../../theme";

type Props = {
  quality: Quality;
};

/**
 * Qualidade do sinal da sessão.
 *
 * **Sem limiar e sem veredito, de propósito.** O que conta como sinal "bom o
 * suficiente" ainda não está definido (Q-TEC-06 em `04_Open_Questions.md`);
 * inventar um "bom/ruim" aqui seria decidir parâmetro que não nos cabe. Então
 * mostramos os números medidos e dizemos o que cada um é.
 */
export function SignalQuality({ quality }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const itens = [
    {
      chave: "amplitude",
      rotulo: "Amplitude do sinal",
      valor: formatNumber(quality.signal_std),
      nota: "desvio-padrão do sinal bruto (proxy de contato)",
    },
    {
      chave: "rede",
      rotulo: "Interferência da rede (60 Hz)",
      valor: formatPercent(quality.mains_power_ratio),
      nota: "fração da potência total concentrada na rede elétrica",
    },
  ];

  return (
    <View style={styles.wrapper}>
      {itens.map((item) => (
        <View
          key={item.chave}
          style={styles.linha}
          accessible
          accessibilityLabel={`${item.rotulo}: ${item.valor}. ${item.nota}`}
        >
          <View style={styles.texto}>
            <Text style={styles.rotulo}>{item.rotulo}</Text>
            <Text style={styles.nota}>{item.nota}</Text>
          </View>
          <Text style={styles.valor}>{item.valor}</Text>
        </View>
      ))}
      <Text style={styles.aviso}>
        Medidas objetivas, sem faixa de referência definida — não indicam
        sessão "boa" ou "ruim".
      </Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    linha: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      justifyContent: "space-between",
    },
    texto: {
      flex: 1,
    },
    rotulo: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    valor: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontWeight: "700",
    },
    aviso: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
      fontStyle: "italic",
      lineHeight: 16,
    },
  });
