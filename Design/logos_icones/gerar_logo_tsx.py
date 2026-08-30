"""Escreve o Logo.tsx do app com a geometria de geometria.json.

Uso (da raiz do repo):
    services/api/.venv/Scripts/python.exe Design/logos_icones/gerar_logo_tsx.py

Existe para o path de ~2 KB da onda nao ser copiado a mao — e para que
trocar o desenho seja rodar tres scripts, nao reeditar um componente.
"""
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]

import json

GEO = str(RAIZ / "Design" / "logos_icones" / "geometria.json")
DEST = str(RAIZ / "apps" / "wave-app" / "src" / "components" / "brand" / "Logo.tsx")

G = json.load(open(GEO, encoding="utf8"))
ONDA = G["reduzida"]["onda"]
PT = G["reduzida"]["ponto"]

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

type Props = {{
  /** Lado do símbolo. */
  size?: number;
  /** Cor sólida no lugar do gradiente (a casca usa o tom do papel ativo). */
  tint?: string;
  /** Mostra o wordmark "WaveAI" ao lado do símbolo. */
  withWordmark?: boolean;
  /** Subtítulo sob o wordmark (ex.: "bem-estar exploratório"). */
  tagline?: string;
  /**
   * Põe a tagline **na mesma linha** do wordmark, como o `.wordmark` do
   * mockup: `WaveAI <small>bem-estar exploratório</small>`.
   *
   * É prop e não o padrão porque a sidebar não tem largura para isso — nos
   * 240px da coluna de navegação "WaveAI análise de bem-estar" em linha
   * quebraria feio. Empilhado lá, em linha nas telas de autenticação.
   */
  taglineEmLinha?: boolean;
}};

export function Logo({{
  size = 36,
  tint,
  withWordmark = false,
  tagline,
  taglineEmLinha = false,
}}: Props) {{
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const preenchimento = tint ?? "url(#marcaWave)";

  return (
    <View style={{styles.linha}}>
      <Svg width={{size}} height={{size}} viewBox="0 0 512 512" aria-hidden>
        <Defs>
          <LinearGradient id="marcaWave" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={{t.colors.accentPatient}} />
            <Stop offset="1" stopColor={{t.colors.accentDoctor}} />
          </LinearGradient>
        </Defs>
        <Path d={{ONDA}} fill={{preenchimento}} />
        <Circle cx={{{PT["cx"]}}} cy={{{PT["cy"]}}} r={{{PT["r"]}}} fill={{preenchimento}} />
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
