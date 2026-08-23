import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { DocumentoLegal } from "../legal/documents";
import { useTheme, type Theme } from "../theme";

/**
 * Renderiza um documento legal a partir da fonte versionada em `src/legal`.
 *
 * Texto puro, sem HTML e sem markdown para interpretar: um documento legal não
 * deve depender de um interpretador para dizer o que diz, e um `[PREENCHER]`
 * esquecido tem de aparecer na tela em vez de sumir numa tag mal fechada.
 *
 * Largura de leitura contida de propósito — linha longa demais faz o olho
 * perder a linha seguinte, e este é o texto mais longo do produto.
 */
export function LegalDocument({ documento }: { documento: DocumentoLegal }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.folha}>
      <Text style={styles.titulo} role="heading" aria-level={1}>
        {documento.titulo}
      </Text>
      <Text style={styles.resumo}>{documento.resumo}</Text>
      {/* Versão e data juntas: sem elas, quem lê não sabe se está vendo o texto
          que aceitou ou um posterior. */}
      <Text style={styles.selo}>
        {`Versão ${documento.versao} · atualizada em ${formatarData(documento.atualizadoEm)}`}
      </Text>

      {documento.secoes.map((secao) => (
        <View key={secao.titulo} style={styles.secao}>
          <Text style={styles.secaoTitulo} role="heading" aria-level={2}>
            {secao.titulo}
          </Text>
          {secao.paragrafos?.map((p) => (
            <Text key={p.slice(0, 40)} style={styles.paragrafo}>
              {p}
            </Text>
          ))}
          {secao.itens ? (
            <View style={styles.lista} role="list">
              {secao.itens.map((item) => (
                <View key={item.slice(0, 40)} style={styles.itemLinha} role="listitem">
                  {/* Marcador decorativo: quem lê ouvindo já recebe a lista
                      pelo `role`, e um bullet lido em voz alta vira ruído. */}
                  <Text style={styles.marcador} aria-hidden>
                    •
                  </Text>
                  <Text style={styles.item}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** `2026-08-23` -> `23/08/2026`. Sem fuso: a data é do documento, não do leitor. */
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    folha: {
      gap: t.spacing.sm,
      maxWidth: 720,
      width: "100%",
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    resumo: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
    selo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      marginBottom: t.spacing.md,
    },
    secao: {
      gap: t.spacing.xs,
      marginTop: t.spacing.lg,
    },
    secaoTitulo: {
      ...t.typography.heading,
      color: t.colors.text,
    },
    paragrafo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      lineHeight: 23,
    },
    lista: {
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
    },
    itemLinha: {
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    marcador: {
      ...t.typography.body,
      color: t.colors.textSubtle,
      lineHeight: 23,
    },
    item: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flex: 1,
      lineHeight: 23,
    },
  });
