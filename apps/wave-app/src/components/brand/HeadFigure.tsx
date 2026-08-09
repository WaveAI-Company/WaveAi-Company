import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { palettes, useReduzirMovimento, withAlpha } from "../../theme";

/**
 * Figura da identidade: perfil abstrato sob um domo de sensores, com uma
 * constelação de pontos que **nomeiam o que o produto faz** (ADR-0042).
 *
 * Traduz o SVG do design "Maré" (`Design/round1/login.html`). Duas coisas
 * mudam de propósito no porte:
 *
 * - **rótulo por toque, não por `hover`** — o mockup é de navegador; aqui a
 *   mesma figura precisa funcionar no dedo, como já vale para o `InfoButton`;
 * - **os pontos são `Pressable`s por cima do desenho**, não áreas de toque
 *   dentro do SVG. Dois motivos: o alvo passa a ter 44px de verdade (dentro do
 *   SVG ele encolheria junto com a figura, ficando em ~17px) e cada ponto vira
 *   um botão real para o leitor de tela, em vez de enfeite mudo.
 *
 * O desenho é anatomicamente **abstrato** e os rótulos citam só recursos do
 * app: nada aqui sugere exame, laudo ou leitura clínica (Medical/71).
 */

type No = {
  /** Aparece ao tocar o ponto. */
  rotulo: string;
  cx: number;
  cy: number;
  r: number;
  halo: number;
  /** Caixa do rótulo, em coordenadas do viewBox. */
  tag: { x: number; y: number; w: number };
};

const NOS: No[] = [
  {
    rotulo: "Estado ao vivo · sensor frontal",
    cx: 118,
    cy: 152,
    r: 5.5,
    halo: 9,
    tag: { x: 8, y: 108, w: 196 },
  },
  {
    rotulo: "Tendências ao longo do tempo",
    cx: 208,
    cy: 58,
    r: 5.5,
    halo: 9,
    tag: { x: 222, y: 40, w: 190 },
  },
  {
    rotulo: "Sessões e histórico",
    cx: 316,
    cy: 164,
    r: 5.5,
    halo: 9,
    tag: { x: 278, y: 120, w: 132 },
  },
  {
    rotulo: "Composição por banda",
    cx: 222,
    cy: 118,
    r: 4.5,
    halo: 7.5,
    tag: { x: 236, y: 100, w: 158 },
  },
  {
    rotulo: "Protocolo guiado por voz",
    cx: 298,
    cy: 300,
    r: 4.5,
    halo: 7.5,
    tag: { x: 146, y: 326, w: 170 },
  },
];

/** Ligações da constelação (índices em coordenadas do viewBox). */
const LIGACOES: [number, number, number, number][] = [
  [118, 152, 208, 58],
  [208, 58, 316, 164],
  [316, 164, 298, 300],
  [118, 152, 222, 118],
  [222, 118, 316, 164],
];

/** Lado do alvo de toque de cada ponto (piso de acessibilidade). */
const ALVO = 44;

// A figura vive sempre sobre o painel escuro da marca, mesmo no tema claro —
// então as cores vêm da paleta escura, não do tema em uso.
const P = palettes.dark;

type Props = {
  /** Largura em pixels; a altura sai da proporção do viewBox. */
  width?: number;
};

