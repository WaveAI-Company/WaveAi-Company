import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useAuth } from "../src/auth/AuthContext";
import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { Field } from "../src/components/Field";
import { HeadFigure } from "../src/components/brand/HeadFigure";
import { Logo } from "../src/components/brand/Logo";
import { WaveField } from "../src/components/brand/WaveField";
import { Icon } from "../src/components/Icon";
import { StateView } from "../src/components/StateView";
import { palettes, useTheme, withAlpha, type Theme } from "../src/theme";

/**
 * Entrada do produto — porte do design "Maré" (`Design/round1/login.html`,
 * ADR-0042). É também a raiz `/` (o `app/index.tsx` renderiza esta tela).
 *
 * O layout tem três formas, como no design: **duas colunas** (marca ao lado do
 * formulário), **empilhado** (marca acima) e **compacto** (só um cabeçalho de
 * marca, sem a figura). A quebra é por largura de janela, não por plataforma —
 * é a mesma tela num tablet e num navegador estreito.
 *
 * **Fora do porte por decisão (ADR-0041):** "esqueci minha senha" (depende de
 * envio de e-mail, nasce no P5) e "manter conectado" (a sessão já persiste pelo
 * cookie de refresh — o controle seria decorativo). Telar controle sem função
 * engana quem testa.
 */

/** A partir daqui cabem marca e formulário lado a lado. */
const LARGURA_DUAS_COLUNAS = 1100;
/** Abaixo daqui a figura sai e sobra só o cabeçalho de marca. */
const LARGURA_MARCA_CHEIA = 640;

/** O painel da marca é sempre escuro, mesmo no tema claro — como no design. */
const P = palettes.dark;

const CHIPS = ["composição por banda", "qualidade do sinal", "tendências"];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const duasColunas = width >= LARGURA_DUAS_COLUNAS;
  const marcaCheia = width >= LARGURA_MARCA_CHEIA;

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
    <View style={[styles.palco, duasColunas && styles.palcoLado]}>
      {marcaCheia ? <PainelMarca empilhado={!duasColunas} /> : null}

      <ScrollView
        style={styles.painelAuth}
        contentContainerStyle={styles.painelAuthConteudo}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.barraTopo}>
          <AlternarTema />
        </View>

        {!marcaCheia ? (
          <View style={styles.marcaCompacta}>
            <Logo size={34} withWordmark tagline="bem-estar exploratório" />
            <Text style={styles.marcaCompactaTexto}>
              Tendências do seu EEG, analisadas no servidor. Exploratório.
            </Text>
            <WaveField height={48} opacity={0.4} amplitude={10} style={styles.ondaCompacta} />
          </View>
        ) : null}

        <View style={styles.cartao}>
          <View style={styles.cabecalho}>
            <Text style={styles.sobrancelha}>BEM-VINDO(A) DE VOLTA</Text>
            <Text style={styles.titulo}>Entrar na sua conta</Text>
            <Text style={styles.subtitulo}>
              Acesse suas sessões, tendências e estados mentais.
            </Text>
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
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Criar conta"
              onPress={() => router.push("/register")}
              hitSlop={8}
            >
              <Text style={styles.alternativaLink}>Criar conta</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rodape}>
          <Disclaimer />
        </View>
      </ScrollView>
    </View>
  );
}

