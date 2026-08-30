import { useMemo, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Disclaimer } from "../Disclaimer";
import { Icon } from "../Icon";
import { HeadFigure } from "../brand/HeadFigure";
import { Logo } from "../brand/Logo";
import { WaveField } from "../brand/WaveField";
import {
  anelFoco,
  motion,
  palettes,
  transicao,
  useInteracao,
  useTheme,
  withAlpha,
  type Theme,
} from "../../theme";

/**
 * Palco das telas de autenticação — porte do design "Maré" (ADR-0042).
 *
 * Login e criar-conta são a **mesma cena** no design: painel de marca à
 * esquerda, formulário à direita. Estava tudo dentro do `login.tsx`; ao portar
 * a segunda tela, duplicar os ~200 estilos garantiria que as duas divergissem
 * na primeira correção. Aqui a cena é uma só e cada tela traz o seu conteúdo.
 *
 * O layout tem três formas, como no design: **duas colunas** (marca ao lado do
 * formulário), **empilhado** (marca acima) e **compacto** (só um cabeçalho de
 * marca, sem a figura). A quebra é por largura de janela, não por plataforma —
 * é a mesma tela num tablet e num navegador estreito.
 */

/** A partir daqui cabem marca e formulário lado a lado. */
const LARGURA_DUAS_COLUNAS = 1100;
/** Abaixo daqui a figura sai e sobra só o cabeçalho de marca. */
const LARGURA_MARCA_CHEIA = 640;

/** O painel da marca é sempre escuro, mesmo no tema claro — como no design. */
const P = palettes.dark;

type Props = {
  /** Chamada do painel de marca; `destaque` sai na cor da marca. */
  chamada: { antes: string; destaque: string; depois: string };
  /** Parágrafo sob a chamada. */
  texto: string;
  /** Pílulas do painel de marca. */
  chips: string[];
  /** Frase curta do cabeçalho compacto, em telas estreitas. */
  resumo: string;
  /** Teto do cartão de formulário — o design usa 400 no login e 420 no cadastro. */
  larguraCartao?: number;
  children: ReactNode;
};

