import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  anelFoco,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useRoleAccent,
  useTheme,
  withAlpha,
  type Theme,
} from "../theme";

type Props = {
  /** Página atual, começando em 1. */
  pagina: number;
  /** Total de páginas. Com 0 ou 1, o controle não se desenha. */
  totalPaginas: number;
  onChange: (pagina: number) => void;
  /** Descreve o que está sendo paginado, para o leitor de tela. */
  label: string;
  accent?: string;
  /** Trava os controles enquanto a página pedida está chegando. */
  ocupado?: boolean;
};

type Salto = { chave: string; glifo: string; rotulo: string; alvo: (p: number, n: number) => number };

/**
 * Os quatro saltos, na ordem em que aparecem. Glifos são **decorativos**
 * (`aria-hidden`): quem nomeia o botão é o `accessibilityLabel`, senão o leitor
 * de tela anunciaria "menor menor" no lugar de "primeira página".
 */
const SALTOS: Salto[] = [
  { chave: "primeira", glifo: "«", rotulo: "Primeira página", alvo: () => 1 },
  { chave: "anterior", glifo: "‹", rotulo: "Página anterior", alvo: (p) => p - 1 },
  { chave: "proxima", glifo: "›", rotulo: "Próxima página", alvo: (p) => p + 1 },
  { chave: "ultima", glifo: "»", rotulo: "Última página", alvo: (_p, n) => n },
];

/**
 * Paginação de lista, no estilo do design "Maré" — mesmo trilho arredondado do
 * `SegmentedFilter`, para os dois controles da tela conversarem.
 *
 * **Setas e um rótulo textual**, sem fileira de números: o design nunca desenhou
 * essa fileira, e no celular ela não caberia sem reticências e um segundo
 * tratamento. "Página 2 de 3" diz a mesma coisa em qualquer largura.
 *
 * O rótulo é a única fonte da posição — **nunca** derive a página do tamanho da
 * lista carregada: a lista é uma página, e contar o que está na tela para dizer
 * onde se está foi exatamente o erro que a contagem do cabeçalho cometeu.
 */
export function Pagination({
  pagina,
  totalPaginas,
  onChange,
  label,
  accent,
  ocupado,
}: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

  // Uma página só não é paginação: o controle sumiria de qualquer jeito com
  // tudo desabilitado, e um controle inerte na tela é ruído.
  if (totalPaginas <= 1) return null;

  return (
    // `role="navigation"` via prop web: o `accessibilityRole` do RN não tem
    // esse valor no seu enum, e sem o papel o grupo de setas chega ao leitor
    // de tela como três botões soltos, sem dizer do que são a navegação.
    <View style={styles.barra} role="navigation" aria-label={label}>
      {SALTOS.slice(0, 2).map((salto) => (
        <Seta
          key={salto.chave}
          salto={salto}
          pagina={pagina}
          totalPaginas={totalPaginas}
          desabilitado={!!ocupado || pagina <= 1}
          cor={cor}
          styles={styles}
          onChange={onChange}
        />
      ))}

      {/* `aria-live`: quem navega ouvindo precisa saber que a página mudou —
          sem isto, clicar na seta não anuncia nada e a pessoa fica sem
          confirmação de que algo aconteceu. */}
      <Text style={styles.posicao} aria-live="polite">
        {ocupado ? "Carregando…" : `Página ${pagina} de ${totalPaginas}`}
      </Text>

      {SALTOS.slice(2).map((salto) => (
        <Seta
          key={salto.chave}
          salto={salto}
          pagina={pagina}
          totalPaginas={totalPaginas}
          desabilitado={!!ocupado || pagina >= totalPaginas}
          cor={cor}
          styles={styles}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

function Seta({
  salto,
  pagina,
  totalPaginas,
  desabilitado,
  cor,
  styles,
  onChange,
}: {
  salto: Salto;
  pagina: number;
  totalPaginas: number;
  desabilitado: boolean;
  cor: string;
  styles: ReturnType<typeof criarEstilos>;
  onChange: (pagina: number) => void;
}) {
  const t = useTheme();
  const { estado, handlers } = useInteracao();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={salto.rotulo}
      accessibilityState={{ disabled: desabilitado }}
      // Como no `SegmentedFilter`: o `accessibilityState` não vira atributo no
      // RN-web, e sem `aria-disabled` o leitor de tela ofereceria um botão que
      // não faz nada.
      aria-disabled={desabilitado}
      disabled={desabilitado}
      onPress={() => onChange(salto.alvo(pagina, totalPaginas))}
      {...handlers}
      style={[
        styles.seta,
        desabilitado && styles.setaInerte,
        !desabilitado && estado.hovered && { backgroundColor: t.colors.surfaceStrong },
        !desabilitado && estado.pressed && { backgroundColor: withAlpha(cor, 0.14) },
        estado.focoVisivel ? { boxShadow: anelFoco(cor, t.colors.surfaceAlt) } : null,
      ]}
    >
      <Text
        style={[styles.glifo, !desabilitado && estado.hovered && { color: cor }]}
        aria-hidden
      >
        {salto.glifo}
      </Text>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    barra: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 2,
      marginTop: t.spacing.md,
      padding: 3,
    },
    seta: {
      alignItems: "center",
      borderRadius: t.radius.pill,
      justifyContent: "center",
      // Piso de alvo de toque, como no `Button`: seta pequena demais é
      // inclicável no celular mesmo quando fica bonita no desktop.
      minHeight: 38,
      minWidth: 38,
      ...transicao("background-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },
    setaInerte: {
      // Sem `display:none`: a barra não pode mudar de largura ao chegar na
      // primeira ou na última página, senão o controle "pula" sob o cursor.
      opacity: 0.35,
    },
    glifo: {
      ...t.typography.bodyStrong,
      color: t.colors.textMuted,
      fontSize: 18,
      lineHeight: 18,
      ...transicao("color", motion.media),
    },
    posicao: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      minWidth: 108,
      paddingHorizontal: t.spacing.sm,
      textAlign: "center",
    },
  });