export function HeadFigure({ width = 300 }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const reduzirMovimento = useReduzirMovimento();
  const pulso = useSharedValue(0);

  useEffect(() => {
    if (reduzirMovimento) return;
    pulso.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [pulso, reduzirMovimento]);

  const escala = width / 420;
  const altura = (width * 500) / 420;

  return (
    <View style={{ width, height: altura }}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 420 500" fill="none" aria-hidden>
      {/* silhueta de perfil (abstrata) */}
      <Path
        d="M208 46 C 158 50 122 92 116 148 C 114 170 117 186 112 200 C 108 212 100 222 104 232 C 107 240 116 240 118 246 C 120 252 114 258 116 266 C 118 274 126 272 128 280 C 130 290 122 300 130 312 C 138 324 158 322 172 328 C 186 334 190 348 192 366 L 196 458"
        stroke={withAlpha(P.text, 0.28)}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M208 46 C 268 44 318 92 324 158 C 330 224 316 268 302 316 C 292 352 290 400 292 458"
        stroke={withAlpha(P.text, 0.28)}
        strokeWidth={1.6}
        strokeLinecap="round"
      />

      {/* domo de sensores */}
      <Path d="M120 160 C 130 74 288 60 318 168" stroke={withAlpha(P.accentDoctor, 0.3)} strokeWidth={1} />
      <Path d="M112 190 C 118 60 300 42 330 200" stroke={withAlpha(P.accentDoctor, 0.17)} strokeWidth={1} />
      <Path d="M126 136 C 148 92 272 82 306 140" stroke={withAlpha(P.accentDoctor, 0.24)} strokeWidth={1} />

      {LIGACOES.map(([x1, y1, x2, y2], i) => (
        <Line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={withAlpha(P.accentPatient, 0.35)}
          strokeWidth={1}
        />
      ))}

        {NOS.map((no, i) => (
          <G key={no.rotulo}>
            <Circle
              cx={no.cx}
              cy={no.cy}
              r={ativo === i ? no.r + 1.5 : no.r}
              fill={P.accentPatient}
            />
            {ativo === i ? (
              <>
                <Rect
                  x={no.tag.x}
                  y={no.tag.y}
                  width={no.tag.w}
                  height={26}
                  rx={7}
                  fill={withAlpha(P.background, 0.85)}
                  stroke={withAlpha(P.accentPatient, 0.4)}
                  strokeWidth={1}
                />
                <SvgText
                  x={no.tag.x + 10}
                  y={no.tag.y + 17}
                  fill={P.text}
                  fontSize={11.5}
                  fontWeight="600"
                >
                  {no.rotulo}
                </SvgText>
              </>
            ) : null}
          </G>
        ))}
      </Svg>

      {/* Halos por cima do SVG, como `View`s: pulsar aqui é transformação de
          caixa (escala + opacidade), que o driver nativo anima sem passar pela
          thread de JS a cada quadro. */}
      {NOS.map((no) => (
        <Halo
          key={`halo-${no.rotulo}`}
          no={no}
          escala={escala}
          pulso={pulso}
          parado={reduzirMovimento}
        />
      ))}

      {NOS.map((no, i) => (
        <Pressable
          key={no.rotulo}
          accessibilityRole="button"
          accessibilityLabel={no.rotulo}
          accessibilityState={{ selected: ativo === i }}
          onPress={() => setAtivo((atual) => (atual === i ? null : i))}
          style={{
            position: "absolute",
            left: no.cx * escala - ALVO / 2,
            top: no.cy * escala - ALVO / 2,
            height: ALVO,
            width: ALVO,
          }}
        />
      ))}
    </View>
  );
}

type HaloProps = {
  no: No;
  /** Fator entre as unidades do viewBox e os pixels da tela. */
  escala: number;
  pulso: SharedValue<number>;
  parado: boolean;
};

/** Anel que cresce e some ao redor do ponto — a "respiração" da figura. */
function Halo({ no, escala, pulso, parado }: HaloProps) {
  const lado = no.halo * 2 * escala;
  const base = {
    position: "absolute",
    left: no.cx * escala - lado / 2,
    top: no.cy * escala - lado / 2,
    height: lado,
    width: lado,
    borderRadius: lado / 2,
    borderWidth: 1.2,
    borderColor: withAlpha(P.accentPatient, 0.5),
  } as const;

  const pulsar = useAnimatedStyle(() => ({
    opacity: 0.65 * (1 - pulso.value),
    transform: [{ scale: 1 + pulso.value * 0.55 }],
  }));

  if (parado) {
    return <View style={[base, { opacity: 0.4 }]} />;
  }

  return <Animated.View style={[base, pulsar]} />;
}
