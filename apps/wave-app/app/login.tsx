import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../src/auth/AuthContext";
import { Button } from "../src/components/Button";
import { Field } from "../src/components/Field";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { ScreenHeading } from "../src/components/ScreenHeading";
import { StateView } from "../src/components/StateView";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
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
      <ScreenHeading title="Entrar" />

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

      <StateView error={erro} />

      <Button label="Entrar" onPress={entrar} loading={enviando} />
      <Button
        label="Não tem conta? Criar conta"
        onPress={() => router.push("/register")}
        variant="secondary"
      />
    </ScreenContainer>
  );
}
