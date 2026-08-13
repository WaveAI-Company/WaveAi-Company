import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ApiError, forgotPassword, resetPassword } from "../src/auth/api";
import { AuthStage } from "../src/components/auth/AuthStage";
import { AuthSteps } from "../src/components/auth/AuthSteps";
import { Button } from "../src/components/Button";
import { CodeInput } from "../src/components/CodeInput";
import { Field } from "../src/components/Field";
import { Icon, type IconName } from "../src/components/Icon";
import {
  PasswordMatch,
  PasswordStrength,
  SENHA_MAX,
  avaliarSenha,
  senhaValida,
} from "../src/components/PasswordStrength";
import { StateView } from "../src/components/StateView";
import { TextLink } from "../src/components/TextLink";
import {
  useAccentFor,
  useReduzirMovimento,
  useTheme,
  withAlpha,
  type Theme,
} from "../src/theme";

/**
 * Recuperar acesso — porte das cinco views de `Design/round1/login.html`
 * (`#view-forgot`, `#view-sent`, `#view-code`, `#view-newpass`, `#view-done`),
 * que no mockup são views da mesma página.
 *
 * **Uma rota para as duas formas do mesmo segredo** (ADR-0044): quem pede pelo
 * app entra em `/reset-password` e caminha pelos passos; quem abre o link do
 * e-mail cai em `/reset-password?token=…` e pula direto para a senha nova — é
 * este o endereço que a API já escreve no e-mail (`email_link_base_url`).
 */

const DIGITOS = 6;
/** Espelha `verification_resend_cooldown_seconds` da API, que é quem manda. */
const REENVIO_SEGUNDOS = 60;
/** `single_use_token_ttl_minutes`. */
const VALIDADE_MINUTOS = 10;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHIPS = ["composição por banda", "qualidade do sinal", "tendências"];

/** Recusa única da API para código/token errado, expirado ou já usado. */
const CODIGO_INVALIDO = "Código inválido ou expirado. Confira os dígitos ou peça um novo.";

type Passo = "pedir" | "enviado" | "codigo" | "senha" | "pronto";

/**
 * O token do link, fora do estado do componente **de propósito**.
 *
 * Tirar o `?token=…` da barra de endereço custa um `router.replace`, e ele
 * **remonta** esta tela — o token guardado em `useState` ia embora junto e a
 * pessoa caía de volta no passo 1 (medido no smoke). O `history.replaceState`
 * não serve: o expo-router sincroniza a URL com o estado de navegação e a
 * restaura logo em seguida.
 *
 * Vive só nesta sessão de JS, some ao recarregar a página, e é apagado assim
 * que o fluxo termina ou recomeça.
 */
let tokenDoLink: string | null = null;

function mascarar(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return email;
  return `${local.slice(0, local.length > 2 ? 2 : 1)}•••@${dominio}`;
}

