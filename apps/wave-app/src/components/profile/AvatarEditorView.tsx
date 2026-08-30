/**
 * Parte visual do editor de foto — igual nos dois modos de escolher a imagem.
 *
 * O **avatar é clicável**, com um selo de câmera no canto (como o WhatsApp): é
 * o alvo de "enviar/trocar". "Remover" fica como link discreto abaixo, só
 * quando há foto. Enquanto envia, o disco recebe um véu com indicador — a tela
 * não finge que já mudou (ADR-0027). Erro do servidor aparece em texto.
 */

import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../../theme";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";

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
  const styles = useMemo(() => criarEstilos(t), [t]);
  const ocupado = busy || loading;
  const selo = Math.round(size * 0.42);

  return (
    <View style={styles.raiz}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? "Trocar foto de perfil" : "Enviar foto de perfil"}
        disabled={busy}
        onPress={onPick}
        style={({ pressed }) => [pressed && !busy ? styles.pressionado : null]}
      >
        <Avatar name={name} size={size} photoUri={uri} />

        {ocupado ? (
          <View
            style={[styles.veu, { borderRadius: size / 2, height: size, width: size }]}
          >
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}

        {/* Selo de câmera — o `.avatar-cam` do padrão: círculo no tom do papel,
            encostado no canto inferior direito, com uma borda da cor do fundo
            para destacar do disco. */}
        <View
          style={[
            styles.selo,
            {
              backgroundColor: papel.accent,
              borderRadius: selo / 2,
              height: selo,
              width: selo,
            },
          ]}
        >
          <Icon name="camera" size={Math.round(selo * 0.62)} color={papel.onAccent} strokeWidth={1.9} />
        </View>
      </Pressable>

      {uri && onRemove ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onRemove}
          style={styles.removerAlvo}
        >
          <Text style={styles.remover}>Remover</Text>
        </Pressable>
      ) : null}

      {erro ? (
        <Text accessibilityLiveRegion="polite" style={styles.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    raiz: {
      alignItems: "center",
      gap: 6,
    },
    pressionado: {
      opacity: 0.85,
    },
    veu: {
      alignItems: "center",
      // Fixo e escuro: cobre bem tanto a foto quanto o disco de iniciais, e não
      // depende de um token de tema que possa não existir.
      backgroundColor: "rgba(11, 18, 32, 0.55)",
      justifyContent: "center",
      position: "absolute",
    },
    selo: {
      alignItems: "center",
      borderColor: t.colors.surface,
      borderWidth: 2,
      bottom: -2,
      justifyContent: "center",
      position: "absolute",
      right: -2,
    },
    removerAlvo: {
      paddingVertical: 2,
    },
    remover: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    erro: {
      ...t.typography.caption,
      color: t.colors.danger,
      maxWidth: 200,
      textAlign: "center",
    },
  });
