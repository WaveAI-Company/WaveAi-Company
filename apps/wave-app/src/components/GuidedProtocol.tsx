import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { protocolCues } from "../audio/protocolCues";
import { falaDoVeredito, type VeredictoProtocolo } from "../capture/veredito";
import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useFaixa,
  useInteracao,
  useTheme,
  type Theme,
} from "../theme";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { InfoButton } from "./InfoButton";

/**
 * Protocolo guiado de contraste olhos abertos/fechados (P4-c).
 *
 * Roteiro curto em duas fases cronometradas para dar um contraste de estado
 * interpretável na mesma sessão (estilo Exp. B). **Client-only:** guia o
 * comportamento do titular e NÃO persiste marcação de fase — o contexto vai na
 * anotação livre da sessão (P2). Marcar segmentos no banco seria v2 (exige ADR).
 *
 * `onPhaseChange` deixa o pai reagir à fase (ex.: no web, elevar o alfa
 * simulado de "olhos fechados" para o contraste ficar visível). Em aparelho
 * real, é só a guia — o callback não muda o sinal.
 */

export type ProtocolPhase = "aberto" | "fechado";

type Fase = {
  key: ProtocolPhase;
  titulo: string;
  instrucao: string;
  segundos: number;
};

const FASES: readonly Fase[] = [
  {
    key: "aberto",
    titulo: "Olhos abertos",
    instrucao:
      "Fique relaxado, olhos abertos, olhando para um ponto fixo à sua frente. " +
      "Evite se mexer e apertar a mandíbula.",
    segundos: 60,
  },
  {
    key: "fechado",
    titulo: "Olhos fechados",
    instrucao:
      "Feche os olhos e relaxe, respirando com calma. Continue parado até a fase " +
      "terminar.",
    segundos: 60,
  },
];

/** Índices fora de [0, FASES.length) são estados especiais. */
const OCIOSO = -1;

/**
 * Etiqueta própria da trava de tela (ADR-0054).
 *
 * O `expo-keep-awake` conta travas **por etiqueta**: com uma nossa, ninguém mais
 * no app desliga a do roteiro por engano, nem nós desligamos a de outro.
 */
const TRAVA_DE_TELA = "waveai.protocolo-guiado";

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Folga para não rotular de "incompleta" uma fase praticamente inteira.
 *
 * Quem toca "Próxima fase" faltando um segundo cumpriu o roteiro; quem pula aos
 * 10 s de 60, não. Sem esta folga, um toque no último instante invalidaria uma
 * verificação boa — e o preço de errar para esse lado é dizer "não dá para
 * verificar" a quem fez tudo certo.
 */
const FOLGA_DE_ANTECIPACAO_MS = 3000;

type Props = {
  accent: string;
  onPhaseChange?: (fase: ProtocolPhase | null) => void;
  /**
   * O roteiro terminou. `incompleto` é `true` quando ele foi **pulado** (avanço
   * manual com tempo sobrando) ou **interrompido** — e aí o resultado não vale
   * como verificação, por mais que o número diga o contrário (emenda à ADR-0053).
   */
  onFinish?: (incompleto: boolean) => void;
  /** Veredito já resolvido, para a voz anunciar. `null` enquanto não chega. */
  veredito?: VeredictoProtocolo | null;
  /**
   * Já está dentro de um `Panel` — sem cartão próprio e sem repetir o título.
   *
   * A linha de ações (silenciar, ⓘ) continua, porque ela pertence ao protocolo
   * e não ao painel que o embrulha.
   */
  embedded?: boolean;
};

