import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme, type Theme } from "../theme";
import { Icon } from "./Icon";

/**
 * Requisitos de senha: o medidor e a lista do design (`.pw-meter` e `.reqs`),
 * mais a dica de coincidência (`.match-hint`).
 *
 * **Por que virou componente (P11-d):** nasceu no cadastro e a recuperação de
 * senha pede exatamente a mesma coisa — `login.html`, `#view-newpass`, tem o
 * medidor, os três requisitos e a dica, idênticos. Duas cópias divergiriam na
 * primeira correção, e esta é a regra que a API valida: divergir aqui é a tela
 * prometer uma senha que o servidor recusa.
 */

/** Alinhado aos limites validados pela API (`schemas.py`). */
export const SENHA_MIN = 8;
export const SENHA_MAX = 128;

export type ForcaSenha = { min: boolean; letra: boolean; numero: boolean };

export function avaliarSenha(senha: string): ForcaSenha {
  return {
    min: senha.length >= SENHA_MIN,
    letra: /[a-zA-Z]/.test(senha),
    numero: /[0-9]/.test(senha),
  };
}

export function senhaValida(f: ForcaSenha): boolean {
  return f.min && f.letra && f.numero;
}

export function PasswordStrength({
  senha,
  accent,
  onAccent,
}: {
  senha: string;
  /** Destaque do papel em foco — o cadastro troca conforme o papel escolhido. */
  accent: string;
  onAccent: string;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const forca = avaliarSenha(senha);
  const itens = [
    { ok: forca.min, texto: "ao menos 8 caracteres" },
    { ok: forca.letra, texto: "uma letra" },
    { ok: forca.numero, texto: "um número" },
  ];
  const atendidos = itens.filter((i) => i.ok).length;

  return (
    <View>
      {/* Medidor: resumo VISUAL dos mesmos requisitos da lista abaixo, que é
          quem carrega a informação para o leitor de tela. Fala em requisitos
          atendidos, não em "força" — "senha1234" cumpre os três e nem por isso
          é uma senha forte; prometer isso seria um medidor mentiroso. */}
      <View style={styles.medidor} aria-hidden>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.segmento,
              { backgroundColor: i < atendidos ? accent : t.colors.surfaceStrong },
            ]}
          />
        ))}
        <Text style={styles.medidorTexto}>{atendidos} de 3</Text>
      </View>

      <View style={styles.requisitos} accessibilityRole="list">
        {itens.map((item) => (
          <View
            key={item.texto}
            style={styles.requisito}
            accessibilityLabel={`${item.texto}: ${item.ok ? "atendido" : "pendente"}`}
          >
            <View
              style={[
                styles.requisitoSelo,
                item.ok
                  ? { backgroundColor: accent, borderColor: accent }
                  : { borderColor: t.colors.borderStrong },
              ]}
            >
              {item.ok ? (
                <Icon name="check" size={10} color={onAccent} strokeWidth={3.4} />
              ) : null}
            </View>
            <Text style={[styles.requisitoTexto, item.ok && { color: t.colors.text }]}>
              {item.texto}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * "As senhas coincidem." / "As senhas ainda não coincidem."
 *
 * Coincidir tem valência legítima: é sobre acertar o que se digitou, não sobre
 * o estado de ninguém (ADR-0027).
 */
export function PasswordMatch({
  senha,
  confirmacao,
  erro,
  accentText,
}: {
  senha: string;
  confirmacao: string;
  /** Havendo erro do campo, ele fala primeiro — as duas linhas não competem. */
  erro?: string | null;
  accentText: string;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  if (confirmacao.length === 0 || erro) return null;
  const coincide = confirmacao === senha;

  return (
    <Text
      accessibilityRole="alert"
      style={[styles.dica, { color: coincide ? accentText : t.colors.warningText }]}
    >
      {coincide ? "As senhas coincidem." : "As senhas ainda não coincidem."}
    </Text>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    medidor: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      marginTop: t.spacing.sm,
    },
    segmento: {
      borderRadius: 2,
      flex: 1,
      height: 4,
    },
    medidorTexto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      minWidth: 48,
      textAlign: "right",
    },
    requisitos: {
      gap: 5,
      marginTop: t.spacing.sm,
    },
    requisito: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    requisitoSelo: {
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      height: 16,
      justifyContent: "center",
      width: 16,
    },
    requisitoTexto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    dica: {
      ...t.typography.caption,
      marginTop: 6,
    },
  });
