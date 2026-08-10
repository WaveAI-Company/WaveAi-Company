import { useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";

import {
  anelCampo,
  motion,
  semContornoNativo,
  transicao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../theme";

/**
 * Código de N dígitos em caixas separadas — o `.code-row` do design
 * (`Design/round1/criar-conta.html`, passo 2 de 3).
 *
 * Nasce na verificação de e-mail e é **reusado pela recuperação de senha**,
 * que pede o mesmo código de 6 dígitos (`login.html`, `#view-code`). Por isso o
 * componente não sabe nada sobre e-mail, token ou fluxo: recebe e devolve uma
 * **string única** e quem chama decide o que fazer com ela.
 *
 * **Por que uma string e não seis estados:** o valor que a API recebe é um
 * código, não seis letras. Guardar seis pedaços obrigaria toda tela que usa o
 * componente a remontá-los — e a errar de forma diferente ao colar, ao apagar
 * e ao voltar de um erro do servidor.
 */

type Props = {
  /** Dígitos já digitados, sem buracos. */
  value: string;
  onChangeText: (valor: string) => void;
  /** Quantas caixas. O padrão é o que a API valida (`VERIFICATION_CODE_DIGITS`). */
  length?: number;
  /** Rótulo do grupo para leitores de tela — ex.: "Código de verificação". */
  label: string;
  /** Chamado quando a última caixa é preenchida. Não envia nada sozinho. */
  onComplete?: (valor: string) => void;
  disabled?: boolean;
  /** Pinta as caixas como recusadas. A mensagem é responsabilidade da tela. */
  error?: boolean;
  autoFocus?: boolean;
};

export function CodeInput({
  value,
  onChangeText,
  length = 6,
  label,
  onComplete,
  disabled,
  error,
  autoFocus,
}: Props) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const caixas = useRef<(TextInput | null)[]>([]);
  const [focado, setFocado] = useState<number | null>(null);

  /** Primeira caixa vazia — é sempre para lá que o cursor deve ir. */
  const proximaVazia = Math.min(value.length, length - 1);

  function focar(indice: number) {
    caixas.current[indice]?.focus();
  }

  function escrever(indice: number, texto: string) {
    // Teclado numérico não impede colar letra nem o corretor de sugerir texto.
    const limpo = texto.replace(/\D/g, "");

    if (limpo.length === 0) {
      // Apagou o dígito desta caixa. Só o último pode sumir sem deixar buraco.
      onChangeText(value.slice(0, indice));
      return;
    }

    // Colar o código inteiro chega numa caixa só: distribui a partir dela.
    const proximo =
      limpo.length > 1
        ? (value.slice(0, indice) + limpo).slice(0, length)
        : (value.slice(0, indice) + limpo + value.slice(indice + 1)).slice(0, length);

    onChangeText(proximo);
    focar(Math.min(proximo.length, length - 1));
    if (proximo.length === length) onComplete?.(proximo);
  }

  function teclar(
    indice: number,
    evento: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (evento.nativeEvent.key !== "Backspace") return;
    // Caixa vazia: o apagar pertence à caixa anterior. Sem isto, a tecla não
    // faz nada e a pessoa fica presa na última caixa que preencheu.
    if (value[indice] === undefined && indice > 0) {
      onChangeText(value.slice(0, indice - 1));
      focar(indice - 1);
    }
  }

  return (
    <View style={styles.linha} role="group" aria-label={label}>
      {Array.from({ length }, (_, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            caixas.current[i] = el;
          }}
          value={value[i] ?? ""}
          onChangeText={(texto) => escrever(i, texto)}
          onKeyPress={(e) => teclar(i, e)}
          onFocus={() => {
            // Clicar numa caixa adiante deixaria buracos no meio do código —
            // e o valor deixaria de ser lido como uma string contígua. O foco
            // volta para onde a digitação de fato continua.
            if (i > proximaVazia) {
              focar(proximaVazia);
              return;
            }
            setFocado(i);
          }}
          onBlur={() => setFocado((atual) => (atual === i ? null : atual))}
          editable={!disabled}
          autoFocus={autoFocus && i === 0}
          // `maxLength` não vale para colar: o texto colado chega inteiro no
          // `onChangeText` e é lá que ele se espalha pelas caixas.
          maxLength={1}
          inputMode="numeric"
          keyboardType="number-pad"
          // Deixa o iOS/Android oferecerem o código do SMS/e-mail direto.
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          accessibilityLabel={`${label}: dígito ${i + 1} de ${length}`}
          style={[
            styles.caixa,
            error && { borderColor: t.colors.danger },
            focado === i && {
              borderColor: accent,
              boxShadow: anelCampo(accent, t.isDark),
            },
            disabled && styles.caixaInativa,
          ]}
        />
      ))}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    linha: {
      flexDirection: "row",
      gap: t.spacing.sm,
      justifyContent: "space-between",
    },
    caixa: {
      ...t.typography.title,
      // `width:100%; max-width:56px` do mockup: as caixas dividem a largura
      // disponível e param de crescer em 56 — em tela estreita elas encolhem
      // juntas em vez de estourar a linha.
      backgroundColor: t.colors.surfaceAlt,
      // Como no `Field`: o traço fino do mockup não cumpre os 3:1 de limite de
      // componente (WCAG 1.4.11), então o limite é o `borderStrong`.
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.md,
      borderWidth: 1,
      color: t.colors.text,
      flex: 1,
      fontSize: 22,
      fontWeight: "600",
      maxWidth: 56,
      minHeight: 56,
      // Sem isto a linha TRANSBORDA em telas estreitas: no navegador um
      // `<input>` tem `min-width: auto`, que resolve para a largura intrínseca
      // do campo e impede o item flex de encolher. Medido em 375px — as seis
      // caixas somavam 376px dentro de um cartão de 327 e a última saía 25px
      // para fora, sem aparecer no `scrollWidth` (o cartão recorta).
      minWidth: 0,
      textAlign: "center",
      ...transicao("border-color, box-shadow", motion.rapida),
      ...semContornoNativo(),
    },
    caixaInativa: {
      opacity: 0.6,
    },
  });
