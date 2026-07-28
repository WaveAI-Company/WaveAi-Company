import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";
import { Button } from "./Button";
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

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Props = {
  accent: string;
  onPhaseChange?: (fase: ProtocolPhase | null) => void;
};

export function GuidedProtocol({ accent, onPhaseChange }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [indice, setIndice] = useState(OCIOSO);
  const [restante, setRestante] = useState(0);

  const rodando = indice >= 0 && indice < FASES.length;
  const concluido = indice === FASES.length;
  const fase = rodando ? FASES[indice] : null;

  function iniciar() {
    setIndice(0);
    setRestante(FASES[0].segundos);
  }
  function proxima() {
    const prox = indice + 1;
    setIndice(prox);
    setRestante(prox < FASES.length ? FASES[prox].segundos : 0);
  }
  function encerrar() {
    setIndice(OCIOSO);
    setRestante(0);
  }

  // Avisa o pai da fase atual (null quando ocioso/concluído).
  useEffect(() => {
    onPhaseChange?.(fase ? fase.key : null);
    // Ao desmontar (fim da captação), garante que o sinal volte ao normal.
    return () => onPhaseChange?.(null);
  }, [indice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contagem regressiva: cada segundo agenda o próximo; ao zerar, avança.
  useEffect(() => {
    if (!rodando) return;
    if (restante <= 0) {
      proxima();
      return;
    }
    const id = setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [indice, restante]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Protocolo guiado</Text>
        <InfoButton term="protocolo_contraste" accent={accent} />
      </View>

      {!rodando && !concluido ? (
        <>
          <Text style={styles.corpo}>
            Duas fases — olhos abertos e depois fechados — para dar um contraste de
            estado na mesma captação. Ao final, você pode anotar o contexto.
          </Text>
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
          <Button
            label={indice + 1 < FASES.length ? "Próxima fase" : "Concluir"}
            onPress={proxima}
            accent={accent}
          />
          <Button label="Encerrar protocolo" onPress={encerrar} variant="secondary" />
        </>
      ) : null}

      {concluido ? (
        <>
          <Text style={styles.corpo}>
            Protocolo concluído. Compare as fases no relatório e, se quiser, registre
            o contexto na anotação da sessão.
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
    cabecalho: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
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
