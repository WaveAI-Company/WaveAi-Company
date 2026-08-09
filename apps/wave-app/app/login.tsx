import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../src/auth/AuthContext";
import { AuthStage } from "../src/components/auth/AuthStage";
import { Button } from "../src/components/Button";
import { Field } from "../src/components/Field";
import { StateView } from "../src/components/StateView";
import { TextLink } from "../src/components/TextLink";
import { useTheme, type Theme } from "../src/theme";

/**
 * Entrada do produto — porte do design "Maré" (`Design/round1/login.html`,
 * ADR-0042). É também a raiz `/` (o `app/index.tsx` renderiza esta tela).
 *
 * A cena (marca + formulário, nas três larguras) mora no `AuthStage`, que esta
 * tela divide com o cadastro.
 *
 * **Fora do porte por decisão (ADR-0041):** "esqueci minha senha" (depende de
 * envio de e-mail, nasce no P5) e "manter conectado" (a sessão já persiste pelo
 * cookie de refresh — o controle seria decorativo). Telar controle sem função
 * engana quem testa.
 */

const CHIPS = ["composição por banda", "qualidade do sinal", "tendências"];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setErro(null);
    setEnviando(true);
    try {
      await signIn(email, password);
      // A guarda de rota redireciona para a área do papel.
    } catch {
      // Mensagem genérica: o backend não diz se o e-mail existe (ADR-0023) e
      // a UI não deve inventar essa distinção.
      setErro("Não foi possível entrar. Verifique os dados e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthStage
      chamada={{ antes: "A calma tem um ", destaque: "ritmo", depois: ". Acompanhe o seu." }}
      texto="Tendências e estados mentais do seu EEG de consumo, analisados no servidor WaveAI — exploratório, transparente, seu."
      chips={CHIPS}
      resumo="Tendências do seu EEG, analisadas no servidor. Exploratório."
    >
      <View style={styles.cabecalho}>
        <Text style={styles.sobrancelha}>BEM-VINDO(A) DE VOLTA</Text>
        <Text style={styles.titulo}>Entrar na sua conta</Text>
        <Text style={styles.subtitulo}>Acesse suas sessões, tendências e estados mentais.</Text>
      </View>

      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="voce@exemplo.com.br"
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        revealable
        autoComplete="current-password"
        placeholder="Sua senha"
      />

      <StateView error={erro} />

      <Button label="Entrar" onPress={entrar} loading={enviando} />

      <View style={styles.alternativa}>
        <Text style={styles.alternativaTexto}>Primeiro acesso? </Text>
        <TextLink
          label="Criar conta"
          onPress={() => router.push("/register")}
          accent={t.colors.accentPatientText}
        />
      </View>
    </AuthStage>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cabecalho: {
      gap: t.spacing.xs,
      marginBottom: t.spacing.sm,
    },
    sobrancelha: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontWeight: "700",
      letterSpacing: 1.1,
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    subtitulo: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
    alternativa: {
      alignItems: "center",
      borderTopColor: t.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      justifyContent: "center",
      paddingTop: t.spacing.md,
    },
    alternativaTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
  });
