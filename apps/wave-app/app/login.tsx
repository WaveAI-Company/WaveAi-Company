import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError } from "../src/auth/api";
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
 * "Esqueci minha senha" ficou fora do porte enquanto não havia envio de e-mail;
 * a P9-f trouxe o fluxo e a P11-d as telas, então o link existe e leva a
 * `/reset-password`.
 *
 * **Fora do porte por decisão (ADR-0041):** "manter conectado" — a sessão já
 * persiste pelo cookie de refresh, e o controle seria decorativo. Telar
 * controle sem função engana quem testa.
 */

const CHIPS = ["composição por banda", "qualidade do sinal", "tendências"];

export default function LoginScreen() {
  const { signIn, iniciarVerificacao } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [faltaVerificar, setFaltaVerificar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setErro(null);
    setFaltaVerificar(false);
    setEnviando(true);
    try {
      await signIn(email, password);
      // A guarda de rota redireciona para a área do papel.
    } catch (e) {
      // O 403 é o único caso em que o backend conta algo sobre a conta — e só
      // conta para quem já acertou a senha, então não vira oráculo (ADR-0024).
      // É a porta de volta de quem fechou o app no meio do cadastro.
      if (e instanceof ApiError && e.status === 403) {
        setFaltaVerificar(true);
        setErro("Falta confirmar seu e-mail para entrar.");
      } else {
        // Mensagem genérica: o backend não diz se o e-mail existe (ADR-0023) e
        // a UI não deve inventar essa distinção.
        setErro("Não foi possível entrar. Verifique os dados e tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  function irVerificar() {
    // A senha vai junto para o passo 3 poder entrar sem pedir tudo de novo;
    // sai da memória assim que o fluxo termina.
    iniciarVerificacao(email.trim(), password);
    router.push("/verify-email");
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

      {/* A `.auth-aux` do mockup, que lá divide a linha com "Manter conectado".
          Esse controle continua fora do porte (a sessão já persiste pelo cookie
          de refresh), então sobra o link — no lugar dele, à direita. */}
      <View style={styles.auxiliar}>
        <TextLink
          label="Esqueci minha senha"
          onPress={() => router.push("/reset-password")}
          accent={t.colors.accentPatientText}
          compacto
        />
      </View>

      <StateView error={erro} />

      {faltaVerificar ? (
        <View style={styles.retomar}>
          <Text style={styles.alternativaTexto}>Recebeu um código por e-mail? </Text>
          <TextLink label="Verificar agora" onPress={irVerificar} />
        </View>
      ) : null}

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
      color: t.colors.textSubtle,
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
    auxiliar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: -t.spacing.xs,
    },
    retomar: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      marginTop: -t.spacing.sm,
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
