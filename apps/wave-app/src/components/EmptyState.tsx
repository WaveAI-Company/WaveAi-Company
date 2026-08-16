import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  shadows,
  useFaixa,
  useReduzirMovimento,
  useRoleAccent,
  useTheme,
  withAlpha,
  type Theme,
} from "../theme";
import { Icon, type IconName } from "./Icon";
import { HeadFigure } from "./brand/HeadFigure";
import { WaveField } from "./brand/WaveField";

/**
 * Cartão de estado vazio — o `.empty-hero` do design "Maré".
 *
 * **Por que virou componente (pente fino de UI, causa 3):** quatro telas
 * montavam o mesmo herói à mão e nenhuma chegava perto do mockup. Cada uma
 * escolhia seu padding, o ícone saía com fundo de superfície em vez do
 * destaque do papel, ninguém tinha o anel que respira e a onda — quando
 * existia — ficava **no fluxo**, empurrando o conteúdo, em vez de ancorada no
 * rodapé do cartão. Ajustar quatro cópias em série era garantir que a quinta
 * divergiria.
 *
 * O vazio é o primeiro contato de quem acabou de entrar, e ele não pode soar
 * como erro: por isso o cartão é acolhedor (figura, onda, respiração) e o
 * texto convida em vez de reclamar. Nada aqui afirma resultado — só descreve o
 * que vai aparecer quando houver dado (ADR-0027).
 *
 * Duas divergências deliberadas em relação ao HTML, medidas e mantidas:
 *
 * - **padding único `56/32/72`.** O mockup usa `48/32/64` na home do paciente
 *   e `56/32/72` nas outras quatro telas. Oito pixels não se veem; um segundo
 *   valor parametrizado, sim — ele vira a próxima divergência.
 * - **título em `typography.title`** (26px/700) e não `650`. A escala do
 *   sistema não tem peso intermediário, e as fontes de sistema do RN arredondam
 *   `650` para `700` de qualquer jeito.
 */

/** O que ilustra o vazio: um ícone do sistema, ou a figura da marca. */
type Adorno = { tipo: "icone"; nome: IconName } | { tipo: "figura" };

type Props = {
  adorno: Adorno;
  titulo: string;
  /** Uma frase que diz o que aparece aqui quando houver dado. */
  texto: string;
  /** Conteúdo entre o texto e a ação — os três passos da home do paciente. */
  children?: ReactNode;
  /** O CTA: `Button` na maioria das telas, `TextLink` em convites. */
  acao?: ReactNode;
  /**
   * Linha de apoio no fim do cartão (o `.t-small` do mockup).
   *
   * Em texto puro o componente já pinta nos 13px discretos do design; como nó,
   * serve à frase de convites, que tem um `TextLink` no meio e por isso precisa
   * ser uma linha de vários elementos — `TextLink` é `Pressable`, e `Pressable`
   * dentro de `Text` não é aninhamento válido no RN.
   */
  nota?: ReactNode;
};

export function EmptyState({ adorno, titulo, texto, children, acao, nota }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const movel = useFaixa() === "movel";

  return (
    <View style={styles.cartao}>
      {/* Decoração ancorada no rodapé: fora do fluxo, para não deslocar nada
          quando a altura do conteúdo muda. */}
      <WaveField height={110} opacity={0.4} amplitude={14} style={styles.onda} />

      <View style={styles.conteudo}>
        {adorno.tipo === "figura" ? (
          <HeadFigure width={190} />
        ) : (
          <IconeComAnel nome={adorno.nome} accent={papel.accent} accentTexto={papel.accentText} />
        )}
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.texto}>{texto}</Text>
        {children}
        {acao ? (
          <View style={[styles.acao, movel ? styles.acaoMovel : styles.acaoCentrada]}>{acao}</View>
        ) : null}
        {nota ? (
          <View style={styles.nota}>
            {typeof nota === "string" ? <Text style={styles.notaTexto}>{nota}</Text> : nota}
          </View>
        ) : null}
      </View>
    </View>
  );
}

type IconeProps = {
  nome: IconName;
  accent: string;
  accentTexto: string;
  /** Lado do disco — 88 no estado vazio, 64 no cabeçalho do consentimento. */
  tamanho?: number;
  tamanhoIcone?: number;
};

/**
 * Disco de 88px com o anel que respira — o `.empty-ic` e a animação `bigh`.
 *
 * O anel fica **fora** do disco (`inset:-2px` no mockup) e some ao crescer, o
 * que dá o pulso sem piscar cor nenhuma. Com "reduzir movimento" ligado ele
 * continua existindo, parado: é adorno, e sumir mudaria o desenho da tela para
 * quem tem a preferência ativa.
 */
export function IconeComAnel({
  nome,
  accent,
  accentTexto,
  tamanho = 88,
  tamanhoIcone = 36,
}: IconeProps) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const reduzirMovimento = useReduzirMovimento();
  const pulso = useSharedValue(0);

  useEffect(() => {
    if (reduzirMovimento) return;
    pulso.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [pulso, reduzirMovimento]);

  const pulsar = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulso.value),
    transform: [{ scale: 1 + pulso.value * 0.25 }],
  }));

  const disco = {
    backgroundColor: withAlpha(accent, 0.14),
    borderRadius: tamanho / 2,
    height: tamanho,
    width: tamanho,
  };
  const anel = { borderRadius: tamanho / 2 + 2, borderColor: accent };

  return (
    <View style={[styles.disco, disco]}>
      {reduzirMovimento ? (
        <View style={[styles.anel, anel, { opacity: 0.35 }]} />
      ) : (
        <Animated.View style={[styles.anel, anel, pulsar]} />
      )}
      <Icon name={nome} size={tamanhoIcone} color={accentTexto} strokeWidth={1.6} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cartao: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderSoft,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      // O `.empty-hero` do mockup: 56 em cima, 32 nos lados, 72 embaixo — a
      // sobra de baixo é o espaço da onda.
      overflow: "hidden",
      paddingBottom: 72,
      paddingHorizontal: t.spacing.xl,
      paddingTop: 56,
      position: "relative",
      ...shadows.card,
    },
    onda: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
    },
    conteudo: {
      alignItems: "center",
      gap: t.spacing.sm,
      // Acima da onda — sem isto o cartão fica com a decoração por cima do
      // texto na ordem de pintura da web.
      zIndex: 1,
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: "center",
    },
    texto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 460,
      textAlign: "center",
    },
    // Lado, raio e cor vêm da prop; aqui fica só o que não muda de tamanho.
    disco: {
      alignItems: "center",
      justifyContent: "center",
    },
    anel: {
      borderWidth: 2,
      bottom: -2,
      left: -2,
      position: "absolute",
      right: -2,
      top: -2,
    },
    acao: {
      marginTop: t.spacing.md,
    },
    acaoCentrada: {
      alignItems: "center",
    },
    /**
     * No celular o `Button` conta com o pai em coluna para esticar — ele
     * simplesmente **não declara** `alignSelf`. Um `alignItems: "center"` aqui
     * anularia isso e o botão ficaria com a largura do rótulo, contra o
     * `.btn{width:100%}` que três dos cinco mockups aplicam em 767px.
     */
    acaoMovel: {
      alignSelf: "stretch",
    },
    nota: {
      alignItems: "center",
      marginTop: t.spacing.sm,
      maxWidth: 460,
    },
    // O `.t-small` do mockup: 13px sobre a tinta mais discreta.
    notaTexto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 13,
      textAlign: "center",
    },
  });
