import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ApiError } from "../src/auth/api";
import { useAuth } from "../src/auth/AuthContext";
import { AuthStage } from "../src/components/auth/AuthStage";
import { AuthSteps } from "../src/components/auth/AuthSteps";
import { Button } from "../src/components/Button";
import { CodeInput } from "../src/components/CodeInput";
import { Icon, type IconName } from "../src/components/Icon";
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
 * Verificar e-mail — passos 2 e 3 de `Design/round1/criar-conta.html`
 * (`#view-verify` e `#view-done`), que no mockup são views da mesma página.
 *
 * Aqui são **um passo de estado**, não duas rotas: do "Tudo pronto!" não há
 * para onde voltar. O passo 1 continua sendo `/register`.
 *
 * **Duas portas chegam nesta tela** (ADR-0044): o cadastro recém-feito e o
 * login que recebeu 403 "e-mail nao verificado". Em ambos os casos o e-mail
 * pendente vem da memória do `AuthContext` — nunca da URL.
 */

/** O que a API valida (`VERIFICATION_CODE_DIGITS`). */
const DIGITOS = 6;
/** Espelha `verification_resend_cooldown_seconds` da API, que é quem manda. */
const REENVIO_SEGUNDOS = 60;
/** `single_use_token_ttl_minutes`, o que o design promete na tela. */
const VALIDADE_MINUTOS = 10;

const CHIPS = ["você convida", "você pode revogar", "dados seus"];

/**
 * Esconde o miolo do endereço, como o mockup (`vo•••@exemplo.com.br`).
 *
 * Quem acabou de digitar o e-mail não ganha nada com isso; quem chegou pelo
 * login numa tela compartilhada, sim. E a máscara é a mesma para todo mundo,
 * então não conta nada sobre a conta existir ou não.
 */
function mascarar(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return email;
  const visivel = local.slice(0, local.length > 2 ? 2 : 1);
  return `${visivel}•••@${dominio}`;
}

