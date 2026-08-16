import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useFaixa, useTheme, type Theme } from "../../theme";
import { Avatar } from "../Avatar";
import { Skeleton } from "../Skeleton";

/**
 * Uma pessoa do outro lado de um vínculo: avatar, nome, contexto e a ação (ou
 * o recibo do que acabou de ser feito).
 *
 * A mesma linha nos dois perfis — no do titular são os profissionais que ele
 * autorizou; no do profissional, quem o autorizou. O que muda é o rótulo da
 * ação, porque o gesto não é o mesmo dos dois lados: o titular **tira o
 * acesso** de alguém, o profissional **sai** de um acompanhamento.
 */
export function PersonRow({
  name,
  fallback,
  note,
  tone,
  ended,
  status,
  action,
}: {
  name: string | null | undefined;
  /** Nome mostrado quando a contraparte não tem um. */
  fallback: string;
  note: string;
  /** Cor das iniciais — o papel da contraparte, não o de quem olha. */
  tone?: string;
  /** Vínculo encerrado nesta visita: atenua a linha e risca o nome. */
  ended?: boolean;
  /** Recibo ou estado, à direita. Tem precedência sobre `action`. */
  status?: string;
  action?: ReactNode;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  // No celular a linha quebra e a ação cai sozinha embaixo — ali ela ocupa a
  // largura e se centra, em vez de ficar encostada à esquerda sob o avatar.
  const movel = useFaixa() === "movel";

  return (
    <View style={[styles.pessoa, ended && styles.atenuada]}>
      <Avatar name={name} size={46} tone={tone} />
      <View style={styles.textos}>
        <Text style={[styles.nome, ended && styles.riscado]}>{name ?? fallback}</Text>
        <Text style={styles.nota}>{note}</Text>
      </View>
      {status ? (
        <Text style={styles.recibo}>{status}</Text>
      ) : action ? (
        <View style={[styles.acao, movel && styles.acaoCentrada]}>{action}</View>
      ) : null}
    </View>
  );
}

/** A mesma linha em carregamento, para a lista não pular quando os dados chegam. */
export function PersonRowSkeleton() {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={styles.pessoa}>
      <Skeleton width={46} height={46} radius={23} />
      <View style={styles.textos}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    pessoa: {
      alignItems: "center",
      borderTopColor: t.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
    },
    atenuada: {
      opacity: 0.65,
    },
    textos: {
      flex: 1,
      gap: 2,
      minWidth: 140,
    },
    nome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    riscado: {
      textDecorationLine: "line-through",
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    acao: {
      minWidth: 160,
    },
    acaoCentrada: {
      alignItems: "center",
      flexBasis: "100%",
      // Sem encolher, o `flexBasis:100%` viraria piso e a célula cresceria até
      // o conteúdo — o estouro que já apareceu na faixa de bandas.
      flexShrink: 1,
      minWidth: 0,
    },
    recibo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontWeight: "700",
    },
  });
