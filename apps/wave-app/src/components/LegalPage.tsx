import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DOCUMENTOS, type DocumentoLegal } from "../legal/documents";
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

  /**
   * Os **outros** documentos, tirados do registro em vez de escritos aqui.
   *
   * Eram dois, e o rodapé alternava entre um e outro com um ternário. Com o
   * terceiro (a página de exclusão, exigida pela loja) o ternário passaria a
   * mentir por omissão: quem estivesse na exclusão só enxergaria a Política, e
   * ninguém notaria. Derivar do registro faz um documento novo aparecer no
   * rodapé sozinho.
   */
  const outros = Object.values(DOCUMENTOS).filter((d) => d.slug !== documento.slug);

  return (
    <ScreenContainer largura="app">
      <View style={styles.centro}>
        <LegalDocument documento={documento} />


        <View style={styles.rodape}>
          <Text style={styles.rodapeTexto}>Leia também: </Text>
          {outros.map((d, i) => (
            <View key={d.slug} style={styles.rodapeItem}>
              {i > 0 ? <Text style={styles.rodapeTexto}>· </Text> : null}
              <TextLink
                label={d.titulo}
                onPress={() => router.replace(`/legal/${d.slug}`)}
                accent={accentText}
              />
            </View>
          ))}
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
      // Largura de leitura contida: linha longa demais faz o olho perder a
      // linha seguinte, e este é o texto mais longo do produto.
      alignSelf: "center",
      gap: t.spacing.md,
      maxWidth: 760,
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
    // Cada link com o seu separador, para a linha quebrar entre os dois em vez
    // de deixar um "·" órfão no fim da linha de cima.
    rodapeItem: {
      alignItems: "center",
      flexDirection: "row",
    },
    rodapeTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
  });
