import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { useTheme } from "../theme";

/**
 * Ícones de traço do design "Maré" (ADR-0042).
 *
 * Todos vêm da mesma grade 24×24, desenhados só com **traço** (`stroke`), sem
 * preenchimento: é o que faz um ícone herdar a cor do texto ao lado e funcionar
 * nos dois temas sem uma segunda arte. Antes da `react-native-svg` o app
 * desenhava com `View`, o que serve para uma marca e não para um conjunto.
 *
 * **Os traçados são os do Fable** (P8-b): cada `d` aqui foi conferido contra o
 * SVG inline correspondente em `Design/round1/*.html`. Onde o mockup usa
 * `<rect rx>`, aqui também usa — desenhar a mesma caixa com `h/v/Z` dava
 * cantos vivos, e era boa parte do que fazia o conjunto parecer de outra
 * família.
 *
 * O conjunto cresce **sob demanda**, tela a tela — um catálogo especulativo só
 * junta peso de bundle e arte sem uso.
 */

/** Cada ícone é uma função do traço, porque alguns misturam formas. */
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
      <Rect
        x={3}
        y={4}
        width={18}
        height={13}
        rx={2.5}
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
      <Path d="M9 21h6M12 17.5V21" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  /** Consentimento — escudo com visto. */
  shield: (c: string, w: number) => (
    <>
      <Path
        d="M12 3 4.5 6v5c0 4.5 3 8.2 7.5 10 4.5-1.8 7.5-5.5 7.5-10V6Z"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
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
      <Rect
        x={3}
        y={5}
        width={18}
        height={14}
        rx={3}
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m3.5 7 8.5 6 8.5-6"
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
      <Ellipse cx={12} cy={6} rx={8} ry={3} stroke={c} strokeWidth={w} />
      <Path
        d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
      <Path
        d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"
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
  /** Fechar. */
  x: (c: string, w: number) => (
    <Path
      d="m6.5 6.5 11 11M17.5 6.5l-11 11"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
    />
  ),
  /** Controle do titular — cadeado. */
  lock: (c: string, w: number) => (
    <>
      <Rect
        x={4}
        y={10}
        width={16}
        height={10}
        rx={2.5}
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  /**
   * Gerenciar — engrenagem.
   *
   * **Redesenhada na P8-b.** O que existia aqui era o `sun` com o círculo
   * menor — mesmo miolo, mesmos oito raios retos —, o que não lê como
   * engrenagem. O corpo do mockup (`consentimento.html`) também não servia
   * para copiar: o traçado dele descreve **só a metade de baixo** e não fecha;
   * à risca, renderizaria uma engrenagem cortada.
   *
   * Então esta é gerada por geometria, não desenhada à mão: oito dentes entre
   * os raios 7,0 e 9,3 em torno do centro (12,12), com o `strokeLinejoin`
   * arredondando os cantos. Simétrica por construção e contida no viewBox.
   */
  gear: (c: string, w: number) => (
    <>
      <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={w} />
      <Path
        d="M10.5 2.8L13.5 2.8L13.1 5.1L16.1 6.3L17.4 4.4L19.6 6.6L17.7 7.9L18.9 10.9L21.2 10.5L21.2 13.5L18.9 13.1L17.7 16.1L19.6 17.4L17.4 19.6L16.1 17.7L13.1 18.9L13.5 21.2L10.5 21.2L10.9 18.9L7.9 17.7L6.6 19.6L4.4 17.4L6.3 16.1L5.1 13.1L2.8 13.5L2.8 10.5L5.1 10.9L6.3 7.9L4.4 6.6L6.6 4.4L7.9 6.3L10.9 5.1Z"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
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
  /** Busca. */
  search: (c: string, w: number) => (
    <>
      <Circle cx={11} cy={11} r={7} stroke={c} strokeWidth={w} />
      <Path d="m20 20-3.8-3.8" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  /** Convidar alguém — pessoa com mais. */
  userPlus: (c: string, w: number) => (
    <>
      <Circle cx={9} cy={8} r={3.5} stroke={c} strokeWidth={w} />
      <Path
        d="M2.5 20c1.2-3.4 3.7-5 6.5-5s5.3 1.6 6.5 5"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
      <Path d="M17.5 6.5v6M14.5 9.5h6" stroke={c} strokeWidth={w} strokeLinecap="round" />
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
  /** Início. */
  home: (c: string, w: number) => (
    <>
      <Path
        d="M3 11 12 3l9 8"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 10v10h14V10"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  /** Histórico de sessões — calendário. */
  calendar: (c: string, w: number) => (
    <>
      <Rect
        x={3}
        y={4}
        width={18}
        height={17}
        rx={3}
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
      <Path
        d="M3 9h18M8 2.5V6M16 2.5V6"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Painel do profissional — grade de cartões. */
  grid: (c: string, w: number) => (
    <>
      <Rect x={3} y={3} width={8} height={8} rx={2} stroke={c} strokeWidth={w} />
      <Rect x={13} y={3} width={8} height={8} rx={2} stroke={c} strokeWidth={w} />
      <Rect x={3} y={13} width={8} height={8} rx={2} stroke={c} strokeWidth={w} />
      <Rect x={13} y={13} width={8} height={8} rx={2} stroke={c} strokeWidth={w} />
    </>
  ),
  /** Voltar. */
  chevronLeft: (c: string, w: number) => (
    <Path
      d="m15 6-6 6 6 6"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /** Avançar. */
  chevronRight: (c: string, w: number) => (
    <Path
      d="m9 6 6 6-6 6"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /** Abrir a explicação de um termo (camada didática). */
  info: (c: string, w: number) => (
    <>
      <Circle cx={12} cy={12} r={9.2} stroke={c} strokeWidth={w} />
      <Path d="M12 8v5" stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={16.5} r={0.5} fill={c} />
    </>
  ),
  /** Abrir o menu de navegação (telas estreitas). */
  menu: (c: string, w: number) => (
    <Path
      d="M3 6h18M3 12h18M3 18h18"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
    />
  ),
  /** Registro escrito — anotação de uma sessão. */
  fileText: (c: string, w: number) => (
    <>
      <Path
        d="M5 4h11l3 3v13H5z"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 10h6M9 14h4" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  /**
   * Direção de uma tendência ao longo das sessões.
   *
   * Setas e não cor: subir não é bom nem ruim aqui (ADR-0027). São três
   * ícones e não uma seta rotacionada porque `transform` no `Svg` do
   * react-native-svg gira também a caixa, e o alinhamento com o texto ao lado
   * deixaria de ser previsível.
   */
  arrowUp: (c: string, w: number) => (
    <Path
      d="M12 19.5V4.5M6 10.5 12 4.5l6 6"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /** Ver `arrowUp`. */
  arrowDown: (c: string, w: number) => (
    <Path
      d="M12 4.5v15M6 13.5l6 6 6-6"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /** Ver `arrowUp`. Direção estável. */
  arrowRight: (c: string, w: number) => (
    <Path
      d="M4.5 12h15M13.5 6l6 6-6 6"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  /**
   * Guia por voz ligada.
   *
   * **Desenhado aqui, não copiado:** o protocolo guiado por voz é nosso (P4) e
   * o round 1 não tem esse botão. O lugar dele era um emoji colorido (🔊), que
   * num conjunto monocromático de traço lê como corpo estranho — e não herda a
   * cor do papel.
   */
  volume: (c: string, w: number) => (
    <>
      <Path
        d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.5 9.8a3.2 3.2 0 0 1 0 4.4M18 7.5a6.5 6.5 0 0 1 0 9"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
      />
    </>
  ),
  /** Guia por voz silenciada — o mesmo alto-falante, com as ondas cortadas. */
  volumeOff: (c: string, w: number) => (
    <>
      <Path
        d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"
        stroke={c}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m16 9.5 5 5M21 9.5l-5 5" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONES;

type Props = {
  name: IconName;
  size?: number;
  /** Padrão: a cor de texto do tema. */
  color?: string;
  /** Espessura do traço na grade 24×24. Sem valor, segue a regra do Fable. */
  strokeWidth?: number;
};

/**
 * Espessura padrão, medida no mockup: **1,8** em quase todo ícone de interface,
 * e **1,6** nos grandes (28px para cima).
 *
 * O motivo não é estético e sim óptico: o traço é declarado na grade de 24 e
 * escala junto com o ícone, então 1,8 num selo de 52px vira um traço gordo. O
 * Fable afina os grandes; nós fazíamos 1,7 em tudo.
 */
const TRACO_GRANDE = 28;
const tracoPadrao = (size: number) => (size >= TRACO_GRANDE ? 1.6 : 1.8);

export function Icon({ name, size = 20, color, strokeWidth }: Props) {
  const t = useTheme();
  const cor = color ?? t.colors.text;
  const traco = strokeWidth ?? tracoPadrao(size);

  return (
    // `aria-hidden` mantém o ícone fora do leitor de tela: quem descreve a ação
    // é o rótulo do controle que o envolve, e um nome duplicado só atrapalha a
    // navegação. É o atributo que vale nas duas pontas — no web vira o atributo
    // do próprio `<svg>`, sem prop desconhecida vazando para o DOM.
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {ICONES[name](cor, traco)}
    </Svg>
  );
}
