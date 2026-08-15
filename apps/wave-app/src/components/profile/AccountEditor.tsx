import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  ApiError,
  changePassword,
  confirmEmailChange,
  requestEmailChange,
  updateDisplayName,
} from "../../auth/api";
import { useAuth } from "../../auth/AuthContext";
import { useRoleAccent, useTheme, type Theme } from "../../theme";
import { Button } from "../Button";
import { CodeInput } from "../CodeInput";
import { Field } from "../Field";
import {
  PasswordStrength,
  SENHA_MAX,
  avaliarSenha,
  senhaValida,
} from "../PasswordStrength";
import { Panel } from "../Panel";

/** Teto do nome no servidor (`UpdateMeRequest`). */
const NOME_MAX = 120;
/** Mesmo teto da coluna `users.email`. */
const EMAIL_MAX = 254;

/**
 * Edição da própria conta — nome, e-mail e senha.
 *
 * **Existia como leitura** porque, no porte, as rotas ainda não estavam de pé;
 * elas existem desde a P12 (`PATCH /auth/me`, `POST /auth/password`,
 * `POST /auth/email` + `/auth/email/confirm`) e o perfil seguia mostrando
 * campos mortos.
 *
 * Serve aos dois papéis: paciente e profissional têm o mesmo painel de conta, e
 * duplicá-lo garantiria que divergissem na primeira correção.
 */
