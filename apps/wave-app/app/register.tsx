import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UserRole } from "../src/auth/api";
import { useAuth } from "../src/auth/AuthContext";
import { Button } from "../src/components/Button";
import { Field } from "../src/components/Field";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { colors, radius, spacing } from "../src/theme";

/** Alinhado ao mínimo validado pela API. */
const SENHA_MIN = 8;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("patient");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
      <Text style={styles.heading}>Criar conta</Text>

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
      <View style={styles.papeis}>
        {(["patient", "doctor"] as const).map((opcao) => (
          <Pressable
            key={opcao}
            accessibilityRole="radio"
            accessibilityState={{ selected: role === opcao }}
            onPress={() => setRole(opcao)}
            style={[
              styles.papel,
              role === opcao && {
                borderColor: opcao === "doctor" ? colors.doctor : colors.patient,
              },
            ]}
          >
            <Text style={styles.papelTexto}>
              {opcao === "patient" ? "Paciente" : "Médico"}
            </Text>
          </Pressable>
        ))}
      </View>

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <Button
        label="Criar conta"
        onPress={criar}
        loading={enviando}
        accent={role === "doctor" ? colors.doctor : colors.patient}
      />

      <Link href="/login" style={styles.link}>
        Já tem conta? Entrar
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
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  papeis: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  papel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    paddingVertical: spacing.md,
  },
  papelTexto: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
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
