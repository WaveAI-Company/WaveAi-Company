/**
 * Parte visual do editor de foto — igual nos dois modos de escolher a imagem.
 *
 * Mostra o avatar (foto ou iniciais), o botão de enviar/trocar e, quando há
 * foto, o de remover. Enquanto envia, o avatar recebe um véu com indicador —
 * a tela não finge que já mudou (ADR-0027). Erro do servidor aparece em texto.
 */

import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../../theme";
import { Avatar } from "../Avatar";

export function AvatarEditorView({
  name,
  size = 64,
  uri,
  loading,
  busy,
  erro,
  onPick,
  onRemove,
}: {
  name: string | null | undefined;
  size?: number;
  uri: string | null;
  loading: boolean;
  busy: boolean;
  erro: string | null;
  onPick: () => void;
  /** Ausente quando não há foto a remover. */
  onRemove?: () => void;
}) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t, papel.accentText), [t, papel.accentText]);
  const ocupado = busy || loading;

  return (
    <View style={styles.raiz}>
      <View>
        <Avatar name={name} size={size} photoUri={uri} />
        {ocupado ? (
          <View
            style={[styles.veu, { borderRadius: size / 2, height: size, width: size }]}
          >
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View style={styles.acoes}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onPick}
          style={styles.link}
        >
          <Text style={styles.linkTexto}>{uri ? "Trocar foto" : "Enviar foto"}</Text>
        </Pressable>
        {uri && onRemove ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onRemove}
            style={styles.link}
          >
            <Text style={styles.linkRemover}>Remover</Text>
          </Pressable>
        ) : null}
        {erro ? (
          <Text accessibilityLiveRegion="polite" style={styles.erro}>
            {erro}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const criarEstilos = (t: Theme, accentText: string) =>
  StyleSheet.create({
    raiz: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.md,
    },
    veu: {
      alignItems: "center",
      // Fixo e escuro: cobre bem tanto a foto quanto o disco de iniciais, e não
      // depende de um token de tema que possa não existir.
      backgroundColor: "rgba(11, 18, 32, 0.55)",
      justifyContent: "center",
      position: "absolute",
    },
    acoes: {
      gap: 4,
    },
    link: {
      paddingVertical: 2,
    },
    linkTexto: {
      ...t.typography.label,
      color: accentText,
    },
    linkRemover: {
      ...t.typography.label,
      color: t.colors.textMuted,
      fontWeight: "400",
    },
    erro: {
      ...t.typography.caption,
      color: t.colors.danger,
      maxWidth: 220,
    },
  });