export function AccountEditor() {
  const { user, recarregarUsuario } = useAuth();
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [nome, setNome] = useState(user?.display_name ?? "");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [nomeSalvo, setNomeSalvo] = useState(false);

  const [etapa, setEtapa] = useState<"pedir" | "confirmar">("pedir");
  const [novoEmail, setNovoEmail] = useState("");
  const [senhaParaEmail, setSenhaParaEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pedindoEmail, setPedindoEmail] = useState(false);
  const [confirmandoEmail, setConfirmandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [emailTrocado, setEmailTrocado] = useState(false);

  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaTrocada, setSenhaTrocada] = useState(false);

  const nomeMudou = nome.trim() !== (user?.display_name ?? "").trim();
  const forca = avaliarSenha(nova);
  const podeTrocarSenha =
    atual.length > 0 && senhaValida(forca) && nova === confirma && !trocandoSenha;

  async function salvarNome() {
    setSalvandoNome(true);
    setErroNome(null);
    setNomeSalvo(false);
    try {
      await updateDisplayName(nome.trim());
      // O contexto guarda o usuário; sem reler, o cabeçalho do perfil e a
      // saudação seguiriam com o nome antigo até o próximo carregamento.
      await recarregarUsuario();
      setNomeSalvo(true);
    } catch (e) {
      setErroNome(
        e instanceof ApiError && e.status === 422
          ? "Escolha um nome entre 1 e 120 caracteres."
          : "Não foi possível salvar o nome agora. Tente de novo.",
      );
    } finally {
      setSalvandoNome(false);
    }
  }

  async function pedirTrocaDeEmail() {
    setPedindoEmail(true);
    setErroEmail(null);
    setEmailTrocado(false);
    try {
      await requestEmailChange(senhaParaEmail, novoEmail.trim());
      setSenhaParaEmail("");
      setEtapa("confirmar");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setErroEmail("A senha atual não confere.");
      } else if (e instanceof ApiError && e.status === 429) {
        setErroEmail("Você pediu isso há pouco. Espere alguns instantes e tente de novo.");
      } else if (e instanceof ApiError && e.status === 400) {
        // O servidor é específico só neste caso, e pode ser: pedir o próprio
        // endereço não revela nada sobre terceiros.
        setErroEmail("Este já é o e-mail da sua conta.");
      } else {
        setErroEmail("Não foi possível pedir a troca agora. Tente de novo.");
      }
    } finally {
      setPedindoEmail(false);
    }
  }

  async function confirmarTrocaDeEmail() {
    setConfirmandoEmail(true);
    setErroEmail(null);
    try {
      await confirmEmailChange(codigo);
      // O e-mail alimenta o cabeçalho do perfil e o login; sem reler, a tela
      // seguiria mostrando o endereço antigo.
      await recarregarUsuario();
      setEtapa("pedir");
      setNovoEmail("");
      setCodigo("");
      setEmailTrocado(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Aqui o servidor pode ser específico: quem digitou o código controla
        // a caixa, e o token só foi emitido porque o endereço estava livre.
        setErroEmail("Este endereço ficou indisponível. Peça a troca de novo com outro e-mail.");
      } else {
        setErroEmail("Código inválido ou expirado.");
      }
    } finally {
      setConfirmandoEmail(false);
    }
  }

  async function trocarSenha() {
    setTrocandoSenha(true);
    setErroSenha(null);
    setSenhaTrocada(false);
    try {
      await changePassword(atual, nova);
      setAtual("");
      setNova("");
      setConfirma("");
      setSenhaTrocada(true);
    } catch (e) {
      // O 429 não é erro de sistema: é o servidor dizendo que houve tentativa
      // demais. Sem contar isso, o botão parece quebrado — o mesmo cuidado que
      // o reenvio de convite já tinha.
      if (e instanceof ApiError && e.status === 429) {
        setErroSenha("Tentativas demais. Espere alguns instantes e tente de novo.");
      } else if (e instanceof ApiError && e.status === 401) {
        setErroSenha("A senha atual não confere.");
      } else {
        setErroSenha("Não foi possível trocar a senha agora. Tente de novo.");
      }
    } finally {
      setTrocandoSenha(false);
    }
  }

  return (
    <>
      <Panel title="Dados da conta" eyebrow="identificação">
        <Field
          label="Nome"
          value={nome}
          onChangeText={(v) => {
            setNome(v);
            setNomeSalvo(false);
          }}
          maxLength={NOME_MAX}
          autoCapitalize="words"
          autoComplete="name"
          error={erroNome}
          accent={papel.accent}
        />

        <View style={styles.emailLinha}>
          <Text style={styles.emailRotulo}>E-mail</Text>
          <Text style={styles.emailValor}>{user?.email ?? "—"}</Text>
        </View>

        <View style={styles.acao}>
          <Button
            label="Salvar nome"
            onPress={salvarNome}
            loading={salvandoNome}
            disabled={!nomeMudou || nome.trim().length === 0}
            accent={papel.accent}
          />
        </View>
        {nomeSalvo ? <Text style={styles.recibo}>Nome atualizado.</Text> : null}
      </Panel>

      {/**
       * Troca de e-mail, em dois passos **dentro do painel**.
       *
       * Sem rota própria de propósito: são dois campos e um código, e sair do
       * perfil para voltar depois é mais navegação do que o fluxo merece.
       *
       * A cópia é o cuidado principal aqui, e ela obedece duas regras que
       * apontam para o mesmo lugar: **anti-enumeração** (ADR-0024) impede dizer
       * "este e-mail já está em uso" — o servidor responde igual com o endereço
       * livre ou ocupado —, e **honestidade visual** (ADR-0027) impede afirmar
       * entrega: nós entregamos ao provedor, não à caixa de ninguém. Daí o
       * condicional, que é verdadeiro nos dois ramos.
       */}
      <Panel title="Trocar e-mail" eyebrow="dois passos">
        {etapa === "pedir" ? (
          <>
            <Text style={styles.nota}>
              O código vai para o endereço novo — é ele que precisa provar posse. Seu
              e-mail atual recebe um aviso de que a troca foi pedida.
            </Text>
            <Field
              label="Novo e-mail"
              value={novoEmail}
              onChangeText={setNovoEmail}
              keyboardType="email-address"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              placeholder="voce@exemplo.com.br"
              accent={papel.accent}
            />
            <Field
              label="Sua senha atual"
              value={senhaParaEmail}
              onChangeText={setSenhaParaEmail}
              secureTextEntry
              revealable
              autoComplete="current-password"
              maxLength={SENHA_MAX}
              hint="O e-mail é o canal de recuperação: quem o troca leva a conta junto."
              accent={papel.accent}
            />
            {erroEmail ? (
              <Text style={styles.erro} accessibilityRole="alert">
                {erroEmail}
              </Text>
            ) : null}
            <View style={styles.acao}>
              <Button
                label="Enviar código"
                onPress={pedirTrocaDeEmail}
                loading={pedindoEmail}
                disabled={
                  pedindoEmail ||
                  senhaParaEmail.length === 0 ||
                  !novoEmail.includes("@")
                }
                accent={papel.accent}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.nota}>
              Se o endereço estiver livre, o código chega nele em instantes. Avisamos
              também o seu e-mail atual.
            </Text>
            <CodeInput
              value={codigo}
              onChangeText={(v) => {
                setCodigo(v);
                setErroEmail(null);
              }}
              label={`Código enviado para ${novoEmail}`}
              error={Boolean(erroEmail)}
              disabled={confirmandoEmail}
            />
            <Text style={styles.nota}>O código vale por 10 minutos.</Text>
            {erroEmail ? (
              <Text style={styles.erro} accessibilityRole="alert">
                {erroEmail}
              </Text>
            ) : null}
            <View style={styles.acaoLinha}>
              <Button
                label="Confirmar troca"
                onPress={confirmarTrocaDeEmail}
                loading={confirmandoEmail}
                disabled={codigo.length < 6 || confirmandoEmail}
                accent={papel.accent}
              />
              <Button
                label="Cancelar"
                onPress={() => {
                  setEtapa("pedir");
                  setCodigo("");
                  setErroEmail(null);
                }}
                variant="secondary"
              />
            </View>
          </>
        )}
        {emailTrocado ? (
          <Text style={styles.recibo}>
            E-mail atualizado. Ele passa a ser o seu login.
          </Text>
        ) : null}
      </Panel>

      <Panel title="Senha" eyebrow="acesso">
        <Field
          label="Senha atual"
          value={atual}
          onChangeText={setAtual}
          secureTextEntry
          revealable
          autoComplete="current-password"
          maxLength={SENHA_MAX}
          accent={papel.accent}
        />
        <Field
          label="Nova senha"
          value={nova}
          onChangeText={setNova}
          secureTextEntry
          revealable
          autoComplete="new-password"
          maxLength={SENHA_MAX}
          accent={papel.accent}
        />
        <PasswordStrength
          senha={nova}
          accent={papel.accent}
          onAccent={papel.onAccent}
        />
        <Field
          label="Repita a nova senha"
          value={confirma}
          onChangeText={setConfirma}
          secureTextEntry
          revealable
          autoComplete="new-password"
          maxLength={SENHA_MAX}
          error={
            confirma.length > 0 && confirma !== nova ? "As senhas não coincidem." : null
          }
          accent={papel.accent}
        />

        <Text style={styles.nota}>
          Trocar a senha encerra as outras sessões abertas. Esta continua valendo.
        </Text>

        {erroSenha ? (
          <Text style={styles.erro} accessibilityRole="alert">
            {erroSenha}
          </Text>
        ) : null}

        <View style={styles.acao}>
          <Button
            label="Trocar senha"
            onPress={trocarSenha}
            loading={trocandoSenha}
            disabled={!podeTrocarSenha}
            accent={papel.accent}
          />
        </View>
        {senhaTrocada ? <Text style={styles.recibo}>Senha atualizada.</Text> : null}
      </Panel>
    </>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    emailLinha: {
      gap: 2,
    },
    emailRotulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    emailValor: {
      ...t.typography.body,
      color: t.colors.text,
    },
    acao: {
      alignItems: "flex-start",
      marginTop: t.spacing.xs,
    },
    acaoLinha: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
      fontSize: 13,
    },
    recibo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
  });
