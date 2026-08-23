import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { DocumentoLegal } from "../legal/documents";
import { useRoleAccent, useTheme, type Theme } from "../theme";
import { LegalDocument } from "./LegalDocument";
import { ScreenContainer } from "./ScreenContainer";
import { TextLink } from "./TextLink";

/**
 * Moldura das páginas legais.
 *
 * Traz a navegação que a página precisa **por si só**: ela pode ser aberta
 * direto por URL, vinda da ficha da loja de aplicativos, sem histórico para
 * onde voltar. Um "voltar" que não volta seria pior que nenhum, então o rodapé
 * oferece destinos explícitos.
 */
export function LegalPage({ documento }: { documento: DocumentoLegal }) {
  const t = useTheme();
  const router = useRouter();
  const { accentText } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const outro =
    documento.slug === "privacidade"
      ? { rotulo: "Termos de Uso", destino: "/legal/termos" as const }
      : { rotulo: "Política de Privacidade", destino: "/legal/privacidade" as const };

  return (
    <ScreenContainer largura="app">
      <View style={styles.centro}>
        <LegalDocument documento={documento} />

        <View style={styles.rodape}>
          <Text style={styles.rodapeTexto}>Leia também: </Text>
          <TextLink
            label={outro.rotulo}
            onPress={() => router.replace(outro.destino)}
            accent={accentText}
          />
        </View>
        <View style={styles.rodape}>
          <TextLink
            label="Ir para o WaveAI"
            onPress={() => router.replace("/")}
            accent={accentText}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    centro: {
      alignItems: "center",
      width: "100%",
    },
    rodape: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: t.spacing.lg,
      maxWidth: 720,
      width: "100%",
    },
    rodapeTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
  });
