import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../../theme";
import { Avatar } from "../Avatar";
import { Chip } from "../Chip";

/**
 * Cabeçalho do perfil: avatar, nome, e-mail e o selo do papel.
 *
 * O `.prof-head` de `Design/round1/perfil.html`. Componente porque os dois
 * perfis (titular e profissional) mostram exatamente isto, trocando só o texto
 * e a cor do selo — e é a primeira coisa que divergiria em duas cópias.
 */
export function ProfileHeader({
  name,
  email,
  fallback,
  role,
  accent,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  /** Nome mostrado quando o perfil ainda não tem um. */
  fallback: string;
  /** Texto do selo — "Paciente", "Profissional de bem-estar". */
  role: string;
  accent: string;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.cabecalho}>
      <Avatar name={name} size={64} />
      <View style={styles.textos}>
        <Text style={styles.nome}>{name ?? fallback}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      <Chip label={role} dot accent={accent} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cabecalho: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
      marginBottom: t.spacing.sm,
    },
    textos: {
      flex: 1,
      gap: 2,
      minWidth: 180,
    },
    nome: {
      ...t.typography.title,
      color: t.colors.text,
    },
    email: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 13,
    },
  });
