import { useEffect } from "react";
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useReduzirMovimento, useTheme } from "../../theme";

/**
 * "Maré" — campo de ondas da identidade (ADR-0042).
 *
 * Três senoides sobrepostas que **deslizam em velocidades diferentes**. É
 * **ornamento**: não representa sinal de EEG, não carrega leitura nenhuma e por
 * isso não precisa de eixo nem legenda — o dado de verdade mora nos gráficos
 * rotulados (ADR-0027).
 *
 * **Por que deslizar em vez de redesenhar:** o mockup recalcula o traço a cada
 * quadro num `<canvas>`. Aqui cada camada é um traço **estático** de duas
 * larguras, que anda uma largura inteira e recomeça — como o desenho é
 * periódico na largura, a emenda é invisível. O quadro custa uma translação em
 * vez de centenas de senos, o que mantém a thread de JS livre para o que
 * importa; e a interferência entre as camadas, que é o efeito visual do
 * original, aparece de graça porque elas andam em ritmos diferentes.
 *
 * Coordenadas em unidades do `viewBox` com `preserveAspectRatio="none"`: o
 * traço estica na largura disponível e o componente não precisa se medir.
 */

/** Largura de referência; o traço tem o dobro para poder deslizar. */
const W = 400;
/** Passo da amostragem do traço — menor = mais liso, mais caro (uma vez só). */
const PASSO = 5;

type Camada = {
  /** Posição vertical, em fração da altura. */
  base: number;
  /** Escala de amplitude. */
  escala: number;
  /** Deslocamento de fase, para as camadas não nascerem alinhadas. */
  fase: number;
  /** Multiplicador de duração — é o que as faz interferir. */
  ritmo: number;
};

const CAMADAS: Camada[] = [
  { base: 0.42, escala: 1, fase: 0, ritmo: 1 },
  { base: 0.58, escala: 0.82, fase: 2.1, ritmo: 1.45 },
  { base: 0.74, escala: 0.64, fase: 4.2, ritmo: 0.78 },
];

/**
 * Traço periódico na largura `W`, desenhado até `2W`.
 *
 * Os três harmônicos são múltiplos **inteiros** da largura de propósito: é o
 * que garante que o fim do primeiro período case exatamente com o começo do
 * segundo, e portanto que o laço não tenha costura visível.
 */
function traco(altura: number, camada: Camada, amplitude: number): string {
  const y0 = altura * camada.base;
  const a = amplitude * camada.escala;
  let d = "";
  for (let x = 0; x <= W * 2; x += PASSO) {
    const y =
      y0 +
      Math.sin((2 * Math.PI * x) / W + camada.fase) * a +
      Math.sin((4 * Math.PI * x) / W + camada.fase * 2.1) * a * 0.45 +
      Math.sin((6 * Math.PI * x) / W + camada.fase * 3.7) * a * 0.28;
    d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`;
  }
  return d;
}

type Props = {
  height?: number;
  /** Uma cor por camada; o padrão usa os dois tons de destaque da marca. */
  colors?: [string, string, string];
  /** Opacidade da primeira camada (as seguintes decaem). */
  opacity?: number;
  /** Amplitude base, em unidades do viewBox. */
  amplitude?: number;
  /** Segundos que a camada mais lenta leva para percorrer uma largura. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export function WaveField({
  height = 120,
  colors,
  opacity = 0.55,
  amplitude = 18,
  duration = 16,
  style,
}: Props) {
  const t = useTheme();
  const reduzirMovimento = useReduzirMovimento();

  // A translação precisa ser em **pixels** (porcentagem em `translateX` não
  // vale no nativo), mas a faixa **não precisa se medir**: o traço é periódico
  // na largura que este componente escolhe, então andar exatamente essa
  // largura é sem costura seja qual for o tamanho do container. Usar a janela
  // como escala nominal garante um valor > 0 desde o primeiro quadro — medir
  // com `onLayout` daria 0 na montagem e a onda nunca sairia do lugar.
  const largura = useWindowDimensions().width;

  const tons: [string, string, string] = colors ?? [
    t.colors.accentPatient,
    t.colors.accentDoctor,
    t.colors.accentPatient,
  ];

  return (
    <View style={[{ height, pointerEvents: "none", overflow: "hidden" }, style]}>
      {CAMADAS.map((camada, i) => (
        <Camada
          key={i}
          camada={camada}
          cor={tons[i]}
          altura={height}
          largura={largura}
          amplitude={amplitude}
          opacidade={opacity * (1 - i * 0.22)}
          duracao={duration * camada.ritmo}
          parado={reduzirMovimento}
        />
      ))}
    </View>
  );
}

type CamadaProps = {
  camada: Camada;
  cor: string;
  altura: number;
  largura: number;
  amplitude: number;
  opacidade: number;
  duracao: number;
  parado: boolean;
};

function Camada({
  camada,
  cor,
  altura,
  largura,
  amplitude,
  opacidade,
  duracao,
  parado,
}: CamadaProps) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    // Com "reduzir movimento" ligado a onda fica parada num quadro qualquer —
    // continua sendo a mesma figura, só não desliza.
    if (parado) return;
    progresso.value = withRepeat(
      withTiming(1, { duration: duracao * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duracao, parado, progresso]);

  // Anda exatamente uma largura e recomeça — como o traço é periódico nessa
  // largura, o salto de volta é invisível. Só a transformação anima, e ela
  // roda na thread de UI: o quadro não custa nada à thread de JS.
  const deslizar = useAnimatedStyle(() => ({
    transform: [{ translateX: -largura * progresso.value }],
  }));

  return (
    <Animated.View style={[ABSOLUTO, { width: largura * 2 }, deslizar]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W * 2} ${altura}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* O mockup desbota o traço nas pontas com um gradiente preso ao
            painel. Aqui o traço **anda**, então um gradiente preso a ele
            viajaria junto e viraria um brilho deslizante — a camada leva
            opacidade uniforme, que é estável em qualquer posição do laço. */}
        <Path
          d={traco(altura, camada, amplitude)}
          fill="none"
          stroke={cor}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={opacidade}
        />
      </Svg>
    </Animated.View>
  );
}

const ABSOLUTO = {
  bottom: 0,
  left: 0,
  position: "absolute",
  top: 0,
} as const;