function formatar(segundos: number): string {
  return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(
    segundos % 60,
  ).padStart(2, "0")}`;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  // Fora da área logada não há papel; o destaque é o do paciente, como no login.
  const destaque = useAccentFor("patient");
  const params = useLocalSearchParams<{ token?: string }>();

  // O token sai da URL, onde ficaria no histórico do navegador e poderia vazar
  // no `Referer`. Preço: recarregar a página depois disso perde o token — e a
  // volta é o link do e-mail, que continua valendo os 10 minutos.
  const [token, setToken] = useState<string | null>(tokenDoLink);
  const doLink = token !== null;

  // Já remontado depois da limpeza da URL: retoma onde o link tinha parado.
  const [passo, setPasso] = useState<Passo>(tokenDoLink ? "senha" : "pedir");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** O segredo foi gasto e não vale mais: o único caminho é pedir outro. */
  const [segredoGasto, setSegredoGasto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [restante, setRestante] = useState(REENVIO_SEGUNDOS);

  useEffect(() => {
    if (!params.token) return;
    tokenDoLink = params.token;
    setToken(params.token);
    setPasso("senha");
    router.replace("/reset-password");
  }, [params.token, router]);

  useEffect(() => {
    if (restante <= 0) return;
    const id = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restante]);

  const forca = avaliarSenha(senha);
  const podeSalvar = senhaValida(forca) && confirma === senha;

  function limparRecados() {
    setErro(null);
    setErroCampo(null);
    setAviso(null);
  }

  async function pedir() {
    if (!EMAIL_RE.test(email.trim())) {
      setErroCampo("Digite um e-mail válido.");
      return;
    }
    limparRecados();
    setSegredoGasto(false);
    setEnviando(true);
    try {
      await forgotPassword(email.trim());
      setRestante(REENVIO_SEGUNDOS);
      setPasso("enviado");
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 429
          ? "Tentativas demais. Espere alguns instantes e tente de novo."
          : "Não foi possível pedir a recuperação agora. Tente de novo em instantes.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    limparRecados();
    setEnviando(true);
    try {
      await forgotPassword(email.trim());
      setRestante(REENVIO_SEGUNDOS);
      // Não afirma entrega: o 202 é o mesmo exista ou não a conta.
      setAviso("Se houver uma conta com esse e-mail, um novo código foi enviado.");
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 429
          ? "Tentativas demais. Espere alguns instantes e tente de novo."
          : "Não foi possível pedir um novo código agora. Tente de novo em instantes.",
      );
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Avança para a senha nova **sem** conferir o código.
   *
   * Não é preguiça: o segredo é de uso único e só é gasto junto com a senha
   * nova (`/auth/reset-password`). Conferi-lo aqui o queimaria, e a
   * redefinição logo em seguida falharia. Por isso o botão diz "Continuar" e
   * não "Verificar código", como no mockup — anunciar uma checagem que
   * acontece um passo adiante seria a tela afirmar o que não fez.
   */
  function continuar() {
    if (codigo.length < DIGITOS) {
      setErro("Digite os 6 dígitos do código.");
      return;
    }
    limparRecados();
    setPasso("senha");
  }

  async function salvar() {
    limparRecados();
    setEnviando(true);
    try {
      await resetPassword(
        token !== null ? { token } : { email: email.trim(), code: codigo },
        senha,
      );
      tokenDoLink = null;
      setPasso("pronto");
    } catch (e) {
      const detalhe = e instanceof ApiError ? e.message : "";
      if (detalhe.includes("diferente da atual")) {
        // O segredo já foi queimado antes desta recusa: insistir aqui não
        // adianta, e a tela precisa dizer isso em vez de deixar a pessoa
        // tentando outra senha contra um código morto.
        setErroCampo("Escolha uma senha diferente da anterior.");
        setSegredoGasto(true);
      } else if (doLink) {
        setErro(CODIGO_INVALIDO);
        setSegredoGasto(true);
      } else {
        // Código digitado errado só consome uma tentativa (são 5): volta para
        // as caixas, onde também está o reenvio.
        setErro(CODIGO_INVALIDO);
        setCodigo("");
        setPasso("codigo");
      }
    } finally {
      setEnviando(false);
    }
  }

  function recomecar() {
    tokenDoLink = null;
    setToken(null);
    setCodigo("");
    setSenha("");
    setConfirma("");
    setSegredoGasto(false);
    limparRecados();
    setPasso("pedir");
  }

  const passoDoTrilho = passo === "codigo" ? 2 : passo === "senha" ? 3 : 1;

  return (
    <AuthStage
      chamada={{ antes: "A calma tem um ", destaque: "ritmo", depois: ". Acompanhe o seu." }}
      texto="Tendências e estados mentais do seu EEG de consumo, analisados no servidor WaveAI — exploratório, transparente, seu."
      chips={CHIPS}
      resumo="Tendências do seu EEG, analisadas no servidor. Exploratório."
    >
      {passo !== "pronto" ? (
        <AuthSteps atual={passoDoTrilho} accent={destaque.accent} />
      ) : null}

      {passo === "pedir" ? (
        <>
          <View style={styles.cabecalho}>
            <Text style={styles.sobrancelha}>RECUPERAR ACESSO · PASSO 1 DE 3</Text>
            <Text style={styles.titulo}>Esqueceu a senha?</Text>
            <Text style={styles.subtitulo}>
              Sem problema. Informe seu e-mail e enviaremos um código de verificação.
            </Text>
          </View>

          <Field
            label="E-mail cadastrado"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            maxLength={EMAIL_MAX}
            placeholder="voce@exemplo.com.br"
            hint={`Enviaremos um link e um código de ${DIGITOS} dígitos válidos por ${VALIDADE_MINUTOS} minutos.`}
            error={erroCampo}
          />

          <StateView error={erro} />

          <Button
            label="Enviar link e código"
            onPress={pedir}
            loading={enviando}
            accent={destaque.accent}
            largura="bloco"
          />
          <Button
            label="Voltar para o login"
            onPress={() => router.replace("/login")}
            variant="secondary"
            largura="bloco"
          />
        </>
      ) : null}

      {passo === "enviado" ? (
        <>
          <View style={styles.cabecalhoCentrado}>
            <SeloGrande icone="mail" cor={destaque.accent} />
            <Text style={[styles.sobrancelha, styles.centrado]}>
              RECUPERAR ACESSO · PASSO 1 DE 3
            </Text>
            <Text style={[styles.titulo, styles.centrado]}>Confira seu e-mail</Text>
            {/* O mockup diz "Enviamos um link e um código". A API responde
                igual exista ou não a conta (ADR-0024) — afirmar o envio aqui
                seria contar, pela tela, o que a resposta se recusa a contar. */}
            <Text style={[styles.subtitulo, styles.centrado]}>
              Se houver uma conta com esse e-mail, o link e o código de {DIGITOS} dígitos
              estão a caminho de{" "}
              <Text style={styles.email}>{mascarar(email.trim())}</Text>. Você pode abrir o
              link do e-mail ou digitar o código aqui. Vale por {VALIDADE_MINUTOS} minutos.
            </Text>
          </View>

          <Button
            label="Inserir código"
            onPress={() => setPasso("codigo")}
            accent={destaque.accent}
            largura="bloco"
          />
          <Button label="Usar outro e-mail" onPress={recomecar} variant="secondary" largura="bloco" />
          <Text style={styles.rodapeDica}>
            Não chegou? Veja a caixa de spam ou reenvie a partir da próxima tela.
          </Text>
        </>
      ) : null}

      {passo === "codigo" ? (
        <>
          <View style={styles.cabecalho}>
            <Text style={styles.sobrancelha}>RECUPERAR ACESSO · PASSO 2 DE 3</Text>
            <Text style={styles.titulo}>Verifique seu e-mail</Text>
            <Text style={styles.subtitulo}>
              Digite o código de {DIGITOS} dígitos que enviamos para{" "}
              <Text style={styles.email}>{mascarar(email.trim())}</Text>.
            </Text>
          </View>

          <CodeInput
            label="Código de recuperação"
            value={codigo}
            onChangeText={(v) => {
              setCodigo(v);
              if (erro) setErro(null);
            }}
            length={DIGITOS}
            disabled={enviando}
            error={Boolean(erro)}
            autoFocus
          />

          <View style={styles.reenvioLinha}>
            <Text style={styles.reenvio}>Não chegou? </Text>
            {restante > 0 ? (
              <Text style={styles.reenvio}>
                Reenviar em <Text style={styles.contagem}>{formatar(restante)}</Text>
              </Text>
            ) : (
              <TextLink
                label="Reenviar código"
                onPress={reenviar}
                accent={destaque.accentText}
                compacto
              />
            )}
          </View>

          <StateView error={erro} />
          {!erro && aviso ? (
            <Text style={styles.aviso} accessibilityRole="alert">
              {aviso}
            </Text>
          ) : null}

          <Button label="Continuar" onPress={continuar} accent={destaque.accent} largura="bloco" />
          <Button label="Usar outro e-mail" onPress={recomecar} variant="secondary" largura="bloco" />
        </>
      ) : null}

      {passo === "senha" ? (
        <>
          <View style={styles.cabecalho}>
            <Text style={styles.sobrancelha}>RECUPERAR ACESSO · PASSO 3 DE 3</Text>
            <Text style={styles.titulo}>Crie uma nova senha</Text>
            {/* O mockup diz "uma senha que você ainda não usou por aqui". O
                produto não guarda histórico de senhas: o que a API recusa é a
                senha **igual à atual**, e é só isso que a tela promete. */}
            <Text style={styles.subtitulo}>Escolha uma senha diferente da anterior.</Text>
          </View>

          <View>
            <Field
              label="Nova senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              revealable
              autoComplete="new-password"
              maxLength={SENHA_MAX}
              placeholder="Crie uma senha"
              error={erroCampo}
            />
            <PasswordStrength
              senha={senha}
              accent={destaque.accent}
              onAccent={destaque.onAccent}
            />
          </View>

          <View>
            <Field
              label="Confirmar nova senha"
              value={confirma}
              onChangeText={setConfirma}
              secureTextEntry
              revealable
              autoComplete="new-password"
              maxLength={SENHA_MAX}
              placeholder="Repita a senha"
            />
            <PasswordMatch
              senha={senha}
              confirmacao={confirma}
              accentText={destaque.accentText}
            />
          </View>

          <StateView error={erro} />

          {segredoGasto ? (
            <View style={styles.reenvioLinha}>
              <Text style={styles.reenvio}>
                Este {doLink ? "link" : "código"} já foi usado.{" "}
              </Text>
              <TextLink
                label={doLink ? "Pedir um novo link" : "Pedir um novo código"}
                onPress={recomecar}
                accent={destaque.accentText}
                compacto
              />
            </View>
          ) : null}

          <Button
            label="Salvar nova senha"
            onPress={salvar}
            loading={enviando}
            disabled={!podeSalvar || segredoGasto}
            accent={destaque.accent}
            largura="bloco"
          />
        </>
      ) : null}

      {passo === "pronto" ? (
        <>
          <View style={styles.cabecalhoCentrado}>
            <SeloGrande icone="check" cor={destaque.accent} />
            <Text style={[styles.sobrancelha, styles.centrado]}>RECUPERAR ACESSO</Text>
            <Text style={[styles.titulo, styles.centrado]}>Senha atualizada</Text>
            <Text style={[styles.subtitulo, styles.centrado]}>
              Tudo certo. Entre com a sua nova senha — as sessões que estavam abertas
              foram encerradas.
            </Text>
          </View>

          <Button
            label="Voltar para o login"
            onPress={() => router.replace("/login")}
            accent={destaque.accent}
            largura="bloco"
          />
        </>
      ) : null}
    </AuthStage>
  );
}

/** O `.big-ic` do design: selo de 72px com o anel que respira. */
function SeloGrande({ icone, cor }: { icone: IconName; cor: string }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const parado = useReduzirMovimento();
  const pulso = useSharedValue(0);

  useEffect(() => {
    if (parado) return;
    pulso.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [parado, pulso]);

  const respirar = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulso.value),
    transform: [{ scale: 1 + pulso.value * 0.28 }],
  }));

  return (
    <View style={[styles.selo, { backgroundColor: withAlpha(cor, 0.14) }]} aria-hidden>
      <Animated.View
        style={[styles.seloAnel, { borderColor: cor }, parado ? { opacity: 0.4 } : respirar]}
      />
      <Icon name={icone} size={30} color={cor} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cabecalho: {
      gap: t.spacing.xs,
      marginBottom: t.spacing.sm,
    },
    cabecalhoCentrado: {
      alignItems: "center",
      gap: t.spacing.xs,
      marginBottom: t.spacing.sm,
    },
    selo: {
      alignItems: "center",
      borderRadius: 36,
      height: 72,
      justifyContent: "center",
      marginBottom: t.spacing.sm,
      width: 72,
    },
    seloAnel: {
      borderRadius: 38,
      borderWidth: 2,
      bottom: -2,
      left: -2,
      position: "absolute",
      right: -2,
      top: -2,
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
    centrado: {
      textAlign: "center",
    },
    email: {
      color: t.colors.text,
      fontWeight: "600",
    },
    reenvioLinha: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
    },
    reenvio: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 13,
    },
    contagem: {
      color: t.colors.textMuted,
      fontVariant: ["tabular-nums"],
    },
    aviso: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      textAlign: "center",
    },
    rodapeDica: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 12,
      textAlign: "center",
    },
  });
