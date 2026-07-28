import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";
import { InfoButton } from "./InfoButton";

/**
 * Guia de preparação do sensor, mostrada **antes** de captar (P4-a).
 *
 * "Lixo entra, lixo sai": a maior parte da qualidade se decide no contato do
 * eletrodo, antes da primeira janela. Estes passos são conteúdo/onboarding —
 * nada aqui calcula sinal. O verbete `poor_signal` (ⓘ) explica o número que o
 * aparelho reporta durante a captação.
 *
 * Colapsável e aberta por padrão: ajuda quem está começando sem atrapalhar quem
 * já sabe a rotina.
 */

const PASSOS = [
  "Posicione o eletrodo na testa, acima da sobrancelha esquerda — sem cabelo entre o metal e a pele.",
  "Prenda o clipe de referência no lóbulo da orelha.",
  "Se a testa estiver oleosa, limpe antes: pele limpa melhora o contato.",
  "Fique parado e relaxado — movimento e tensão dos músculos sujam o sinal.",
  "Ao iniciar, acompanhe o “Contato do sensor”: quanto menor o número, melhor.",
];

type Props = {
  /** Cor de destaque do papel (paciente). */
  accent: string;
};

export function SensorPrepGuide({ accent }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [aberto, setAberto] = useState(true);

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      {/* O InfoButton é seu próprio botão: fica IRMÃO do toggle, nunca aninhado
          (button dentro de button é DOM inválido no web). */}
      <View style={styles.cabecalho}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: aberto }}
          accessibilityLabel="Como conseguir bom contato do sensor"
          onPress={() => setAberto((v) => !v)}
          style={styles.toggle}
        >
          <Text style={styles.titulo}>Como conseguir bom contato</Text>
          <Text style={styles.chevron}>{aberto ? "–" : "+"}</Text>
        </Pressable>
        <InfoButton term="poor_signal" accent={accent} />
      </View>

      {aberto ? (
        <View style={styles.passos}>
          {PASSOS.map((passo, i) => (
            <View key={i} style={styles.passo}>
              <Text style={[styles.numero, { color: accent }]}>{i + 1}</Text>
              <Text style={styles.textoPasso}>{passo}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
    cabecalho: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
    },
    toggle: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
      minHeight: t.minTouch,
    },
    titulo: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
    },
    chevron: {
      ...t.typography.heading,
      color: t.colors.textMuted,
      width: 16,
      textAlign: "center",
    },
    passos: {
      gap: t.spacing.sm,
    },
    passo: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: t.spacing.sm,
    },
    numero: {
      ...t.typography.bodyStrong,
      width: 20,
      textAlign: "center",
    },
    textoPasso: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      flexShrink: 1,
    },
  });
