import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { BAND_COLORS, useFaixa, useTheme, type Theme } from "../../theme";

type Props = {
  /** Potências **relativas** por banda (frações que somam ~1). */
  relative: Partial<Record<BandKey, number>>;
  /** Ignorado desde o porte "Maré": cada banda tem sua cor categórica. */
  accent?: string;
};

/**
 * Composição de bandas da sessão, em barras horizontais.
 *
 * Feito com `View`s e não SVG de propósito: barras proporcionais são um
 * problema de layout, não de geometria — assim acompanham a largura da tela
 * sozinhas, sem medir nada.
 *
 * Cada banda tem **cor própria e categórica** (`BAND_COLORS`), o que permite
 * segui-la de um gráfico a outro. Categórica, e não uma escala: nenhum tom é
 * mais quente ou mais alarmante que os outros, porque banda não tem valência
 * (ADR-0027). Antes todas dividiam o tom do papel — mais seguro contra sugerir
 * uma banda "certa", mas ilegível quando várias aparecem juntas.
 */
export function BandBars({ relative }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  // `@media (max-width:767px){.band{grid-template-columns:96px 1fr 46px}}` — a
  // barra é o que precisa de espaço; os rótulos cedem.
  const estreito = useFaixa() === "movel";

  // A maior banda define a escala — com frações pequenas, normalizar pelo topo
  // torna a comparação legível sem distorcer a proporção entre elas.
  const valores = BANDS.map(({ key }) => relative[key] ?? 0);
  const maior = Math.max(...valores, 0);

  return (
    <View style={styles.wrapper}>
      {BANDS.map(({ key, label, range }) => {
        const valor = relative[key];
        const fracao = valor ?? 0;
        const largura = maior > 0 ? `${(fracao / maior) * 100}%` : "0%";
        const texto = valor === undefined ? "—" : formatPercent(fracao);
        return (
          <View
            key={key}
            style={styles.linha}
            accessible
            accessibilityLabel={`${label}, ${range}: ${texto}`}
          >
            <View style={[styles.rotulo, estreito && styles.rotuloEstreito]}>
              <Text style={styles.nome}>{label}</Text>
              <Text style={styles.faixa}>{range}</Text>
            </View>
            <View style={styles.trilho}>
              <View
                style={[
                  styles.barra,
                  {
                    width: largura as `${number}%`,
                    backgroundColor: t.colors[BAND_COLORS[key]],
                  },
                ]}
              />
            </View>
            <Text style={[styles.valor, estreito && styles.valorEstreito]}>{texto}</Text>
          </View>
        );
      })}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    // `.bands{gap:14px}` — as linhas respiram mais porque cada barra ficou
    // duas vezes mais alta.
    wrapper: {
      gap: 14,
      marginTop: t.spacing.xs,
    },
    // `.band{grid-template-columns:120px 1fr 52px; gap:12px}`.
    linha: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    rotulo: {
      width: 120,
    },
    rotuloEstreito: {
      width: 96,
    },
    nome: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 13.5,
      fontWeight: "600",
    },
    faixa: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11.5,
    },
    /**
     * `.band .track{height:22px; border-radius:4px}`.
     *
     * Eram 10px em pílula — mais da metade mais fino que o design, e foi a
     * queixa literal do pente fino na tela ao vivo ("a grossura das faixas do
     * card de composição por banda está mais fina"). Com 22px o canto volta a
     * ser um raio de 4: em pílula, a barra curta de uma banda pequena viraria
     * um comprimido e mentiria sobre o próprio comprimento.
     */
    trilho: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: 4,
      flex: 1,
      height: 22,
      overflow: "hidden",
    },
    // `.fill{border-radius:0 4px 4px 0}`: só a ponta que cresce é arredondada.
    barra: {
      borderBottomRightRadius: 4,
      borderTopRightRadius: 4,
      height: "100%",
    },
    valor: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 13.5,
      fontVariant: ["tabular-nums"],
      fontWeight: "600",
      textAlign: "right",
      width: 52,
    },
    valorEstreito: {
      width: 46,
    },
  });