export function AuthStage({
  chamada,
  texto,
  chips,
  resumo,
  larguraCartao = 400,
  children,
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { width } = useWindowDimensions();

  const duasColunas = width >= LARGURA_DUAS_COLUNAS;
  const marcaCheia = width >= LARGURA_MARCA_CHEIA;

  return (
    <View style={styles.palco}>
      {/**
       * **Uma rolagem só, para as duas colunas.** A marca era irmã do
       * `ScrollView`: entre 640 e 1099 ela virava uma faixa fixa no topo com
       * `overflow:hidden`, e o que não coubesse na janela ficava cortado sem
       * jeito de alcançar. O mockup faz `grid-template-rows: auto 1fr` nessa
       * faixa — marca e formulário rolam **na mesma página**.
       *
       * Trocar a marca de lugar conforme a faixa remontaria o formulário a
       * cada cruzamento de quebra (e o que a pessoa digitou some junto). Por
       * isso a árvore é uma só e o que muda é a **direção** do contêiner.
       */}
      <ScrollView
        style={styles.rolagem}
        contentContainerStyle={[styles.conteudo, duasColunas && styles.conteudoLado]}
        keyboardShouldPersistTaps="handled"
      >
        {marcaCheia ? (
          <PainelMarca
            empilhado={!duasColunas}
            chamada={chamada}
            texto={texto}
            chips={chips}
          />
        ) : null}

        <View
          style={[
            styles.colunaAuth,
            duasColunas ? styles.colunaAuthLado : null,
            marcaCheia ? styles.colunaAuthRespiro : styles.colunaAuthRespiroCompacto,
          ]}
        >
          {/* `.theme-toggle{position:absolute; top:20px; right:20px}` — fora do
              fluxo, no canto do painel de autenticação. No fluxo ele entrava na
              centralização da coluna e descia junto com o cartão (medido: 212px
              do topo em 1400x900, contra os 20 do mockup). */}
          <AlternarTema />

          {!marcaCheia ? (
            <View style={styles.marcaCompacta}>
              {/* Sem tagline: aqui embaixo de 640px a assinatura ocupava duas
                  linhas e o `resumo` logo abaixo já diz o que o produto é. Duas
                  frases empilhadas antes dele competiam, não somavam. */}
              <Logo size={34} forma="completa" withWordmark />
              <Text style={styles.marcaCompactaTexto}>{resumo}</Text>
              <WaveField height={48} opacity={0.4} amplitude={10} style={styles.ondaCompacta} />
            </View>
          ) : null}

          <View style={[styles.cartao, { maxWidth: larguraCartao }]}>{children}</View>

          {/* `.page-foot{position:absolute; bottom:14px; left:0; right:0}`,
              dentro do painel de autenticação. Era uma **linha irmã** abaixo da
              rolagem: como consumia altura (32px medidos em 1400x900), a coluna
              da marca parava antes do fundo e, no tema claro, sobrava uma faixa
              clara sob ela. Fora do fluxo, a marca vai até o fim e o aviso já
              nasce centrado sob o formulário, sem replicar proporção nenhuma. */}
          <View style={styles.rodape}>
            <Disclaimer placement="auth" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Alterna claro/escuro sem sair da tela (a autenticação roda fora da casca). */
function AlternarTema() {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const irPara = t.isDark ? "light" : "dark";
  const { estado, handlers } = useInteracao();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mudar para o tema ${t.isDark ? "claro" : "escuro"}`}
      onPress={() => t.setPreference(irPara)}
      {...handlers}
      // `.theme-toggle:hover` — só acende; o ícone já é o assunto do botão.
      style={[
        styles.botaoTema,
        estado.hovered && { backgroundColor: t.colors.surfaceAlt },
        estado.pressed && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel
          ? { boxShadow: anelFoco(t.colors.text, t.colors.background) }
          : null,
      ]}
      hitSlop={8}
    >
      <Icon name={t.isDark ? "sun" : "moon"} size={18} color={t.colors.text} />
    </Pressable>
  );
}

/**
 * Painel de marca: gradientes de fundo, figura da constelação, promessa do
 * produto e o aviso de posicionamento. Sempre em tom escuro.
 */
function PainelMarca({
  empilhado,
  chamada,
  texto,
  chips,
}: {
  empilhado: boolean;
  chamada: Props["chamada"];
  texto: string;
  chips: string[];
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={[styles.painelMarca, empilhado && styles.painelMarcaEmpilhado]}>
      {/* Dois halos de luz nos cantos opostos — o "fundo" do design. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="halo-a" cx="15%" cy="0%" rx="80%" ry="70%">
            <Stop offset="0" stopColor={P.accentPatient} stopOpacity={0.14} />
            <Stop offset="1" stopColor={P.accentPatient} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-b" cx="90%" cy="100%" rx="70%" ry="60%">
            <Stop offset="0" stopColor={P.accentDoctor} stopOpacity={0.12} />
            <Stop offset="1" stopColor={P.accentDoctor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo-a)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo-b)" />
      </Svg>

      {/* `.wordmark`: símbolo e nome **na mesma linha**. Estava empilhado, o que
          engrossava o lockup e roubava altura da figura.

          Sem sobrancelha: a chamada logo abaixo ("A calma tem um ritmo…") já é
          a voz da marca nesta tela, e uma frase acima dela só disputava a
          atenção.

          O `gradiente` vem de `P` e não do tema: este painel é escuro sempre
          (`P = palettes.dark`), e com o par do tema claro a marca caía para
          3,60:1 / 3,05:1 sobre ele — apagada. Com o par escuro são 10,04:1 e
          7,43:1, nos dois temas. */}
      <View style={styles.marcaTopo}>
        <Logo size={34} forma="completa" gradiente={[P.accentPatient, P.accentDoctor]} />
        <View style={styles.marcaTextos}>
          <Text style={styles.marcaNome}>WaveAI</Text>
        </View>
      </View>

      <View style={styles.marcaCentro}>
        <HeadFigure width={empilhado ? 180 : 280} />
        <Text style={styles.chamada}>
          {chamada.antes}
          <Text style={styles.chamadaDestaque}>{chamada.destaque}</Text>
          {chamada.depois}
        </Text>
        <Text style={styles.chamadaTexto}>{texto}</Text>
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c} style={styles.chip}>
              <View style={styles.chipPonto} />
              <Text style={styles.chipTexto}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.marcaRodape}>
        Plataforma exploratória de bem-estar. Não realiza diagnóstico e não substitui
        acompanhamento de saúde.
      </Text>

      <WaveField height={140} style={styles.ondaMarca} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    palco: {
      backgroundColor: t.colors.background,
      flex: 1,
    },
    rolagem: {
      flex: 1,
    },
    // `min-height:100vh` do `.stage`: o `flexGrow` faz o conteúdo ocupar a
    // janela quando é curto, e crescer além dela quando não é.
    conteudo: {
      flexGrow: 1,
    },
    conteudoLado: {
      flexDirection: "row",
    },

    // ---------- painel da marca ----------
    painelMarca: {
      backgroundColor: P.background,
      flex: 1.15,
      justifyContent: "space-between",
      overflow: "hidden",
      padding: t.spacing.xl,
    },
    /**
     * Empilhado, a marca é a linha `auto` do `grid-template-rows:auto 1fr` —
     * **altura de conteúdo**, com 380 de piso.
     *
     * Era `flex: 0`, que o RN-web traduz para `flex: 0 1 0%`: base zero e
     * `flexShrink:1` colavam a altura no `minHeight` e o `overflow:hidden`
     * cortava o resto — 144px do herói do cadastro sumiam em 1041x840
     * (`scrollHeight` 524 contra `clientHeight` 380), e a onda do rodapé
     * subia junto. No login o texto é curto e cabia, então só o cadastro
     * mostrava o corte.
     */
    painelMarcaEmpilhado: {
      flexBasis: "auto",
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 380,
      padding: t.spacing.lg,
    },
    marcaTopo: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    marcaTextos: {
      alignItems: "baseline",
      flexDirection: "row",
      flexShrink: 1,
      flexWrap: "wrap",
      // `.wordmark small{margin-left:6px}`.
      gap: 6,
    },
    // `.wordmark{font-size:20px; font-weight:700; letter-spacing:-.01em}`.
    marcaNome: {
      ...t.typography.heading,
      color: P.text,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    marcaCentro: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
    },
    chamada: {
      ...t.typography.display,
      color: P.text,
      maxWidth: 480,
      textAlign: "center",
    },
    chamadaDestaque: {
      color: P.accentPatientText,
    },
    chamadaTexto: {
      ...t.typography.body,
      color: withAlpha(P.text, 0.72),
      maxWidth: 400,
      textAlign: "center",
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      justifyContent: "center",
      marginTop: t.spacing.xs,
    },
    chip: {
      alignItems: "center",
      backgroundColor: withAlpha(P.text, 0.06),
      borderColor: withAlpha(P.text, 0.14),
      borderRadius: t.radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: t.spacing.sm + 4,
      paddingVertical: 4,
    },
    chipPonto: {
      backgroundColor: P.accentPatient,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    chipTexto: {
      ...t.typography.caption,
      color: withAlpha(P.text, 0.8),
      fontWeight: "600",
    },
    marcaRodape: {
      ...t.typography.caption,
      alignSelf: "center",
      color: withAlpha(P.text, 0.5),
      maxWidth: 440,
      textAlign: "center",
    },
    ondaMarca: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
    },

    // ---------- painel de autenticação ----------
    /**
     * A coluna do formulário.
     *
     * `flex: 1` só vale na direção do contêiner: em linha ela divide a largura
     * com a marca (1 contra 1,15, como o `minmax(0,1.15fr) minmax(0,1fr)` do
     * mockup); empilhada, ela toma a altura que sobra e centra o cartão nela.
     */
    colunaAuth: {
      alignItems: "center",
      backgroundColor: t.colors.background,
      flexGrow: 1,
      justifyContent: "center",
    },
    colunaAuthLado: {
      flexBasis: 0,
    },
    // `.auth-panel{padding:48px 32px}` e, no tablet, `40px 32px 64px`. O fundo
    // maior é o que impede o cartão centralizado de encostar no aviso, agora
    // que ele saiu do fluxo.
    colunaAuthRespiro: {
      paddingBottom: 64,
      paddingHorizontal: t.spacing.lg + 8,
      paddingTop: 48,
    },
    // `.auth-panel{padding:28px 20px 72px}` — no compacto o aviso divide a
    // coluna com a marca reduzida, então o fundo reservado é maior ainda.
    colunaAuthRespiroCompacto: {
      paddingBottom: 72,
      paddingHorizontal: t.spacing.md,
      paddingTop: 28,
    },
    botaoTema: {
      alignItems: "center",
      position: "absolute",
      right: 20,
      top: 20,
      zIndex: 5,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      height: t.minTouch,
      justifyContent: "center",
      width: t.minTouch,
      ...transicao("background-color, box-shadow", motion.media),
    },
    marcaCompacta: {
      alignItems: "center",
      alignSelf: "stretch",
      gap: t.spacing.xs,
      overflow: "hidden",
      paddingBottom: t.spacing.md,
    },
    marcaCompactaTexto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      textAlign: "center",
    },
    ondaCompacta: {
      alignSelf: "stretch",
    },
    cartao: {
      alignSelf: "center",
      gap: t.spacing.md,
      width: "100%",
    },
    // `.page-foot{position:absolute; bottom:14px; left:0; right:0; padding:0 24px}`.
    rodape: {
      bottom: 14,
      left: 0,
      paddingHorizontal: t.spacing.lg,
      position: "absolute",
      right: 0,
    },
  });