export function GuidedProtocol({
  accent,
  onPhaseChange,
  onFinish,
  veredito,
  embedded,
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  // Fora do celular a dupla de ações cabe em uma linha só.
  const emLinha = useFaixa() !== "movel";
  // Estado do botão de silenciar a guia por voz.
  const som = useInteracao();
  const [indice, setIndice] = useState(OCIOSO);
  const [restante, setRestante] = useState(0);
  /** Instante em que a fase corrente termina, em ms. A contagem sai daqui. */
  const fimDaFaseMs = useRef(0);
  /** Último segundo em que a batida final tocou — o intervalo é sub-segundo. */
  const ultimoTick = useRef(0);
  /** Alguma fase foi cortada antes da hora nesta passagem pelo roteiro? */
  const abreviado = useRef(false);
  /** Veredito já falado, para não repetir a cada renderização. */
  const jaAnunciado = useRef<VeredictoProtocolo | null>(null);
  /** Guia por voz/vibração ligada (P4-d). É o ponto do protocolo, mas dá p/ calar. */
  const [somLigado, setSomLigado] = useState(true);

  const rodando = indice >= 0 && indice < FASES.length;
  const concluido = indice === FASES.length;
  const fase = rodando ? FASES[indice] : null;

  function alternarSom() {
    setSomLigado((s) => {
      if (s) protocolCues.stop();
      return !s;
    });
  }

  function iniciar() {
    fimDaFaseMs.current = Date.now() + FASES[0].segundos * 1000;
    abreviado.current = false;
    setIndice(0);
    setRestante(FASES[0].segundos);
  }

  /**
   * Avanço **pelo botão**, que é o que distingue pular de cumprir.
   *
   * O `proxima()` cru também é chamado pelo relógio quando a fase termina
   * sozinha; só o toque com tempo sobrando marca o roteiro como abreviado.
   */
  function proximaManual() {
    if (fimDaFaseMs.current - Date.now() > FOLGA_DE_ANTECIPACAO_MS) {
      abreviado.current = true;
    }
    proxima();
  }
  function proxima() {
    const prox = indice + 1;
    const segundos = prox < FASES.length ? FASES[prox].segundos : 0;
    fimDaFaseMs.current = Date.now() + segundos * 1000;
    setIndice(prox);
    setRestante(segundos);
    // Acabou o roteiro: é aqui que o veredito é pedido ao servidor.
    if (prox >= FASES.length) onFinish?.(abreviado.current);
  }

  /**
   * Encerrar no meio é sempre roteiro incompleto — não há discussão de folga:
   * uma das fases não aconteceu.
   */
  function encerrar() {
    const estavaRodando = rodando;
    fimDaFaseMs.current = 0;
    setIndice(OCIOSO);
    setRestante(0);
    if (estavaRodando) onFinish?.(true);
  }

  // Avisa o pai da fase atual (null quando ocioso/concluído) e dá a pista de
  // áudio na entrada de cada fase / na conclusão (P4-d) — essencial de olhos
  // fechados, quando não há pista visual.
  useEffect(() => {
    onPhaseChange?.(fase ? fase.key : null);
    if (somLigado) {
      if (fase) {
        protocolCues.transition();
        protocolCues.announce(
          fase.key === "aberto"
            ? "Olhos abertos. Olhe para um ponto fixo à frente."
            : "Feche os olhos agora.",
        );
      } else if (concluido) {
        protocolCues.transition();
        protocolCues.announce("Pode abrir os olhos. Protocolo concluído.");
      }
    }
    // Ao desmontar (fim da captação), volta o sinal ao normal e cala a voz.
    return () => onPhaseChange?.(null);
  }, [indice]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Anuncia o veredito **quando ele chega** (emenda à ADR-0053).
   *
   * É um segundo anúncio, depois de "pode abrir os olhos": o resultado vem do
   * servidor e leva um instante, então não dá para dizê-lo junto do fim da fase.
   * O `jaAnunciado` impede repetir se o componente renderizar de novo com o
   * mesmo veredito.
   *
   * A frase vem de `falaDoVeredito`, a mesma fonte que decide o texto do cartão
   * — voz e tela não podem divergir sobre a mesma captação.
   */
  useEffect(() => {
    if (!veredito || !somLigado || jaAnunciado.current === veredito) return;
    jaAnunciado.current = veredito;
    protocolCues.announce(falaDoVeredito(veredito));
  }, [veredito, somLigado]);

  // Contagem regressiva **pelo relógio**, não por contagem de tiques. Um
  // `setRestante(r => r - 1)` só anda quando o timer dispara, e timer de RN no
  // Android não dispara com a activity pausada — o mesmo defeito que a emenda à
  // ADR-0052 corrigiu no envio do sinal. Aqui ele era pior: se a tela apagasse
  // durante o "olhos fechados", a contagem parava e a pessoa ficava de olhos
  // fechados esperando uma voz que nunca vinha. Derivando de uma subtração de
  // datas, ao voltar o número se corrige e a fase avança para onde deveria estar.
  //
  // Isto sozinho **não** faria a voz tocar com a tela apagada — nada roda para
  // tocá-la. Quem cuida disso é a trava de tela mais abaixo (ADR-0054); as duas
  // se complementam e nenhuma substitui a outra: a trava evita a tela apagar
  // durante o roteiro, e o relógio conserta a contagem se ela apagar assim mesmo
  // (a pessoa pode apagá-la no botão, e o roteiro não pode travar por isso).
  //
  // Nos 3 s finais, uma batida por segundo marca o fim da fase; `ultimoTick`
  // evita repetir a batida do mesmo segundo agora que o intervalo é mais fino.
  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => {
      const faltam = Math.max(
        0,
        Math.ceil((fimDaFaseMs.current - Date.now()) / 1000),
      );
      setRestante(faltam);
      if (somLigado && faltam > 0 && faltam <= 3 && ultimoTick.current !== faltam) {
        ultimoTick.current = faltam;
        protocolCues.tick();
      }
      if (faltam <= 0) proxima();
    }, 250);
    return () => clearInterval(id);
  }, [indice, somLigado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cala qualquer fala pendente ao desmontar.
  useEffect(() => () => protocolCues.stop(), []);

  /**
   * Tela acesa **enquanto o roteiro roda** (ADR-0054).
   *
   * Sem isto, o sistema apaga a tela por inatividade justamente na fase de olhos
   * fechados — e aí nada roda para tocar a voz que anuncia a troca. A contagem
   * já vem do relógio e não trava, mas o aviso não sairia, e a pessoa ficaria de
   * olhos fechados esperando.
   *
   * **A liberação é o ponto delicado**, e por isso mora na limpeza do efeito:
   * ela roda ao encerrar no meio, ao concluir e ao desmontar a tela. Trava de
   * tela esquecida é o modo de falha clássico deste recurso — seria pior que o
   * problema que veio resolver.
   *
   * `catch` silencioso dos dois lados: falhar em segurar a tela **não pode**
   * derrubar o roteiro. Sem a trava o protocolo ainda funciona, só volta a
   * depender de a pessoa manter a tela ligada.
   */
  useEffect(() => {
    if (!rodando) return;
    activateKeepAwakeAsync(TRAVA_DE_TELA).catch(() => {});
    return () => {
      deactivateKeepAwake(TRAVA_DE_TELA).catch(() => {});
    };
  }, [rodando]);

  return (
    <View style={embedded ? styles.solto : [styles.card, { borderLeftColor: accent }]}>
      <View style={[styles.cabecalho, embedded && styles.cabecalhoSolto]}>
        {embedded ? null : <Text style={styles.titulo}>Protocolo guiado</Text>}
        <View style={styles.cabecalhoAcoes}>
          {/* Silenciar a guia por voz/vibração. Irmão do InfoButton (nunca
              button aninhado). */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: somLigado }}
            accessibilityLabel={
              somLigado ? "Silenciar guia por voz" : "Ativar guia por voz"
            }
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={alternarSom}
            {...som.handlers}
            style={[
              styles.somAlvo,
              som.estado.hovered && { backgroundColor: t.colors.surfaceAlt },
              som.estado.focoVisivel
                ? { boxShadow: anelFoco(accent, t.colors.surface) }
                : null,
            ]}
          >
            <Icon name={somLigado ? "volume" : "volumeOff"} size={18} color={accent} />
          </Pressable>
          <InfoButton term="protocolo_contraste" accent={accent} />
        </View>
      </View>

      {!rodando && !concluido ? (
        <>
          <Text style={styles.corpo}>
            Duas fases — olhos abertos e depois fechados — para verificar se o seu
            aparelho está captando bem. Ao encerrar a captação, o WaveAI compara as
            duas e diz se o padrão esperado apareceu.
          </Text>
          {/* O pedido "mantenha a tela ligada" saiu daqui: o app passou a
              segurar a tela sozinho durante o roteiro (ADR-0054), e um aviso
              sobre algo que já está resolvido vira ruído — além de deixar de ser
              verdade (ADR-0027). */}
          <Button label="Iniciar protocolo guiado" onPress={iniciar} accent={accent} />
        </>
      ) : null}

      {rodando && fase ? (
        <>
          <Text style={styles.progresso}>
            Fase {indice + 1} de {FASES.length}
          </Text>
          <View style={styles.faseLinha}>
            <Text style={[styles.faseTitulo, { color: accent }]}>{fase.titulo}</Text>
            <Text style={styles.contagem}>{mmss(restante)}</Text>
          </View>
          <Text style={styles.corpo}>{fase.instrucao}</Text>
          {/* A dupla do mockup fica **lado a lado** (`display:flex; gap:10px`)
              enquanto houver largura: no trilho de 360px são dois botões de
              meia largura. No celular o card ocupa a tela inteira e a mesma
              dupla volta a empilhar, com cada botão em linha cheia — o que já
              estava certo e não muda. */}
          <View style={[styles.acoes, emLinha && styles.acoesLinha]}>
            <View style={emLinha ? styles.acaoMeia : undefined}>
              <Button
                label={indice + 1 < FASES.length ? "Próxima fase" : "Concluir"}
                onPress={proximaManual}
                accent={accent}
                largura={emLinha ? "bloco" : "conteudo"}
                compacto={emLinha}
              />
            </View>
            <View style={emLinha ? styles.acaoMeia : undefined}>
              {/* "Encerrar" e não "Encerrar protocolo": no trilho em linha o
                  botão tem 101px úteis e o rótulo longo pedia 114 (13.5px/600),
                  quebrando em duas linhas. O substantivo era redundante — o
                  botão vive dentro do cartão do protocolo guiado. */}
              <Button
                label="Encerrar"
                onPress={encerrar}
                variant="secondary"
                largura={emLinha ? "bloco" : "conteudo"}
                compacto={emLinha}
              />
            </View>
          </View>
        </>
      ) : null}

      {concluido ? (
        <>
          {/* O veredito também em TEXTO, e não só por voz: quem silenciou a
              guia — ou não pode ouvi-la — ficaria sem resposta nenhuma até
              encerrar a captação. Mesma frase da voz, da mesma fonte
              (`falaDoVeredito`), para as duas não divergirem. */}
          {veredito ? (
            <Text style={[styles.faseTitulo, { color: accent, fontSize: 15 }]}>
              {falaDoVeredito(veredito)}
            </Text>
          ) : null}
          <Text style={styles.corpo}>
            {veredito
              ? "Encerre a captação para ver os detalhes e, se quiser, registrar o contexto na anotação da sessão."
              : "Protocolo concluído. Encerre a captação para ver o resultado e, se quiser, registrar o contexto na anotação da sessão."}
          </Text>
          <Button label="Refazer protocolo" onPress={iniciar} accent={accent} />
        </>
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
    // Sem cartão: quem desenha a moldura e o título é o `Panel` da tela.
    solto: {
      gap: t.spacing.sm,
    },
    acoes: {
      gap: t.spacing.sm,
    },
    // `display:flex; gap:10px` do mockup, com as duas metades iguais.
    acoesLinha: {
      flexDirection: "row",
    },
    acaoMeia: {
      flexBasis: 0,
      flexGrow: 1,
      minWidth: 0,
    },
    cabecalhoSolto: {
      justifyContent: "flex-end",
    },
    cabecalho: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
    },
    cabecalhoAcoes: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
    },
    somAlvo: {
      alignItems: "center",
      borderRadius: t.radius.sm,
      height: 26,
      justifyContent: "center",
      width: 26,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },

    titulo: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
    },
    progresso: {
      ...t.typography.label,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    faseLinha: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
    },
    faseTitulo: {
      ...t.typography.title,
      fontSize: 22,
    },
    contagem: {
      ...t.typography.title,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    corpo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
