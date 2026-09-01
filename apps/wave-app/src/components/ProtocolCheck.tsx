import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatPercent, type PhaseComparison } from "../api/results";
import type { VeredictoProtocolo } from "../capture/veredito";
import { useTheme, type Theme } from "../theme";

/**
 * Resultado do protocolo guiado — **verificação do instrumento** (ADR-0053).
 *
 * O que esta faixa responde é uma pergunta sobre o *aparelho*, não sobre quem
 * captou: o padrão canônico de alfa (mais forte de olhos fechados que abertos)
 * apareceu no sinal? Quando aparece, é evidência de que a captação está
 * funcionando. É por isso que o roteiro existe.
 *
 * **Três coisas que este componente não pode fazer**, e que custaram dado
 * medido para aprender:
 *
 * 1. **Não dizer nada sobre a pessoa.** O contraste é do sinal. Nenhuma leitura
 *    de estado, humor ou saúde sai daqui (Medical/71 §6).
 * 2. **Não culpar o sensor quando o padrão falta.** Na sessão `d2` do estudo
 *    (DataScience/33 §4b) o contraste sumiu com o contato ÓTIMO — a causa foi o
 *    estado (riso involuntário injeta EMG facial em FP1 e desincroniza o alfa).
 *    Mandar conferir o eletrodo faria a pessoa caçar um defeito inexistente,
 *    então **estado e movimento vêm primeiro**, contato depois.
 * 3. **Não pintar de bom/ruim.** Usa o destaque do papel e texto neutro: há
 *    valência para o instrumento, não para quem usou (ADR-0027). Vermelho aqui
 *    leria como "algo errado com você".
 *
 * Decide por `passed`, que é estrutural. O `verdict` do `wave_eeg` é texto
 * interno em português e **não** é exibido: redação de biblioteca não é cópia de
 * produto, e mudaria sob os pés da tela.
 */

type Props = {
  comparison: PhaseComparison | null;
  /** Veredito já resolvido — inclui o caso do roteiro pulado ou interrompido. */
  veredito: VeredictoProtocolo;
  /** Cor de destaque do papel (paciente). */
  accent: string;
};

export function ProtocolCheck({ comparison, veredito, accent }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const apareceu = veredito === "apareceu";
  const incompleto = veredito === "incompleto";
  const fechados = comparison?.eyes_closed_rel_alpha;
  const abertos = comparison?.eyes_open_rel_alpha;
  // Roteiro incompleto **não mostra número**: exibir a comparação ao lado de
  // "não dá para verificar" convidaria a lê-la assim mesmo, e ela não vale.
  const temNumeros =
    !incompleto && typeof fechados === "number" && typeof abertos === "number";

  if (incompleto) {
    return (
      <View style={[styles.faixa, { borderLeftColor: accent }]}>
        <Text style={[styles.titulo, { color: accent }]}>
          Não dá para verificar
        </Text>
        <Text style={styles.corpo}>
          O roteiro não foi até o fim — uma fase foi pulada ou a captação parou
          antes. A comparação só vale com os dois trechos inteiros, então esta
          sessão não serve como verificação do aparelho.
        </Text>
        <Text style={styles.corpo}>
          Refaça o roteiro deixando cada fase terminar sozinha.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.faixa, { borderLeftColor: accent }]}>
      <Text style={[styles.titulo, { color: accent }]}>
        {apareceu ? "O padrão esperado apareceu" : "Não deu para constatar"}
      </Text>

      {apareceu ? (
        <Text style={styles.corpo}>
          O alfa ficou mais forte de olhos fechados do que de olhos abertos, como
          se espera. Isso indica que a captação está funcionando neste aparelho.
        </Text>
      ) : (
        <Text style={styles.corpo}>
          O padrão esperado não apareceu nesta captação — o que{" "}
          <Text style={styles.causaForte}>não</Text> significa que haja algo errado
          com você, nem necessariamente com o aparelho.
        </Text>
      )}

      {apareceu ? null : (
        <View style={styles.causas}>
          <Text style={styles.causa}>
            • <Text style={styles.causaForte}>Estado e movimento.</Text> Rir, falar,
            apertar a mandíbula ou não conseguir relaxar durante o roteiro apagam o
            contraste. É a causa mais comum.
          </Text>
          <Text style={styles.causa}>
            • <Text style={styles.causaForte}>Contato do sensor.</Text> O eletrodo
            precisa encostar na pele limpa da testa, firme e sem deslizar.
          </Text>
          <Text style={styles.causa}>
            Refazer o roteiro parado e em silêncio costuma resolver.
          </Text>
        </View>
      )}

      {temNumeros ? (
        <Text style={styles.numeros}>
          Alfa relativa — olhos fechados {formatPercent(fechados)} · olhos abertos{" "}
          {formatPercent(abertos)}
        </Text>
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    faixa: {
      backgroundColor: t.colors.surface,
      borderLeftWidth: 4,
      borderRadius: t.radius.md,
      gap: t.spacing.xs,
      padding: t.spacing.md,
    },
    titulo: {
      ...t.typography.body,
      fontSize: 15,
      fontWeight: "600",
    },
    corpo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    causas: {
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
    },
    causa: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    causaForte: {
      color: t.colors.text,
      fontWeight: "600",
    },
    numeros: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      marginTop: t.spacing.xs,
    },
  });
