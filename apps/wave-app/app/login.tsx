import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { useAuth } from "../src/auth/AuthContext";
import { Button } from "../src/components/Button";
import { Field } from "../src/components/Field";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { colors, spacing } from "../src/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
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
    <ScreenContainer>
      <Text style={styles.heading}>Entrar</Text>

      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="voce@exemplo.com"
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder="sua senha"
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <Button label="Entrar" onPress={entrar} loading={enviando} accent={colors.patient} />

      <Link href="/register" style={styles.link}>
        Não tem conta? Criar conta
      </Link>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  erro: {
    color: colors.warning,
    fontSize: 14,
  },
  link: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: spacing.sm,
    textAlign: "center",
  },
});
