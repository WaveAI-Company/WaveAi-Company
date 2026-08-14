import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { BANDS, formatPercent, type BandKey } from "../../api/results";
import { BAND_COLORS, useTheme, type Theme } from "../../theme";

/**
 * Onde a barra está, que é o que decide a grossura.
 *
 * O mockup tem **dois** tamanhos para a mesma barra: `.stack` de 22px (raio 6)
 * no cartão de destaque da home, e `.mini .stack` de 14px (raio 4) na linha de
 * lista. Nós usávamos 10px arredondado em pílula nos dois — mais fino que o
 * menor dos dois, o que apagava a composição justamente onde ela é o assunto.
 */
type Tamanho = "lista" | "destaque";

const TAMANHOS: Record<Tamanho, { altura: number; raio: number }> = {
  lista: { altura: 14, raio: 4 },
  destaque: { altura: 22, raio: 6 },
};

type Props = {
  /** Potências **relativas** por banda (frações que somam ~1). */
  relative: Partial<Record<BandKey, number>>;
  tamanho?: Tamanho;
};

/**
 * Composição por banda numa **única barra empilhada** (design "Maré").
 *
 * É a versão de relance do `BandBars`: cabe numa linha de lista, onde cinco
 * barras não caberiam, e mostra a proporção entre as bandas de uma vez. Serve
 * para **comparar sessões**, não para ler valor — quem quer o número abre a
 * sessão.
 *
 * As cores são as mesmas do `BandBars` (`BAND_COLORS`), o que permite seguir
 * uma banda da lista para o detalhe. Categóricas, sem valência (ADR-0027).
 */
export function BandStack({ relative, tamanho = "lista" }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { altura, raio } = TAMANHOS[tamanho];

  const partes = BANDS.map(({ key, label }) => ({
    key,
    label,
    fracao: relative[key] ?? 0,
  }));
  const total = partes.reduce((soma, p) => soma + p.fracao, 0);

  if (total <= 0) return <View style={[styles.trilho, { borderRadius: raio, height: altura }]} />;

  return (
    <View
      // Raio fixo, não `altura / 2`: o mockup arredonda o canto (6 e 4), não
      // transforma a barra em pílula — com 22px de altura a pílula comeria a
      // primeira e a última banda.
      style={[styles.trilho, { borderRadius: raio, height: altura }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Composição por banda: ${partes
        .map((p) => `${p.label} ${formatPercent(p.fracao / total)}`)
        .join(", ")}`}
    >
      {partes.map((p) => (
        <View
          key={p.key}
          style={{
            backgroundColor: t.colors[BAND_COLORS[p.key]],
            width: `${(p.fracao / total) * 100}%`,
          }}
        />
      ))}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    trilho: {
      backgroundColor: t.colors.surfaceAlt,
      flexDirection: "row",
      overflow: "hidden",
      width: "100%",
    },
  });
