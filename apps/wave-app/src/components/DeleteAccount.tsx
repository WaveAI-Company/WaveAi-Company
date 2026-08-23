import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { useTheme, type Theme } from "../theme";
import { Button } from "./Button";
import { Field } from "./Field";
import { Panel } from "./Panel";

/**
 * Encerrar a conta (ADR-0047).
 *
 * **Dois passos de propósito.** Fechado, é só um botão que abre a explicação;
 * aberto, exige a senha. Um clique só, mesmo com diálogo, apagaria a vida de
 * alguém no produto a um toque de distância num aparelho destravado.
 *
 * A lista do que some vem **antes** do campo de senha, não depois: quem lê a
 * consequência já com a senha digitada tende a seguir em frente. E a tela diz
 * que **não há volta** com todas as letras — prometer recuperação que não
 * existe seria exatamente a afirmação falsa que a ADR-0027 proíbe.
 */
export function DeleteAccount() {
  const t = useTheme();
  const router = useRouter();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { deleteAccount } = useAuth();

  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);

  function fechar() {
    setAberto(false);
    setSenha("");
    setErro(null);
  }

  async function apagar() {
    if (senha.length === 0) {
      setErro("Digite sua senha para confirmar.");
      return;
    }
    setApagando(true);
    setErro(null);
    try {
      await deleteAccount(senha);
      // `replace` e não `push`: não há para onde voltar — a conta não existe.
      router.replace("/login");
    } catch {
      // Mensagem única para senha errada e falha de rede: distinguir as duas
      // aqui não ajudaria ninguém a agir diferente, e a API já responde de
      // forma genérica a credencial inválida.
      setErro("Não foi possível encerrar a conta. Confira a senha e tente de novo.");
      setApagando(false);
    }
  }

  return (
    <Panel title="Encerrar conta">
      {!aberto ? (
        <>
          <Text style={styles.texto}>
            Encerrar a conta apaga tudo o que é seu no WaveAI. A ação é imediata e não
            pode ser desfeita.
          </Text>
          <View style={styles.acao}>
            <Button
              label="Encerrar minha conta"
              onPress={() => setAberto(true)}
              variant="secondary"
              largura="conteudo"
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.aviso}>Isto apaga, agora e para sempre:</Text>
          <View style={styles.lista}>
            {[
              "todas as suas sessões e medidas",
              "todas as suas anotações de contexto",
              "os vínculos com profissionais e os convites",
              "seu cadastro e seu acesso",
            ].map((item) => (
              <View key={item} style={styles.itemLinha}>
                <Text style={styles.marcador} aria-hidden>
                  •
                </Text>
                <Text style={styles.item}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.texto}>
            Não há prazo de arrependimento e não existe cópia de segurança que possamos
            restaurar. Se quiser guardar seus dados, exporte-os antes.
          </Text>
          {/* O que sobrevive, dito aqui e não escondido: o titular que ficou
              não pode perder a evidência de que alguém leu os dados dele
              (ADR-0047). */}
          <Text style={styles.nota}>
            O registro de que você acessou dados de outra pessoa permanece na trilha
            dela, sem identificar você.
          </Text>

          <Field
            label="Sua senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            revealable
            autoComplete="current-password"
            placeholder="Confirme com a senha da conta"
            error={erro ?? undefined}
          />

          <View style={styles.botoes}>
            <Button
              label="Cancelar"
              onPress={fechar}
              variant="secondary"
              largura="conteudo"
              disabled={apagando}
            />
            <Button
              label="Apagar minha conta"
              onPress={apagar}
              loading={apagando}
              largura="conteudo"
              accent={t.colors.danger}
            />
          </View>
        </>
      )}
    </Panel>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    texto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      lineHeight: 22,
    },
    aviso: {
      ...t.typography.bodyStrong,
      color: t.colors.dangerText,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    lista: {
      gap: 2,
      marginBottom: t.spacing.xs,
    },
    itemLinha: {
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    marcador: {
      ...t.typography.body,
      color: t.colors.textSubtle,
    },
    item: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flex: 1,
    },
    acao: {
      marginTop: t.spacing.sm,
    },
    botoes: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      marginTop: t.spacing.md,
    },
  });
