import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useRoleAccent, useTheme, type Theme } from "../theme";

/**
 * Uma pessoa num disco: a **foto** quando há (ADR-0050), as **iniciais** quando
 * não.
 *
 * É **ornamento**: o nome inteiro aparece sempre em texto ao lado, então o
 * disco fica fora do leitor de tela — anunciar "AM" (ou a foto) logo antes de
 * "Ana Martins" só atrapalha quem navega ouvindo. Fica com `aria-hidden`, que é
 * o atributo que vale nas duas pontas sem vazar prop desconhecida para o DOM.
 */

/** "Ana Martins" → "AM"; "Ana" → "A"; sem nome → "·". */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? "")
    .trim()
    .split(/\s+/)
    // Só palavras que começam com letra: parêntese e pontuação não são inicial
    // de ninguém — "Paciente Um (teste)" saía como "P(".
    .filter((parte) => /^\p{L}/u.test(parte));
  if (partes.length === 0) return "·";
  // Primeira + última palavra. Duas letras da primeira ("AN") lê como sigla de
  // uma coisa, não como as iniciais de uma pessoa.
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (partes[0][0] + ultima).toUpperCase();
}

type Props = {
  name: string | null | undefined;
  size?: number;
  /** Cor das iniciais — padrão: o destaque do papel de quem está logado. */
  tone?: string;
  /** Foto (data URI). Quando presente, ocupa o disco no lugar das iniciais. */
  photoUri?: string | null;
};

export function Avatar({ name, size = 44, tone, photoUri }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = tone ?? papel.accentText;

  return (
    <View
      aria-hidden
      style={[
        styles.disco,
        { borderRadius: size / 2, height: size, width: size },
      ]}
    >
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ borderRadius: size / 2, height: size, width: size }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.texto, { color: cor, fontSize: Math.round(size * 0.34) }]}>
          {iniciais(name)}
        </Text>
      )}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    disco: {
      alignItems: "center",
      // `surfaceAlt` e não um véu da cor de destaque: é sobre este fundo que o
      // par de contraste das iniciais está validado no `check:contrast`.
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderWidth: 1,
      flexGrow: 0,
      flexShrink: 0,
      justifyContent: "center",
    },
    texto: {
      fontWeight: "700",
    },
  });
