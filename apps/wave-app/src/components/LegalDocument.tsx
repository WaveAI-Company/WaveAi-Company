import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { DocumentoLegal } from "../legal/documents";
import { useFaixa, useRoleAccent, useTheme, type Theme } from "../theme";
import { Panel } from "./Panel";

/**
 * Renderiza um documento legal a partir da fonte versionada em `src/legal`.
 *
 * **Mesma linguagem visual da tela de consentimento** (`patient/consent.tsx`):
 * cartão com respiro largo no desktop e apertado no celular, sobrancelha em
 * caixa alta, título, e itens com marcador quadrado pequeno. São os três
 * documentos que a pessoa lê antes de decidir algo — parecerem irmãos é o
 * ponto, e não coincidência.
 *
 * Texto puro, sem HTML e sem markdown para interpretar: um documento legal não
 * deve depender de um interpretador para dizer o que diz, e um `[PREENCHER]`
 * esquecido tem de aparecer na tela em vez de sumir numa tag mal fechada.
 */
export function LegalDocument({ documento }: { documento: DocumentoLegal }) {
  const t = useTheme();
  const { accentText } = useRoleAccent();
  const movel = useFaixa() === "movel";
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <Panel style={[styles.documento, movel && styles.documentoMovel]}>
      <Text style={styles.eyebrow}>
        {`${documento.titulo} · versão ${documento.versao}`}
      </Text>
      <Text style={styles.titulo} role="heading" aria-level={1}>
        {documento.titulo}
      </Text>
      <Text style={styles.lead}>{documento.resumo}</Text>
      <Text style={styles.selo}>
        {`Atualizada em ${formatarData(documento.atualizadoEm)}`}
      </Text>

      {documento.secoes.map((secao) => (
        <View key={secao.titulo} style={styles.secao}>
          <Text style={styles.secaoTexto} role="heading" aria-level={2}>
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
                <View key={item.slice(0, 40)} style={styles.item} role="listitem">
                  {/* Marcador quadrado do consentimento, e não um bullet de
                      texto: quem lê ouvindo já recebe a lista pelo `role`, e um
                      "•" lido em voz alta vira ruído. */}
                  <View style={[styles.marcador, { backgroundColor: accentText }]} />
                  <Text style={styles.itemTexto}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </Panel>
  );
}

/** `2026-08-23` -> `23/08/2026`. Sem fuso: a data é do documento, não do leitor. */
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    // Respiro do `.doc` do consentimento — é o mesmo tipo de leitura longa.
    documento: {
      paddingBottom: 36,
      paddingHorizontal: 40,
      paddingTop: 40,
    },
    documentoMovel: {
      paddingBottom: t.spacing.lg,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.lg,
    },
    eyebrow: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.9,
      marginBottom: t.spacing.xs,
      textTransform: "uppercase",
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    lead: {
      ...t.typography.body,
      color: t.colors.textMuted,
      marginTop: t.spacing.xs,
      maxWidth: 560,
    },
    selo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      marginTop: t.spacing.sm,
    },
    secao: {
      gap: t.spacing.sm,
      marginTop: t.spacing.lg,
    },
    secaoTexto: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
      fontSize: 15,
    },
    paragrafo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    lista: {
      gap: t.spacing.sm,
    },
    item: {
      flexDirection: "row",
      gap: t.spacing.sm + 4,
    },
    marcador: {
      borderRadius: 3,
      height: 6,
      marginTop: 8,
      width: 6,
    },
    itemTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 22,
    },
  });