/** `00:59` — a contagem do mockup, com dígitos de largura fixa. */
function formatar(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VerifyEmailScreen() {
  const {
    verificacaoPendente,
    verificarEmail,
    reenviarVerificacao,
    concluirVerificacao,
    cancelarVerificacao,
  } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const destaque = useAccentFor(verificacaoPendente?.role === "doctor" ? "doctor" : "patient");

  const [passo, setPasso] = useState<"verificar" | "pronto">("verificar");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [restante, setRestante] = useState(REENVIO_SEGUNDOS);

  // Vindo do login, a pessoa não está criando conta agora: o trilho "passo 2 de
  // 3" e a ressalva "se este e-mail ainda não tinha conta" seriam falsos. E ali
  // o produto **pode** afirmar o envio, porque o 403 já contou (a quem acertou
  // a senha) que a conta existe e está por verificar.
  const doCadastro = verificacaoPendente?.origem !== "login";

  // Sem pendência não há o que verificar: é o caso de quem recarregou a página
  // no meio do passo 2 ou abriu a rota direto. O login é a porta de volta.
  const semPendencia = !verificacaoPendente && passo === "verificar";
  useEffect(() => {
    if (semPendencia) router.replace("/login");
  }, [semPendencia, router]);

  // Cada segundo agenda o próximo: um `setInterval` sobreviveria ao reenvio e
  // passaria a descontar dois segundos por vez.
  useEffect(() => {
    if (restante <= 0) return;
    const id = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restante]);

  if (semPendencia) return null;

  async function verificar() {
    if (codigo.length < DIGITOS) {
      setErro("Digite os 6 dígitos do código.");
      return;
    }
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      await verificarEmail(codigo);
      setPasso("pronto");
    } catch {
      // Recusa única (ADR-0024): a API não distingue código errado, expirado,
      // já usado e e-mail sem conta — e a tela não pode inventar a diferença.
      // O código também queima após 5 tentativas, daí a saída pelo reenvio.
      setErro("Código inválido ou expirado. Confira os dígitos ou peça um novo código.");
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      await reenviarVerificacao();
      setRestante(REENVIO_SEGUNDOS);
      // Não afirma entrega: o 202 é o mesmo exista ou não cadastro à espera.
      setAviso("Se ainda houver um cadastro à espera desse e-mail, um novo código foi enviado.");
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

  async function entrar() {
    setEnviando(true);
    const entrou = await concluirVerificacao();
    setEnviando(false);
    // Deu certo: a guarda de rota leva para a área do papel. Não deu (chegou
    // pelo login, ou a senha mudou no meio do caminho): entra pela porta normal.
    if (!entrou) router.replace("/login");
  }

  function trocarEmail() {
    cancelarVerificacao();
    router.replace("/register");
  }

  function voltarAoLogin() {
    cancelarVerificacao();
    router.replace("/login");
  }

  return (
    <AuthStage
      chamada={{ antes: "Sua onda, suas ", destaque: "regras", depois: "." }}
      texto="Você decide quem acompanha seu bem-estar: convida, autoriza e revoga quando quiser. Tudo exploratório — nada de laudos."
      chips={CHIPS}
      resumo="Sua onda, suas regras. Você convida, autoriza e revoga."
      larguraCartao={420}
    >
      {passo === "verificar" ? (
        <>
          {doCadastro ? <AuthSteps atual={2} accent={destaque.accent} /> : null}

          <View style={styles.cabecalho}>
            <SeloGrande icone="mail" cor={destaque.accent} />
            <Text style={styles.sobrancelha}>
              {doCadastro ? "CRIAR CONTA · PASSO 2 DE 3" : "VERIFICAR E-MAIL"}
            </Text>
            <Text style={styles.titulo}>Verifique seu e-mail</Text>
            {/* O mockup afirma "Enviamos um código para X". No cadastro isso
                seria dizer o que o produto não sabe: a resposta é uniforme
                (ADR-0024) e, se o e-mail já tinha dono, código nenhum foi
                emitido — quem foi avisada da tentativa foi a dona do endereço. */}
            <Text style={styles.subtitulo}>
              {doCadastro ? "Se este e-mail ainda não tinha conta, um" : "Digite o"} código
              de {DIGITOS} dígitos {doCadastro ? "está a caminho de" : "que enviamos para"}{" "}
              <Text style={styles.email}>
                {mascarar(verificacaoPendente?.email ?? "")}
              </Text>
              .{" "}
              {doCadastro
                ? `Ele vale por ${VALIDADE_MINUTOS} minutos.`
                : `Ele vale por ${VALIDADE_MINUTOS} minutos — se já passou disso, peça um novo.`}
            </Text>
          </View>

          <CodeInput
            label="Código de verificação"
            value={codigo}
            onChangeText={(v) => {
              setCodigo(v);
              if (erro) setErro(null);
            }}
            length={DIGITOS}
            onComplete={() => setErro(null)}
            disabled={enviando}
            error={Boolean(erro)}
            autoFocus
          />

          {/* Linha em `View`, não em `Text`: o `TextLink` é um `Pressable`, e
              no nativo um `View` dentro de `Text` não renderiza. */}
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

          <Button
            label="Verificar e-mail"
            onPress={verificar}
            loading={enviando}
            accent={destaque.accent}
            largura="bloco"
          />
          <Button
            label={doCadastro ? "Usar outro e-mail" : "Voltar ao login"}
            onPress={doCadastro ? trocarEmail : voltarAoLogin}
            variant="secondary"
            largura="bloco"
          />

          {doCadastro ? (
            <View style={styles.alternativa}>
              {/* Saída para quem digitou um e-mail que já era dela: o código
                  nunca vai chegar, e a tela não pode dizer por quê. Aparece
                  para todo mundo, então não entrega nada. */}
              <Text style={styles.alternativaTexto}>Já tem conta com esse e-mail? </Text>
              <TextLink
                label="Entrar"
                onPress={voltarAoLogin}
                accent={destaque.accentText}
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          {doCadastro ? <AuthSteps atual={3} accent={destaque.accent} /> : null}

          <View style={styles.cabecalho}>
            <SeloGrande icone="check" cor={destaque.accent} />
            <Text style={styles.sobrancelha}>
              {doCadastro ? "CRIAR CONTA · PASSO 3 DE 3" : "E-MAIL VERIFICADO"}
            </Text>
            <Text style={styles.titulo}>Tudo pronto!</Text>
            <Text style={styles.subtitulo}>
              Sua conta foi verificada. Sua primeira onda está a poucos minutos de
              distância.
            </Text>
          </View>

          <Button
            label="Entrar no WaveAI"
            onPress={entrar}
            loading={enviando}
            accent={destaque.accent}
            largura="bloco"
          />
        </>
      )}
    </AuthStage>
  );
}

/**
 * Selo redondo de 72px com o anel que respira — o `.big-ic` do design.
 *
 * Componente à parte porque o anel tem estado de animação próprio, e hook não
 * pode nascer dentro de uma condicional de render.
 */
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

  // `@keyframes bigh`: o anel cresce até 1,28 enquanto some.
  const respirar = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulso.value),
    transform: [{ scale: 1 + pulso.value * 0.28 }],
  }));

  return (
    <View style={[styles.selo, { backgroundColor: withAlpha(cor, 0.14) }]} aria-hidden>
      <Animated.View
        style={[
          styles.seloAnel,
          { borderColor: cor },
          parado ? { opacity: 0.4 } : respirar,
        ]}
      />
      <Icon name={icone} size={30} color={cor} />
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cabecalho: {
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
      // `inset:-2px` do mockup: o anel abraça o selo por fora.
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
      textAlign: "center",
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: "center",
    },
    subtitulo: {
      ...t.typography.body,
      color: t.colors.textMuted,
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
      textAlign: "center",
    },
    contagem: {
      color: t.colors.textMuted,
      // Sem isto o texto dança a cada segundo, porque os dígitos têm larguras
      // diferentes na fonte do sistema.
      fontVariant: ["tabular-nums"],
    },
    aviso: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      textAlign: "center",
    },
    alternativa: {
      alignItems: "center",
      borderTopColor: t.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      paddingTop: t.spacing.md,
    },
    alternativaTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
  });
