import { useEffect, useMemo } from "react";
import { StyleSheet, type DimensionValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme, type Theme } from "../theme";
import { useReduzirMovimento } from "./brand/useReduzirMovimento";

/**
 * Bloco cinza que ocupa o lugar de um conteúdo em carregamento.
 *
 * Melhor que um "carregando…" solto porque mostra **a forma do que vem** — a
 * página não pula quando os dados chegam. Não promete conteúdo: se a busca
 * falhar ou vier vazia, quem decide o que dizer é a tela.
 */

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

export function Skeleton({ width = "100%", height = 14, radius }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const parado = useReduzirMovimento();
  const pulso = useSharedValue(0);

  useEffect(() => {
    if (parado) return;
    pulso.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [parado, pulso]);

  const respirar = useAnimatedStyle(() => ({ opacity: 0.5 + pulso.value * 0.35 }));

  return (
    <Animated.View
      style={[
        styles.bloco,
        { width, height, borderRadius: radius ?? t.radius.sm },
        parado ? { opacity: 0.6 } : respirar,
      ]}
    />
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    bloco: {
      backgroundColor: t.colors.surfaceStrong,
    },
  });
