import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";
import {
  anelFoco,
  motion,
  radius,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

/**
 * Seletor compacto de uma opção — o `<select>` do tile "Período"
 * (`Design/round1/painel-profissional.html:419`).
 *
 * **Fidelidade e limite:** o gatilho copia o mockup (fundo `surface-2`, raio
 * pequeno, 6/10 de padding, 13,5px, peso 600, sem borda). A **lista aberta** é
 * nossa: o RN não tem `<select>` nativo nas duas plataformas, e uma lista
 * absoluta dentro do tile seria recortada pelo cartão. Vai num `Modal`, que é
 * o padrão do sistema em ambas — o mesmo caminho do `InfoSheet`.
 */

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Descreve o controle para o leitor de tela (ex.: "Selecionar período"). */
  label: string;
  accent?: string;
};

export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  accent,
}: Props<T>) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers } = useInteracao();
  const [aberto, setAberto] = useState(false);
  const cor = accent ?? papel.accent;

  const atual = options.find((o) => o.value === value) ?? options[0];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: atual?.label }}
        aria-expanded={aberto}
        onPress={() => setAberto(true)}
        {...handlers}
        style={[
          styles.gatilho,
          estado.hovered && { borderColor: cor },
          estado.focoVisivel && { boxShadow: anelFoco(cor, t.colors.surface) },
        ]}
      >
        <Text style={styles.gatilhoTexto} numberOfLines={1}>
          {atual?.label}
        </Text>
        <Icon name="chevronDown" size={15} color={t.colors.textSubtle} />
      </Pressable>

      <Modal
        visible={aberto}
        transparent
        animationType="fade"
        onRequestClose={() => setAberto(false)}
      >
        {/* Fechar tocando fora é o gesto esperado; o rótulo existe para quem
            navega por leitor de tela não ficar preso na lista. */}
        <Pressable
          style={styles.fundo}
          accessibilityRole="button"
          accessibilityLabel="Fechar a lista"
          onPress={() => setAberto(false)}
        >
          <View style={styles.lista} accessibilityRole="radiogroup" accessibilityLabel={label}>
            {options.map((opcao) => (
              <Opcao
                key={opcao.value}
                opcao={opcao}
                ativo={opcao.value === value}
                cor={cor}
                styles={styles}
                onPress={() => {
                  onChange(opcao.value);
                  setAberto(false);
                }}
              />
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Uma opção da lista. Componente de verdade — e não função que devolve JSX —
 * porque cada item precisa do **próprio** estado de interação, e hook não pode
 * morar dentro de um `map`.
 */
function Opcao<T extends string>({
  opcao,
  ativo,
  cor,
  onPress,
  styles,
}: {
  opcao: SelectOption<T>;
  ativo: boolean;
  cor: string;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const { estado, handlers } = useInteracao();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      aria-checked={ativo}
      onPress={onPress}
      {...handlers}
      style={[styles.opcao, estado.hovered && styles.opcaoAtiva]}
    >
      <Text style={[styles.opcaoTexto, ativo && { color: cor, fontWeight: "600" }]}>
        {opcao.label}
      </Text>
      {ativo ? <Icon name="check" size={14} color={cor} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    gatilho: {
      alignItems: "center",
      alignSelf: "flex-start",
      // `surface-2` do mockup, sem borda: a borda só aparece no hover/foco,
      // como afordância — o repouso é chapado, igual ao `select` do design.
      backgroundColor: t.colors.surfaceAlt,
      borderColor: "transparent",
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: t.spacing.xs,
      marginTop: 2,
      minHeight: t.minTouch,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...semContornoNativo(),
      ...transicao("border-color, box-shadow", motion.rapida),
    },
    gatilhoTexto: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 13.5,
      fontWeight: "600",
    },
    fundo: {
      alignItems: "center",
      // Mesmo véu do `InfoSheet`: o Modal do sistema não escurece sozinho.
      backgroundColor: "rgba(0,0,0,0.5)",
      flex: 1,
      justifyContent: "center",
      padding: t.spacing.lg,
    },
    lista: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      maxWidth: 320,
      paddingVertical: t.spacing.xs,
      width: "100%",
    },
    opcao: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      justifyContent: "space-between",
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      ...semContornoNativo(),
    },
    opcaoAtiva: {
      backgroundColor: t.colors.surfaceAlt,
    },
    opcaoTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
    },
  });
