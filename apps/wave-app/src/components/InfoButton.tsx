import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { glossaryEntry } from "../didactic/glossary";
import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";
import { Icon } from "./Icon";
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
  const { estado, handlers } = useInteracao();
  const papel = useRoleAccent();
  const entry = glossaryEntry(term);
  if (!entry) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`O que é: ${entry.label}`}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => setAberto(true)}
        {...handlers}
        // `.iconbtn:hover{color:var(--ink); background:var(--surface-2)}`.
        style={[
          styles.alvo,
          estado.hovered && { backgroundColor: t.colors.surfaceAlt },
          estado.focoVisivel
            ? { boxShadow: anelFoco(accent ?? papel.accent, t.colors.background) }
            : null,
        ]}
      >
        <Icon
          name="info"
          size={17}
          color={accent ?? (estado.hovered ? t.colors.text : t.colors.textMuted)}
          strokeWidth={2}
        />
      </Pressable>
      <InfoSheet entry={entry} visivel={aberto} onFechar={() => setAberto(false)} />
    </>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    // O alvo é só um pouco maior que o glifo; quem garante o toque confortável
    // continua sendo o `hitSlop`, não este quadrado.
    alvo: {
      alignItems: "center",
      borderRadius: t.radius.sm,
      height: 24,
      justifyContent: "center",
      width: 24,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },

  });
