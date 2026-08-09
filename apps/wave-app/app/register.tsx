import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UserRole } from "../src/auth/api";
import { useAuth } from "../src/auth/AuthContext";
import { AuthStage } from "../src/components/auth/AuthStage";
import { Button } from "../src/components/Button";
import { Field } from "../src/components/Field";
import { Icon, type IconName } from "../src/components/Icon";
import { StateView } from "../src/components/StateView";
import { TextLink } from "../src/components/TextLink";
import {
  anelFoco,
  elevar,
  motion,
  semContornoNativo,
  transicao,
  useAccentFor,
  useInteracao,
  useTheme,
  withAlpha,
  type Theme,
} from "../src/theme";

/** Alinhado aos limites validados pela API (schemas.py). */
const SENHA_MIN = 8;
const SENHA_MAX = 128;
const NOME_MAX = 120;
const EMAIL_MAX = 254;

// Formato só para feedback rápido no cliente; a API (EmailStr) é a autoridade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHIPS = ["você convida", "você pode revogar", "dados seus"];

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

const PAPEIS: { valor: UserRole; nome: string; descricao: string; icone: IconName }[] = [
  {
    valor: "patient",
    // "Paciente" e não "Pessoa" (como no mockup): decisão do fundador, e é o
    // termo que o cadastro já usava. O papel no dado segue `patient` (ADR-0036).
    nome: "Paciente",
    descricao: "Faço minhas sessões e acompanho minhas tendências.",
    icone: "user",
  },
  {
    valor: "doctor",
    nome: "Profissional de bem-estar",
    descricao: "Acompanho as tendências de quem me autorizar.",
    icone: "users",
  },
];

