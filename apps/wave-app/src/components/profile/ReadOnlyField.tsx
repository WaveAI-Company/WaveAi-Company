import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../../theme";

/**
 * Par rótulo/valor com a forma de um campo, mas **sem a promessa de editar**.
 *
 * O mockup desenha um `<input>` e um botão "Salvar"; a API só expõe
 * `GET /auth/me`. Manter a forma do campo mantém o ritmo da tela; o botão que
 * não faria nada é que fica de fora.
 */
export function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{label}</Text>
      <View style={styles.caixa}>
        <Text style={styles.valor}>{value}</Text>
      </View>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    campo: {
      gap: 6,
    },
    rotulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    caixa: {
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderRadius: t.radius.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    valor: {
      ...t.typography.body,
      color: t.colors.text,
    },
  });