/** Alterna claro/escuro sem sair da tela (o login roda fora da casca). */
function AlternarTema() {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const irPara = t.isDark ? "light" : "dark";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mudar para o tema ${t.isDark ? "claro" : "escuro"}`}
      onPress={() => t.setPreference(irPara)}
      style={styles.botaoTema}
      hitSlop={8}
    >
      <Icon name={t.isDark ? "sun" : "moon"} size={18} color={t.colors.text} />
    </Pressable>
  );
}

/**
 * Painel de marca: gradientes de fundo, figura da constelação, promessa do
 * produto e o aviso de posicionamento. Sempre em tom escuro.
 */
function PainelMarca({ empilhado }: { empilhado: boolean }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  return (
    <View style={[styles.painelMarca, empilhado && styles.painelMarcaEmpilhado]}>
      {/* Dois halos de luz nos cantos opostos — o "fundo" do design. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="halo-a" cx="15%" cy="0%" rx="80%" ry="70%">
            <Stop offset="0" stopColor={P.accentPatient} stopOpacity={0.14} />
            <Stop offset="1" stopColor={P.accentPatient} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-b" cx="90%" cy="100%" rx="70%" ry="60%">
            <Stop offset="0" stopColor={P.accentDoctor} stopOpacity={0.12} />
            <Stop offset="1" stopColor={P.accentDoctor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo-a)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo-b)" />
      </Svg>

      <View style={styles.marcaTopo}>
        <Logo size={34} />
        <View>
          <Text style={styles.marcaNome}>WaveAI</Text>
          <Text style={styles.marcaTagline}>BEM-ESTAR EXPLORATÓRIO</Text>
        </View>
      </View>

      <View style={styles.marcaCentro}>
        {!empilhado ? <HeadFigure width={280} /> : <HeadFigure width={180} />}
        <Text style={styles.chamada}>
          A calma tem um <Text style={styles.chamadaDestaque}>ritmo</Text>. Acompanhe o seu.
        </Text>
        <Text style={styles.chamadaTexto}>
          Tendências e estados mentais do seu EEG de consumo, analisados no servidor WaveAI —
          exploratório, transparente, seu.
        </Text>
        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <View key={c} style={styles.chip}>
              <View style={styles.chipPonto} />
              <Text style={styles.chipTexto}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.marcaRodape}>
        Plataforma exploratória de bem-estar. Não realiza diagnóstico e não substitui
        acompanhamento de saúde.
      </Text>

      <WaveField height={140} style={styles.ondaMarca} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    palco: {
      backgroundColor: t.colors.background,
      flex: 1,
    },
    palcoLado: {
      flexDirection: "row",
    },

    // ---------- painel da marca ----------
    painelMarca: {
      backgroundColor: P.background,
      flex: 1.15,
      justifyContent: "space-between",
      overflow: "hidden",
      padding: t.spacing.xl,
    },
    painelMarcaEmpilhado: {
      flex: 0,
      minHeight: 380,
      padding: t.spacing.lg,
    },
    marcaTopo: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    marcaNome: {
      ...t.typography.heading,
      color: P.text,
      fontWeight: "700",
    },
    marcaTagline: {
      ...t.typography.caption,
      color: withAlpha(P.text, 0.55),
      fontSize: 11,
      letterSpacing: 1,
    },
    marcaCentro: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
    },
    chamada: {
      ...t.typography.display,
      color: P.text,
      maxWidth: 480,
      textAlign: "center",
    },
    chamadaDestaque: {
      color: P.accentPatientText,
    },
    chamadaTexto: {
      ...t.typography.body,
      color: withAlpha(P.text, 0.72),
      maxWidth: 400,
      textAlign: "center",
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      justifyContent: "center",
      marginTop: t.spacing.xs,
    },
    chip: {
      alignItems: "center",
      backgroundColor: withAlpha(P.text, 0.06),
      borderColor: withAlpha(P.text, 0.14),
      borderRadius: t.radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: t.spacing.sm + 4,
      paddingVertical: 4,
    },
    chipPonto: {
      backgroundColor: P.accentPatient,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    chipTexto: {
      ...t.typography.caption,
      color: withAlpha(P.text, 0.8),
      fontWeight: "600",
    },
    marcaRodape: {
      ...t.typography.caption,
      alignSelf: "center",
      color: withAlpha(P.text, 0.5),
      maxWidth: 440,
      textAlign: "center",
    },
    ondaMarca: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
    },

    // ---------- painel de autenticação ----------
    painelAuth: {
      backgroundColor: t.colors.background,
      flex: 1,
    },
    painelAuthConteudo: {
      alignItems: "center",
      flexGrow: 1,
      justifyContent: "center",
      padding: t.spacing.lg,
    },
    barraTopo: {
      alignItems: "flex-end",
      alignSelf: "stretch",
    },
    botaoTema: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      height: t.minTouch,
      justifyContent: "center",
      width: t.minTouch,
    },
    marcaCompacta: {
      alignItems: "center",
      alignSelf: "stretch",
      gap: t.spacing.xs,
      overflow: "hidden",
      paddingBottom: t.spacing.md,
    },
    marcaCompactaTexto: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      textAlign: "center",
    },
    ondaCompacta: {
      alignSelf: "stretch",
    },
    cartao: {
      alignSelf: "center",
      gap: t.spacing.md,
      maxWidth: 400,
      width: "100%",
    },
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
    alternativaLink: {
      ...t.typography.bodyStrong,
      color: t.colors.accentPatientText,
    },
    rodape: {
      alignItems: "center",
      alignSelf: "stretch",
      maxWidth: 480,
    },
  });