/**
 * Criar conta — porte de `Design/round1/criar-conta.html` (ADR-0042).
 *
 * Divide a cena com o login pelo `AuthStage`; muda a promessa da marca ("sua
 * onda, suas regras") e o conteúdo do cartão.
 *
 * Mantém inteiras as validações da rodada de correções (#103): erro por campo,
 * confirmação de senha, revelar por campo, limites de caracteres e os
 * requisitos de senha ao vivo — agora com o medidor e a dica de coincidência
 * do design.
 *
 * **Sem KYC** (ADR-0041): escolher "Profissional de bem-estar" não pede CRM nem
 * documento. A salvaguarda real é o consent-first — o acesso vem da autorização
 * do titular pelo CareLink, não de uma credencial.
 */
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
  const profissional = useAccentFor("doctor");
  const destaque = role === "doctor" ? profissional : paciente;

  const forca = avaliarSenha(password);
  const atendidos = [forca.min, forca.letra, forca.numero].filter(Boolean).length;

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
    <AuthStage
      chamada={{ antes: "Sua onda, suas ", destaque: "regras", depois: "." }}
      texto="Você decide quem acompanha seu bem-estar: convida, autoriza e revoga quando quiser. Tudo exploratório — nada de laudos."
      chips={CHIPS}
      resumo="Sua onda, suas regras. Você convida, autoriza e revoga."
      larguraCartao={420}
    >
      <View style={styles.cabecalho}>
        <Text style={styles.sobrancelha}>CRIAR CONTA</Text>
        <Text style={styles.titulo}>Comece sua jornada</Text>
        <Text style={styles.subtitulo}>Leva um minuto. Você poderá ajustar tudo depois.</Text>
      </View>

      <Field
        label="Nome"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={NOME_MAX}
        placeholder="Como devemos te chamar?"
        error={erros.nome}
      />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        maxLength={EMAIL_MAX}
        placeholder="voce@exemplo.com.br"
        error={erros.email}
      />

      <View>
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          revealable
          autoComplete="new-password"
          maxLength={SENHA_MAX}
          placeholder="Crie uma senha"
          error={erros.senha}
        />

        {/* Medidor: resumo VISUAL dos mesmos requisitos da lista abaixo, que é
            quem carrega a informação para o leitor de tela. Fala em requisitos
            atendidos, não em "força" — "senha1234" cumpre os três e nem por
            isso é uma senha forte; prometer isso seria um medidor mentiroso. */}
        <View style={styles.medidor} aria-hidden>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.segmento,
                {
                  backgroundColor:
                    i < atendidos ? destaque.accent : t.colors.surfaceStrong,
                },
              ]}
            />
          ))}
          <Text style={styles.medidorTexto}>{atendidos} de 3</Text>
        </View>

        <View style={styles.requisitos} accessibilityRole="list">
          {[
            { ok: forca.min, texto: "ao menos 8 caracteres" },
            { ok: forca.letra, texto: "uma letra" },
            { ok: forca.numero, texto: "um número" },
          ].map((item) => (
            <View
              key={item.texto}
              style={styles.requisito}
              accessibilityLabel={`${item.texto}: ${item.ok ? "atendido" : "pendente"}`}
            >
              <View
                style={[
                  styles.requisitoSelo,
                  item.ok
                    ? { backgroundColor: destaque.accent, borderColor: destaque.accent }
                    : { borderColor: t.colors.borderStrong },
                ]}
              >
                {item.ok ? (
                  <Icon name="check" size={10} color={destaque.onAccent} strokeWidth={3.4} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.requisitoTexto,
                  item.ok && { color: t.colors.text },
                ]}
              >
                {item.texto}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <Field
          label="Confirmar senha"
          value={confirma}
          onChangeText={setConfirma}
          secureTextEntry
          revealable
          autoComplete="new-password"
          maxLength={SENHA_MAX}
          placeholder="Repita a senha"
          error={erros.confirma}
        />
        {/* Coincidir tem valência legítima: é sobre acertar o que se digitou,
            não sobre o estado de ninguém (ADR-0027). */}
        {confirma.length > 0 && !erros.confirma ? (
          <Text
            accessibilityRole="alert"
            style={[
              styles.dica,
              { color: confirma === password ? destaque.accentText : t.colors.warningText },
            ]}
          >
            {confirma === password
              ? "As senhas coincidem."
              : "As senhas ainda não coincidem."}
          </Text>
        ) : null}
      </View>

      <View style={styles.papeis}>
        <Text style={styles.papeisTitulo}>Como você vai usar o WaveAI?</Text>
        <View style={styles.papeisGrade} accessibilityRole="radiogroup">
          {PAPEIS.map((opcao) => (
            <OpcaoPapel
              key={opcao.valor}
              opcao={opcao}
              selecionado={role === opcao.valor}
              cor={opcao.valor === "doctor" ? profissional.accent : paciente.accent}
              onPress={() => setRole(opcao.valor)}
              styles={styles}
            />
          ))}
        </View>
      </View>

      <StateView error={erros.geral} />

      <Button label="Criar conta" onPress={criar} loading={enviando} accent={destaque.accent} />

      {/* No lugar dos links de Termos/Privacidade do mockup, que não existem:
          o compromisso que o produto de fato cumpre, e onde ele é decidido. */}
      <Text style={styles.legal}>
        Nada das suas sessões é guardado antes de você autorizar — o termo de consentimento
        aparece no primeiro acesso, e você pode revogá-lo quando quiser.
      </Text>

      <View style={styles.alternativa}>
        <Text style={styles.alternativaTexto}>Já tem conta? </Text>
        <TextLink
          label="Entrar"
          onPress={() => router.push("/login")}
          accent={destaque.accentText}
        />
      </View>
    </AuthStage>
  );
}

/**
 * Um cartão de escolha de papel — o `.role-opt` do mockup, que ao ponteiro
 * puxa a borda para o destaque e sobe 2px. Componente próprio porque cada
 * cartão tem seu estado de interação, e hook não vive dentro de `map`.
 */
function OpcaoPapel({
  opcao,
  selecionado,
  cor,
  onPress,
  styles,
}: {
  opcao: (typeof PAPEIS)[number];
  selecionado: boolean;
  cor: string;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const t = useTheme();
  const { estado, handlers, reduzirMovimento } = useInteracao();
  const noAr = estado.hovered && !estado.pressed;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionado, selected: selecionado }}
      aria-checked={selecionado}
      accessibilityLabel={`${opcao.nome}. ${opcao.descricao}`}
      onPress={onPress}
      {...handlers}
      style={[
        styles.papel,
        selecionado
          ? { backgroundColor: t.colors.surface, borderColor: cor }
          : { borderColor: noAr ? cor : t.colors.border },
        noAr && elevar(-2, reduzirMovimento),
        estado.focoVisivel ? { boxShadow: anelFoco(cor, t.colors.background) } : null,
      ]}
    >
      <View
        style={[styles.papelIcone, selecionado && { backgroundColor: withAlpha(cor, 0.14) }]}
      >
        <Icon
          name={opcao.icone}
          size={17}
          color={selecionado || noAr ? cor : t.colors.textMuted}
          strokeWidth={1.8}
        />
      </View>
      <Text style={styles.papelNome}>{opcao.nome}</Text>
      <Text style={styles.papelDescricao}>{opcao.descricao}</Text>
    </Pressable>
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
      color: t.colors.textMuted,
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
      color: t.colors.textMuted,
    },
    dica: {
      ...t.typography.caption,
      marginTop: 6,
    },
    papeis: {
      gap: t.spacing.sm,
    },
    papeisTitulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    papeisGrade: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm + 2,
    },
    papel: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      borderWidth: 1,
      flex: 1,
      gap: 2,
      minWidth: 170,
      padding: t.spacing.md - 2,
      ...transicao("transform, border-color, box-shadow", [
        motion.rapida,
        motion.media,
        motion.media,
      ]),
      ...semContornoNativo(),
    },
    papelIcone: {
      alignItems: "center",
      backgroundColor: t.colors.surfaceStrong,
      borderRadius: 17,
      height: 34,
      justifyContent: "center",
      marginBottom: t.spacing.sm,
      width: 34,
    },
    papelNome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontSize: 14,
    },
    papelDescricao: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      lineHeight: 17,
    },
    legal: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      lineHeight: 17,
      textAlign: "center",
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
