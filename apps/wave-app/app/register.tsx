import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UserRole } from "../src/auth/api";
import { useAuth } from "../src/auth/AuthContext";
import { Button } from "../src/components/Button";
import { Field } from "../src/components/Field";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { ScreenHeading } from "../src/components/ScreenHeading";
import { StateView } from "../src/components/StateView";
import { useAccentFor, useTheme, type Theme } from "../src/theme";

/** Alinhado ao mínimo validado pela API. */
const SENHA_MIN = 8;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("patient");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // O destaque acompanha o papel escolhido — o "sotaque" começa já no cadastro.
  const paciente = useAccentFor("patient");
  const medico = useAccentFor("doctor");
  const destaque = role === "doctor" ? medico : paciente;

  async function criar() {
    setErro(null);
    if (password.length < SENHA_MIN) {
      setErro(`A senha precisa ter ao menos ${SENHA_MIN} caracteres.`);
      return;
    }
    setEnviando(true);
    try {
      await signUp({ email, password, role, displayName });
    } catch {
      setErro("Não foi possível criar a conta. Confira os dados e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeading title="Criar conta" />

      <Field
        label="Nome"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        placeholder="Como quer ser chamado"
      />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="voce@exemplo.com"
      />
      <Field
        label={`Senha (mínimo ${SENHA_MIN} caracteres)`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholder="escolha uma senha"
      />

      <Text style={styles.label}>Perfil</Text>
      <View style={styles.papeis} accessibilityRole="radiogroup">
        {(["patient", "doctor"] as const).map((opcao) => {
          const selecionado = role === opcao;
          const cor = opcao === "doctor" ? medico.accent : paciente.accent;
          const nome = opcao === "patient" ? "Paciente" : "Médico";
          return (
            <Pressable
              key={opcao}
              accessibilityRole="radio"
              accessibilityState={{ selected: selecionado }}
              accessibilityLabel={nome}
              onPress={() => setRole(opcao)}
              style={[styles.papel, { borderColor: selecionado ? cor : t.colors.borderStrong }]}
            >
              <Text style={styles.papelTexto}>{nome}</Text>
            </Pressable>
          );
        })}
      </View>

      <StateView error={erro} />

      <Button label="Criar conta" onPress={criar} loading={enviando} accent={destaque.accent} />
      <Button
        label="Já tem conta? Entrar"
        onPress={() => router.push("/login")}
        variant="secondary"
      />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    label: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    papeis: {
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    papel: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 2,
      flex: 1,
      justifyContent: "center",
      minHeight: t.minTouch,
      paddingVertical: t.spacing.md,
    },
    papelTexto: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      textAlign: "center",
    },
  });
