import { useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import {
  formatDuration,
  formatPercent,
  sessionDurationSeconds,
  type SessionResult,
} from "../../api/results";
import { mesCurto } from "../../format/date";
import { useTheme, type Theme } from "../../theme";
import { BandStack } from "../charts/BandStack";

/**
 * Uma sessão na linha do tempo (design "Maré").
 *
 * **Não é clicável de propósito.** O mockup traz uma seta sugerindo uma tela de
 * detalhe da sessão, que ainda não existe; desenhar a afordância sem o destino
 * é prometer o que não se entrega. Quando a tela de detalhe existir, a linha
 * vira `Pressable` e a seta volta.
 *
 * O que o mockup mostrava e **não** foi portado: o rótulo "Sessão guiada" e o
 * resumo das fases, porque o protocolo guiado é client-only e não persiste
 * fase nenhuma (decisão da P4-c); e o selo de autorrelato, que exigiria uma
 * consulta de anotação por sessão.
 */

type Props = {
  result: SessionResult;
};

export function SessionRow({ result }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const estreito = useWindowDimensions().width < 700;

  const data = new Date(result.created_at);
  const duracao = formatDuration(sessionDurationSeconds(result.metrics));
  const relativas = result.metrics?.relative_band_powers;
  const alfa = result.metrics?.rel_alpha;
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.linha, estreito && styles.linhaEmpilhada]}>
      <View style={styles.selo}>
        <Text style={styles.seloDia}>{data.getDate()}</Text>
        <Text style={styles.seloMes}>{mesCurto(result.created_at)}</Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaTitulo}>Sessão · {hora}</Text>
        <Text style={styles.metaNota}>{duracao ?? "duração não registrada"}</Text>
      </View>

      <View style={[styles.composicao, estreito && styles.composicaoLarga]}>
        {relativas ? (
          <>
            <BandStack relative={relativas} />
            <Text style={styles.composicaoNota}>composição por banda · % do espectro</Text>
          </>
        ) : (
          <Text style={styles.composicaoNota}>sem composição registrada</Text>
        )}
      </View>

      <View style={styles.alfa}>
        <Text style={styles.alfaValor}>
          {typeof alfa === "number" ? formatPercent(alfa, 0) : "—"}
        </Text>
        <Text style={styles.alfaRotulo}>alfa</Text>
      </View>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    linha: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderSoft,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.spacing.md,
    },
    linhaEmpilhada: {
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    selo: {
      alignItems: "center",
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      justifyContent: "center",
      minWidth: 52,
      paddingVertical: t.spacing.sm,
    },
    seloDia: {
      ...t.typography.heading,
      color: t.colors.text,
      fontSize: 20,
      fontVariant: ["tabular-nums"],
    },
    seloMes: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      textTransform: "uppercase",
    },
    meta: {
      flexShrink: 1,
      gap: 2,
      minWidth: 140,
    },
    metaTitulo: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    metaNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    composicao: {
      flex: 1,
      gap: t.spacing.xs,
      minWidth: 160,
    },
    composicaoLarga: {
      flexBasis: "100%",
    },
    composicaoNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
    alfa: {
      alignItems: "flex-end",
      minWidth: 56,
    },
    alfaValor: {
      ...t.typography.heading,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    alfaRotulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
  });
