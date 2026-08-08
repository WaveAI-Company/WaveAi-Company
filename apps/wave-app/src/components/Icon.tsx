import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "../theme";

/**
 * Ícones de traço do design "Maré" (ADR-0042).
 *
 * Todos vêm da mesma grade 24×24, desenhados só com **traço** (`stroke`), sem
 * preenchimento: é o que faz um ícone herdar a cor do texto ao lado e funcionar
 * nos dois temas sem uma segunda arte. Antes da `react-native-svg` o app
 * desenhava com `View`, o que serve para uma marca e não para um conjunto.
 *
 * O conjunto cresce **sob demanda**, tela a tela — um catálogo especulativo só
 * junta peso de bundle e arte sem uso.
 */

/** Cada ícone é uma função do traço, porque alguns misturam `Path` e `Circle`. */
const ICONES = {
  /** Revelar senha. */
  eye: (c: string, w: number) => (
    <>
      <Path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={2.8} stroke={c} strokeWidth={w} />
    </>
  ),
  /** Ocultar senha — o mesmo olho, cortado. */
  eyeOff: (c: string, w: number) => (
    <>
      <Path
        d="M3 3l18 18M10.6 6C11.05 5.9 11.5 5.9 12 5.9c6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-3.3 3.9M6.4 8.1A17 17 0 0 0 2.5 12S6 18.1 12 18.1c1.2 0 2.3-.24 3.3-.63"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.6 9.9a3 3 0 0 0 4.2 4.2"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Tema escuro em uso. */
  moon: (c: string, w: number) => (
    <Path
      d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /** Tema claro em uso. */
  sun: (c: string, w: number) => (
    <>
      <Circle cx={12} cy={12} r={4.2} stroke={c} strokeWidth={w} />
      <Path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Tema seguindo o sistema — a tela do aparelho. */
  monitor: (c: string, w: number) => (
    <>
      <Path
        d="M3.2 5.5h17.6v11H3.2Z"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <Path d="M9 20.5h6M12 16.5v4" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  /** Consentimento — escudo com visto. */
  shield: (c: string, w: number) => (
    <>
      <Path
        d="M12 3 4.5 6v5c0 4.5 3 8.2 7.5 10 4.5-1.8 7.5-5.5 7.5-10V6Z"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <Path
        d="m8.8 11.8 2.3 2.3 4.1-4.6"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  /** Confirmação de um ato que acabou de acontecer. */
  check: (c: string, w: number) => (
    <Path
      d="M4.5 12.5 10 18 19.5 7"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /** Convites — envelope. */
  mail: (c: string, w: number) => (
    <>
      <Path
        d="M3.5 5.5h17v13h-17Z"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <Path
        d="m3.9 6.6 8.1 5.8 8.1-5.8"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  /** O que é guardado — cilindro de dados. */
  database: (c: string, w: number) => (
    <>
      <Path
        d="M20 6c0 1.66-3.58 3-8 3S4 7.66 4 6s3.58-3 8-3 8 1.34 8 3Z"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <Path
        d="M4 6v12c0 1.7 3.58 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.58 3 8 3s8-1.3 8-3"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** O que não é feito — o círculo cortado. */
  xCircle: (c: string, w: number) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={w} />
      <Path d="m8.5 8.5 7 7M15.5 8.5l-7 7" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  /** Controle do titular — cadeado. */
  lock: (c: string, w: number) => (
    <>
      <Path
        d="M4.5 10.5h15v10h-15Z"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  /** Gerenciar — engrenagem simplificada. */
  gear: (c: string, w: number) => (
    <>
      <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={w} />
      <Path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Titular — uma pessoa. */
  user: (c: string, w: number) => (
    <>
      <Circle cx={12} cy={8} r={4} stroke={c} strokeWidth={w} />
      <Path
        d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Profissional de bem-estar — quem acompanha alguém. */
  users: (c: string, w: number) => (
    <>
      <Circle cx={9} cy={8} r={3.5} stroke={c} strokeWidth={w} />
      <Path
        d="M2.5 20c1.2-3.4 3.7-5 6.5-5s5.3 1.6 6.5 5"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
      <Circle cx={17} cy={9} r={2.8} stroke={c} strokeWidth={w} />
      <Path
        d="M15.5 15.2c2.8.1 5 1.6 6 4.8"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Onda — símbolo da marca. */
  wave: (c: string, w: number) => (
    <Path
      d="M2 12c2.5 0 2.5-5 5-5s2.5 8 5 8 2.5-8 5-8 2.5 5 5 5"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
} as const;

export type IconName = keyof typeof ICONES;

type Props = {
  name: IconName;
  size?: number;
  /** Padrão: a cor de texto do tema. */
  color?: string;
  /** Espessura do traço na grade 24×24. */
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color, strokeWidth = 1.7 }: Props) {
  const t = useTheme();
  const cor = color ?? t.colors.text;

  return (
    // `aria-hidden` mantém o ícone fora do leitor de tela: quem descreve a ação
    // é o rótulo do controle que o envolve, e um nome duplicado só atrapalha a
    // navegação. É o atributo que vale nas duas pontas — no web vira o atributo
    // do próprio `<svg>`, sem prop desconhecida vazando para o DOM.
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {ICONES[name](cor, strokeWidth)}
    </Svg>
  );
}
