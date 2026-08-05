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

/** Alinhado aos limites validados pela API (schemas.py). */
const SENHA_MIN = 8;
const SENHA_MAX = 128;
const NOME_MAX = 120;
const EMAIL_MAX = 254;

// Formato só para feedback rápido no cliente; a API (EmailStr) é a autoridade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ForcaSenha = { min: boolean; letra: boolean; numero: boolean };

function avaliarSenha(senha: string): ForcaSenha {
  return {
    min: senha.length >= SENHA_MIN,
    letra: /[a-zA-Z]/.test(senha),
    numero: /[0-9]/.test(senha),
  };
}

function senhaValida(f: ForcaSenha): boolean {
  return f.min && f.letra && f.numero;
}

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirma, setConfirma] = useState("");
  const [role, setRole] = useState<UserRole>("patient");

  const [erros, setErros] = useState<{
    nome?: string;
    email?: string;
    senha?: string;
    confirma?: string;
    geral?: string;
  }>({});
  const [enviando, setEnviando] = useState(false);

  // O destaque acompanha o papel escolhido — o "sotaque" começa já no cadastro.
  const paciente = useAccentFor("patient");
  const medico = useAccentFor("doctor");
  const destaque = role === "doctor" ? medico : paciente;

  const forca = avaliarSenha(password);

  async function criar() {
    const novos: typeof erros = {};
    if (!displayName.trim()) novos.nome = "Informe seu nome.";
    if (!EMAIL_RE.test(email.trim())) novos.email = "Digite um e-mail válido.";
    if (!senhaValida(forca)) {
      novos.senha = "A senha precisa de ao menos 8 caracteres, com letra e número.";
    }
    if (confirma !== password) novos.confirma = "As senhas não coincidem.";

    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    setEnviando(true);
    try {
      await signUp({ email: email.trim(), password, role, displayName: displayName.trim() });
    } catch {
      setErros({
        geral: "Não foi possível criar a conta. Confira os dados e tente de novo.",
      });
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
        maxLength={NOME_MAX}
        placeholder="Como quer ser chamado"
        error={erros.nome}
      />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        maxLength={EMAIL_MAX}
        placeholder="voce@exemplo.com"
        error={erros.email}
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        revealable
        autoComplete="new-password"
        maxLength={SENHA_MAX}
        placeholder="escolha uma senha"
        error={erros.senha}
      />

      <RequisitosSenha forca={forca} styles={styles} accent={destaque.accent} muted={t.colors.textMuted} />

      <Field
        label="Confirmar senha"
        value={confirma}
        onChangeText={setConfirma}
        secureTextEntry
        revealable
        autoComplete="new-password"
        maxLength={SENHA_MAX}
        placeholder="repita a senha"
        error={erros.confirma}
      />

      <Text style={styles.label}>Perfil</Text>
      <View style={styles.papeis} accessibilityRole="radiogroup">
        {(["patient", "doctor"] as const).map((opcao) => {
          const selecionado = role === opcao;
          const cor = opcao === "doctor" ? medico.accent : paciente.accent;
          const nome = opcao === "patient" ? "Paciente" : "Profissional";
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

      <StateView error={erros.geral} />

      <Button label="Criar conta" onPress={criar} loading={enviando} accent={destaque.accent} />
      <Button
        label="Já tem conta? Entrar"
        onPress={() => router.push("/login")}
        variant="secondary"
      />
    </ScreenContainer>
  );
}

/** Checklist ao vivo dos requisitos de senha. Cor = requisito atendido. */
function RequisitosSenha({
  forca,
  styles,
  accent,
  muted,
}: {
  forca: ForcaSenha;
  styles: ReturnType<typeof criarEstilos>;
  accent: string;
  muted: string;
}) {
  const itens: Array<{ ok: boolean; texto: string }> = [
    { ok: forca.min, texto: "Ao menos 8 caracteres" },
    { ok: forca.letra, texto: "Uma letra" },
    { ok: forca.numero, texto: "Um número" },
  ];
  return (
    <View style={styles.requisitos} accessibilityRole="list">
      {itens.map((item) => (
        <Text
          key={item.texto}
          accessibilityLabel={`${item.texto}: ${item.ok ? "ok" : "pendente"}`}
          style={[styles.requisito, { color: item.ok ? accent : muted }]}
        >
          {item.ok ? "✓" : "○"} {item.texto}
        </Text>
      ))}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    label: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    requisitos: {
      gap: 2,
      paddingLeft: t.spacing.xs,
    },
    requisito: {
      ...t.typography.caption,
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
