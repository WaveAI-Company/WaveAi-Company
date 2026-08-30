"""Escreve o Logo.tsx do app com a geometria de geometria.json.

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe Design/logos_icones/gerar_logo_tsx.py

Existe para o path de ~2 KB da onda nao ser copiado a mao — e para que
trocar o desenho seja rodar tres scripts, nao reeditar um componente.
"""
import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]

GEO = str(RAIZ / "Design" / "logos_icones" / "geometria.json")
DEST = str(RAIZ / "apps" / "wave-app" / "src" / "components" / "brand" / "Logo.tsx")

G = json.load(open(GEO, encoding="utf8"))
ONDA = G["reduzida"]["onda"]
PT = G["reduzida"]["ponto"]
# A forma completa tem enquadramento PROPRIO (a arte inclui o anel), entao ela
# traz a sua onda e o seu ponto — nao da para reusar os da reduzida.
ONDA_CHEIA = G["onda"]
PT_CHEIO = G["ponto"]
ANEL_A, ANEL_B = G["anel"]["paths"]

TSX = f'''import {{ useMemo }} from "react";
import {{ StyleSheet, Text, View }} from "react-native";
import Svg, {{ Circle, Defs, LinearGradient, Path, Stop }} from "react-native-svg";

import {{ useTheme, type Theme }} from "../../theme";

/**
 * Marca do WaveAI — **símbolo reduzido**: a onda com o ponto, sem o anel.
 *
 * O gradiente atravessa os dois tons de destaque (paciente → profissional): a
 * mesma marca cobre os dois papéis do produto, sem escolher um lado. As duas
 * pontas (`accentPatient` e `accentDoctor`) são pares obrigatórios do
 * `scripts/check-contrast.mjs`, então o gradiente inteiro fica coberto pelo
 * verificador — o que um PNG de marca não permitiria.
 *
 * **Por que sem o anel.** A marca tem duas formas. A completa (anel + onda +
 * ponto) vive em `assets/logo.svg` e serve onde há espaço: hero do site, ficha
 * da loja, material. O traço do anel tem 1,7% da largura da arte — a 36px da
 * sidebar isso dá 1,3px e a 16px do favicon dá 0,6px, ou seja, some. Aqui, onde
 * a marca aparece pequena, entra só a onda, que continua inteira.
 *
 * A geometria vem do desenho aprovado (`Design/logos_icones/logo_escura.png`),
 * extraída por traçado de contorno com fidelidade medida (IoU 98,0%); as cores
 * foram trocadas pelos tokens. O `d` abaixo é gerado, não escrito à mão.
 *
 * Antes disto o símbolo era uma onda de traço fino sobre um ladrilho de
 * gradiente, e os PNGs de ícone eram os do template do `create-expo-app`.
 */

/** Contorno da onda, na grade 512 do `viewBox`. */
const ONDA =
  "{ONDA}";

/**
 * A mesma arte com o anel. Enquadramento próprio: como a peça inteira é maior,
 * a onda e o ponto ficam em outra posição e escala — por isso são constantes
 * separadas, e não a forma reduzida com um anel por cima.
 */
const ONDA_CHEIA =
  "{ONDA_CHEIA}";
const ANEL = [
  "{ANEL_A}",
  "{ANEL_B}",
];

type Props = {{
  /** Lado do símbolo. */
  size?: number;
  /** Cor sólida no lugar do gradiente (a casca usa o tom do papel ativo). */
  tint?: string;
  /**
   * Pontas do gradiente, quando o fundo **não** acompanha o tema.
   *
   * O padrão é o par do tema ativo, que é o certo em qualquer superfície que
   * também mude com o tema. O painel de marca da autenticação não muda: ele é
   * escuro sempre (`const P = palettes.dark`). Ali, no tema claro, a marca saía
   * pintada com o par feito para fundo claro **sobre fundo escuro**, e caía de
   * 10,04:1 / 7,43:1 para 3,60:1 / 3,05:1 — o azul raspando o mínimo de 3:1 da
   * WCAG 1.4.11. É o "apagado" que se via na tela.
   *
   * O `check-contrast.mjs` não pega esse caso: ele valida cada tema contra as
   * superfícies **daquele** tema, e "cor do tema claro sobre fundo escuro fixo"
   * só existe onde a superfície é fixa.
   */
  gradiente?: readonly [string, string];
  /**
   * `"reduzida"` (padrão) é a onda com o ponto. `"completa"` acrescenta o anel.
   *
   * O traço do anel tem 3,5% do lado da grade, então ele afina junto com o
   * símbolo: 1,1px a 32px, 1,2px a 34px, 1,3px a 36px, 1,7px a 48px. Abaixo de
   * ~48px ele deixa de ser um traço e vira um fio cinza.
   */
  forma?: "reduzida" | "completa";
  /** Mostra o wordmark "WaveAI" ao lado do símbolo. */
  withWordmark?: boolean;
  /**
   * Subtítulo sob o wordmark — a assinatura ("Sua mente em ondas. Seu
   * bem-estar em movimento.") nas telas de autenticação, ou uma linha curta
   * ("análise de bem-estar") na sidebar, onde só há 240px.
   */
  tagline?: string;
  /**
   * Põe a tagline **na mesma linha** do wordmark, como o `.wordmark` do
   * mockup: `WaveAI <small>sobrancelha curta</small>`.
   *
   * **Hoje nenhuma tela usa.** Servia para a sobrancelha de duas palavras que a
   * assinatura substituiu: uma frase de duas orações em linha quebra em duas
   * linhas já em 375px (medido: 285px de texto num slot de 285px). A prop fica
   * porque continua sendo o tratamento certo para um subtítulo curto — não
   * porque alguém a chame.
   */
  taglineEmLinha?: boolean;
}};

export function Logo({{
  size = 36,
  tint,
  gradiente,
  forma = "reduzida",
  withWordmark = false,
  tagline,
  taglineEmLinha = false,
}}: Props) {{
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [inicio, fim] = gradiente ?? [t.colors.accentPatient, t.colors.accentDoctor];
  const preenchimento = tint ?? "url(#marcaWave)";
  const cheia = forma === "completa";
  const onda = cheia ? ONDA_CHEIA : ONDA;
  const ponto = cheia
    ? {{ cx: {PT_CHEIO["cx"]}, cy: {PT_CHEIO["cy"]}, r: {PT_CHEIO["r"]} }}
    : {{ cx: {PT["cx"]}, cy: {PT["cy"]}, r: {PT["r"]} }};

  return (
    <View style={{styles.linha}}>
      <Svg width={{size}} height={{size}} viewBox="0 0 512 512" aria-hidden>
        <Defs>
          <LinearGradient id="marcaWave" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={{inicio}} />
            <Stop offset="1" stopColor={{fim}} />
          </LinearGradient>
        </Defs>
        {{cheia
          ? ANEL.map((d) => <Path key={{d.length}} d={{d}} fill={{preenchimento}} />)
          : null}}
        <Path d={{onda}} fill={{preenchimento}} />
        <Circle cx={{ponto.cx}} cy={{ponto.cy}} r={{ponto.r}} fill={{preenchimento}} />
      </Svg>

      {{withWordmark ? (
        <View style={{[styles.textos, taglineEmLinha && styles.textosEmLinha]}}>
          <Text style={{styles.nome}}>WaveAI</Text>
          {{tagline ? (
            <Text style={{[styles.tagline, taglineEmLinha && styles.taglineEmLinha]}}>
              {{tagline}}
            </Text>
          ) : null}}
        </View>
      ) : null}}
    </View>
  );
}}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({{
    linha: {{
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    }},
    textos: {{
      flexShrink: 1,
    }},
    textosEmLinha: {{
      alignItems: "baseline",
      flexDirection: "row",
      // Sem quebra a frase transborda: `flexShrink` é 0 por padrão no RN.
      flexWrap: "wrap",
      // O `margin-left:6px` do `small` do mockup.
      gap: 6,
    }},
    nome: {{
      ...t.typography.heading,
      color: t.colors.text,
      fontWeight: "700",
      letterSpacing: 0.2,
    }},
    tagline: {{
      ...t.typography.caption,
      color: t.colors.textSubtle,
    }},
    // `.wordmark small{{font-size:12px; letter-spacing:.08em; text-transform:uppercase}}`.
    taglineEmLinha: {{
      fontSize: 12,
      letterSpacing: 0.96,
      textTransform: "uppercase",
    }},
  }});
'''

open(DEST, "w", encoding="utf8", newline="\n").write(TSX)
print(f"Logo.tsx escrito: {len(TSX)} bytes, path da onda {len(ONDA)} chars")
