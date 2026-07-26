import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { glossaryEntry } from "../didactic/glossary";
import { useTheme, type Theme } from "../theme";
import { InfoSheet } from "./InfoSheet";

type Props = {
  /** Chave do verbete no glossário. Sem verbete, o botão não é renderizado. */
  term: string;
  /** Cor do ícone (padrão: texto suave). Aceita o tom do papel. */
  accent?: string;
};

/**
 * Botão "ⓘ" que abre a explicação de um termo (camada didática, P1).
 *
 * Toque (não hover) para funcionar igual no web e no mobile. Alvo de toque
 * ampliado por `hitSlop` (acessibilidade) mantendo o ícone discreto. Se o termo
 * não tem verbete, não aparece nada — nunca um botão que não explica.
 */
export function InfoButton({ term, accent }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [aberto, setAberto] = useState(false);
  const entry = glossaryEntry(term);
  if (!entry) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`O que é: ${entry.label}`}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => setAberto(true)}
      >
        <Text style={[styles.icone, accent ? { color: accent } : null]}>ⓘ</Text>
      </Pressable>
      <InfoSheet entry={entry} visivel={aberto} onFechar={() => setAberto(false)} />
    </>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    icone: {
      ...t.typography.bodyStrong,
      color: t.colors.textMuted,
    },
  });
