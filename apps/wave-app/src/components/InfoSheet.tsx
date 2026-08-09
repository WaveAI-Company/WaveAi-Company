import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { GlossaryEntry } from "../didactic/glossary";
import { Icon } from "./Icon";
import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useTheme,
  type Theme,
} from "../theme";

type Props = {
  entry: GlossaryEntry;
  visivel: boolean;
  onFechar: () => void;
};

const RELIABILITY_ROTULO: Record<string, string> = {
  "defensável": "Confiabilidade: defensável",
  "cautela": "Confiabilidade: cautela",
  "proprietária/não-validada": "Proprietária / não validada",
};

/**
 * Folha de explicação de um termo (camada didática, P1).
 *
 * Modal por toque (não hover): funciona igual no web e no mobile. Só **exibe**
 * o verbete do glossário — texto derivado do Catálogo N2, sem claim nova. A
 * confiabilidade aparece com destaque de cautela quando não é "defensável".
 */
export function InfoSheet({ entry, visivel, onFechar }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cautela = entry.reliability !== undefined && entry.reliability !== "defensável";
  const fechar = useInteracao();

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      {/* Backdrop é um View; a camada de toque para fechar é um Pressable
          ABSOLUTO atrás da folha — nunca aninhado no botão de fechar (evita
          <button> dentro de <button> no web). A folha é View, não botão. */}
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar explicação"
        />
        <View style={styles.folha}>
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>{entry.label}</Text>
            <Pressable
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={12}
              {...fechar.handlers}
              // `.iconbtn:hover` — o ✕ acende e ganha fundo.
              style={[
                styles.alvoFechar,
                fechar.estado.hovered && { backgroundColor: t.colors.surfaceAlt },
                fechar.estado.focoVisivel
                  ? { boxShadow: anelFoco(t.colors.text, t.colors.surface) }
                  : null,
              ]}
            >
              <Icon
                name="x"
                size={16}
                color={fechar.estado.hovered ? t.colors.text : t.colors.textMuted}
                strokeWidth={2}
              />
            </Pressable>
          </View>

          <ScrollView>
            <Text style={styles.corpo}>{entry.plain}</Text>

            {entry.reliability ? (
              <View
                style={[styles.chip, cautela ? styles.chipCautela : styles.chipNeutro]}
              >
                <Text
                  style={[
                    styles.chipTexto,
                    { color: cautela ? t.colors.warningText : t.colors.textMuted },
                  ]}
                >
                  {RELIABILITY_ROTULO[entry.reliability]}
                </Text>
              </View>
            ) : null}

            {entry.reliabilityNote ? (
              <Text style={styles.nota}>{entry.reliabilityNote}</Text>
            ) : null}

            {entry.source ? (
              <Text style={styles.fonte}>Fonte: {entry.source}</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: t.spacing.lg,
    },
    folha: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.lg,
      gap: t.spacing.sm,
      maxHeight: "80%",
      // Centraliza e limita a largura no web (tela grande).
      width: "100%",
      maxWidth: 420,
      alignSelf: "center",
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
    alvoFechar: {
      alignItems: "center",
      borderRadius: t.radius.sm,
      height: 32,
      justifyContent: "center",
      width: 32,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },

    corpo: {
      ...t.typography.body,
      color: t.colors.text,
      marginTop: t.spacing.xs,
    },
    chip: {
      alignSelf: "flex-start",
      borderRadius: t.radius.pill,
      borderWidth: 1,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      marginTop: t.spacing.md,
    },
    chipNeutro: {
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceAlt,
    },
    chipCautela: {
      borderColor: t.colors.warningText,
      backgroundColor: t.colors.surfaceAlt,
    },
    chipTexto: {
      ...t.typography.label,
    },
    nota: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      marginTop: t.spacing.sm,
    },
    fonte: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.sm,
    },
  });
