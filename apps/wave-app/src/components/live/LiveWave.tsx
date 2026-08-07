import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";

import { useTheme, withAlpha } from "../../theme";
import { useReduzirMovimento } from "../brand/useReduzirMovimento";

/**
 * Onda do herói da tela ao vivo — porte de `Design/round1/estado-ao-vivo.html`.
 *
 * **Isto não é o sinal.** É uma figura de ritmo, estilizada, que diz "a sessão
 * está correndo" — e a tela afirma isso em letras, com o chip "visualização
 * estilizada — não é exame" ao lado. Desenhar o EEG bruto aqui seria bonito e
 * desonesto: o traço de canal único cheio de artefato pareceria um exame sem
 * ser um, e o produto é não-clínico (Medical/71, ADR-0027). O que se lê de
 * verdade está nas medidas rotuladas abaixo, todas vindas do servidor.
 *
 * Mesma técnica do `WaveField` da marca: três traços **estáticos e periódicos**
 * que deslizam em ritmos diferentes, em vez de um caminho recalculado por
 * quadro. A thread de JS fica livre para o stream do sensor, que é justamente o
 * que está acontecendo nesta tela.
 */

/** Largura de referência; cada traço tem o dobro para poder deslizar. */
const W = 400;
const PASSO = 4;

type Camada = {
  /** Harmônicos **inteiros** de `W` — é o que faz o laço não ter costura. */
  harmonicos: [number, number, number, number];
  amplitude: number;
  opacidade: number;
  largura: number;
  /** Segundos para percorrer uma largura. */
  duracao: number;
};

const CAMADAS: Camada[] = [
  { harmonicos: [3, 6, 1, 12], amplitude: 1, opacidade: 1, largura: 2, duracao: 7 },
  { harmonicos: [2, 5, 1, 9], amplitude: 0.85, opacidade: 0.18, largura: 1.2, duracao: 11 },
  { harmonicos: [4, 7, 2, 14], amplitude: 1.15, opacidade: 0.12, largura: 1.2, duracao: 15 },
];

function traco(altura: number, camada: Camada, escala: number): string {
  const meio = altura * 0.52;
  const [h1, h2, h3, h4] = camada.harmonicos;
  const a = 14 * camada.amplitude * escala;
  let d = "";
  for (let x = 0; x <= W * 2; x += PASSO) {
    const u = (2 * Math.PI * x) / W;
    const y =
      meio +
      Math.sin(u * h1) * a +
      Math.sin(u * h2 + 1.7) * a * 0.42 +
      Math.sin(u * h3 + 3.1) * a * 1.4 +
      Math.sin(u * h4 + 0.6) * a * 0.17;
    d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`;
  }
  return d;
}

type Props = {
  height?: number;
  accent: string;
  /**
   * Amplitude relativa (0 a 1). Só muda o **tamanho** do ornamento — não
   * codifica medida nenhuma; serve para a figura murchar quando não há
   * captação correndo.
   */
  scale?: number;
  /** Congela a figura (sessão parada). */
  paused?: boolean;
};

export function LiveWave({ height = 260, accent, scale = 1, paused }: Props) {
  const t = useTheme();
  const reduzirMovimento = useReduzirMovimento();
  const largura = useWindowDimensions().width;
  const parado = paused || reduzirMovimento;

  return (
    <View style={{ height, overflow: "hidden", pointerEvents: "none" }}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Linha de repouso: dá eixo visual à figura sem prometer escala. */}
        <Line
          x1={0}
          y1={height * 0.52}
          x2={W}
          y2={height * 0.52}
          stroke={t.colors.borderSoft}
          strokeWidth={1}
        />
      </Svg>
      {CAMADAS.map((camada, i) => (
        <Traco
          key={i}
          camada={camada}
          altura={height}
          largura={largura}
          cor={accent}
          escala={scale}
          parado={parado}
        />
      ))}
    </View>
  );
}

type TracoProps = {
  camada: Camada;
  altura: number;
  largura: number;
  cor: string;
  escala: number;
  parado: boolean;
};

function Traco({ camada, altura, largura, cor, escala, parado }: TracoProps) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    if (parado) return;
    progresso.value = withRepeat(
      withTiming(1, { duration: camada.duracao * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [camada.duracao, parado, progresso]);

  const deslizar = useAnimatedStyle(() => ({
    transform: [{ translateX: -largura * progresso.value }],
  }));

  return (
    <Animated.View
      style={[
        { bottom: 0, left: 0, position: "absolute", top: 0, width: largura * 2 },
        deslizar,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W * 2} ${altura}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <Path
          d={traco(altura, camada, escala)}
          fill="none"
          stroke={camada.opacidade < 1 ? withAlpha(cor, camada.opacidade) : cor}
          strokeWidth={camada.largura}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
