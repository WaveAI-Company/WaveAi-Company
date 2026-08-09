import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { inviteCareLink, listCareLinks, revokeCareLink, type CareLink } from "../../src/api/care";
import { Avatar } from "../../src/components/Avatar";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { Field } from "../../src/components/Field";
import { Icon } from "../../src/components/Icon";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Skeleton } from "../../src/components/Skeleton";
import {
  bp,
  useRoleAccent,
  useTheme,
  withAlpha,
  type Theme,
} from "../../src/theme";

/** A partir daqui o formulário e o painel lateral ficam lado a lado. */
// `.inv-grid` do mockup: `1.25fr 1fr`, empilhando em 960.
/** Janela da lista "Convites enviados", como no design. */
const DIAS_RECENTES = 30;

// Formato só para feedback rápido no cliente; a API (EmailStr) é a autoridade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diasDesde(iso: string, agora: Date): number {
  return Math.floor((agora.getTime() - new Date(iso).getTime()) / 86_400_000);
}

/** "há 5 dias" para o recente, data seca para o resto. */
function quando(iso: string, agora: Date): string {
  const dias = diasDesde(iso, agora);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias <= 14) return `há ${dias} dias`;
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/**
 * Convidar uma pessoa — porte de `Design/round1/convidar.html` (ADR-0024/0042).
 *
 * O convite **não concede acesso**: nasce `pending` e espera o aceite. A
 * confirmação é sempre a mesma, exista ou não a conta — o backend não revela
 * quem tem WaveAI (anti-enumeração), então esta tela também não afirma que "o
 * convite foi entregue", só que **foi registrado**.
 */
export default function DoctorInviteScreen() {
  const t = useTheme();
  const router = useRouter();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const emColunas = useWindowDimensions().width > bp.duasColunas;

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** E-mail do último envio — marca a passagem para a tela de confirmação. */
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  const [vinculos, setVinculos] = useState<CareLink[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setVinculos(await listCareLinks());
    } catch {
      // Lista é secundária; a falha não deve travar o envio de convites.
      setVinculos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const convidar = useCallback(async () => {
    const alvo = email.trim();
    if (!EMAIL_RE.test(alvo)) {
      setErro("Digite um e-mail válido.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await inviteCareLink(alvo);
      setEnviadoPara(alvo);
      setEmail("");
      await carregar();
    } catch {
      setErro("Não foi possível registrar o convite. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }, [email, carregar]);

  const cancelar = useCallback(async (id: string) => {
    setCancelando(id);
    try {
      await revokeCareLink(id);
      setVinculos((atual) => atual.filter((v) => v.id !== id));
    } catch {
      setErro("Não foi possível cancelar o convite. Tente de novo.");
    } finally {
      setCancelando(null);
    }
  }, []);

  const agora = new Date();
  const recentes = vinculos
    .filter((v) => v.status === "pending" || v.status === "active")
    .filter((v) => diasDesde(v.created_at, agora) <= DIAS_RECENTES)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const formulario = (
    <Panel title="Por e-mail" eyebrow="registrado no servidor">
      <Field
        label="E-mail da pessoa"
        value={email}
        onChangeText={(texto) => {
          setEmail(texto);
          if (erro) setErro(null);
        }}
        placeholder="pessoa@exemplo.com.br"
        keyboardType="email-address"
        autoComplete="email"
        editable={!enviando}
        error={erro}
      />
      <View style={styles.acao}>
        <Button label="Enviar convite" onPress={convidar} loading={enviando} />
      </View>
    </Panel>
  );

  const confirmacao = (
    <Panel>
      <View style={styles.enviado}>
        <View style={[styles.selo, { backgroundColor: withAlpha(accent, 0.14) }]}>
          <Icon name="mail" size={30} color={accent} strokeWidth={1.7} />
        </View>
        <Text style={styles.enviadoTitulo}>Convite registrado</Text>
        {/* Deliberadamente NÃO diz "enviamos para fulano": a API responde igual
            exista ou não a conta, para não virar um oráculo de quem tem WaveAI
            (ADR-0024). Afirmar entrega aqui contradiria essa proteção. */}
        <Text style={styles.enviadoTexto}>
          Registramos o pedido para <Text style={styles.forte}>{enviadoPara}</Text>. Se
          houver uma conta com esse e-mail, o convite aparece para a pessoa aceitar — e o
          acompanhamento só começa se ela aceitar.
        </Text>
        <View style={styles.enviadoAcoes}>
          <View style={styles.enviadoBotao}>
            <Button
              label="Enviar outro convite"
              onPress={() => setEnviadoPara(null)}
              variant="secondary"
            />
          </View>
          <View style={styles.enviadoBotao}>
            <Button label="Voltar ao início" onPress={() => router.push("/doctor")} />
          </View>
        </View>
      </View>
    </Panel>
  );

  return (
    <ScreenContainer largura="lista">
      <View style={styles.topo}>
        <Text style={styles.titulo}>Convidar uma pessoa</Text>
        <Text style={styles.lead}>
          O convite é só o primeiro passo: o acompanhamento começa apenas quando a pessoa
          aceitar — e ela pode revogar o acesso a qualquer momento, com efeito imediato.
        </Text>
      </View>

      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        {/* ============ coluna principal ============ */}
        <View style={styles.coluna}>{enviadoPara ? confirmacao : formulario}</View>

        {/* ============ coluna lateral ============ */}
        <View style={styles.coluna}>
          <Panel
            title="O que a pessoa autoriza"
            headerAccessory={<Chip label="leitura · nunca edição" />}
          >
            {[
              "Tendências e composição por banda ao longo das sessões.",
              "Resumos em texto — sempre exploratórios, nunca laudo.",
              "Autorrelatos que ela escrever nas sessões.",
              "Acompanhar uma sessão ao vivo, pela mesma autorização e com o acesso registrado.",
            ].map((item) => (
              <View key={item} style={styles.item}>
                <View style={[styles.marcador, { backgroundColor: accent }]} />
                <Text style={styles.itemTexto}>{item}</Text>
              </View>
            ))}
            <Text style={styles.nota}>
              Você nunca vê o sinal bruto da sessão nem edita nada, e cada leitura fica
              registrada em trilha de acesso. A pessoa pode revogar tudo quando quiser.
            </Text>
          </Panel>

          <Panel title="Convites enviados" eyebrow={`últimos ${DIAS_RECENTES} dias`}>
            {carregando ? (
              <View style={styles.linha}>
                <Skeleton width={40} height={40} radius={20} />
                <View style={styles.linhaTextos}>
                  <Skeleton width="55%" height={15} />
                  <Skeleton width="35%" height={11} />
                </View>
              </View>
            ) : null}

            {!carregando && recentes.length === 0 ? (
              <Text style={styles.nota}>
                Nenhum convite nos últimos {DIAS_RECENTES} dias.
              </Text>
            ) : null}

            {!carregando
              ? recentes.map((v) => {
                  const aceito = v.status === "active";
                  return (
                    <View key={v.id} style={styles.linha}>
                      <Avatar
                        name={v.counterpart_display_name}
                        size={40}
                        tone={aceito ? accent : t.colors.textMuted}
                      />
                      <View style={styles.linhaTextos}>
                        <Text style={styles.linhaNome} numberOfLines={1}>
                          {v.counterpart_display_name ?? "Convite enviado"}
                        </Text>
                        <Text style={styles.linhaNota}>
                          {quando(v.created_at, agora)}
                        </Text>
                      </View>
                      {aceito ? (
                        <View style={styles.aceito}>
                          <Icon name="check" size={13} color={accent} strokeWidth={2.6} />
                          <Text style={[styles.aceitoTexto, { color: accent }]}>aceito</Text>
                        </View>
                      ) : (
                        <>
                          <Chip label="pendente" />
                          <View style={styles.linhaAcao}>
                            <Button
                              label="Cancelar"
                              onPress={() => cancelar(v.id)}
                              loading={cancelando === v.id}
                              variant="secondary"
                            />
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              : null}
          </Panel>
        </View>
      </View>

      <Disclaimer variant="profissional" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    topo: {
      gap: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    titulo: {
      ...t.typography.display,
      color: t.colors.text,
    },
    lead: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 620,
    },
    grade: {
      gap: t.spacing.lg,
    },
    gradeLinha: {
      alignItems: "flex-start",
      flexDirection: "row",
    },
    coluna: {
      flex: 1,
      gap: t.spacing.md,
      minWidth: 0,
    },
    acao: {
      alignSelf: "flex-start",
      marginTop: t.spacing.xs,
      minWidth: 200,
    },
    enviado: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
    },
    selo: {
      alignItems: "center",
      borderRadius: 32,
      height: 64,
      justifyContent: "center",
      marginBottom: t.spacing.xs,
      width: 64,
    },
    enviadoTitulo: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: "center",
    },
    enviadoTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 420,
      textAlign: "center",
    },
    forte: {
      color: t.colors.text,
      fontWeight: "700",
    },
    enviadoAcoes: {
      alignSelf: "stretch",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      justifyContent: "center",
      marginTop: t.spacing.md,
    },
    enviadoBotao: {
      flexBasis: 190,
      flexGrow: 1,
      maxWidth: 260,
      minWidth: 0,
    },
    item: {
      flexDirection: "row",
      gap: t.spacing.sm + 4,
    },
    marcador: {
      borderRadius: 3,
      height: 6,
      marginTop: 8,
      width: 6,
    },
    itemTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 21,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
      marginTop: t.spacing.xs,
    },
    linha: {
      alignItems: "center",
      borderTopColor: t.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
    },
    linhaTextos: {
      flex: 1,
      gap: 2,
      minWidth: 110,
    },
    linhaNome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontSize: 14,
    },
    linhaNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
    linhaAcao: {
      flexBasis: 150,
      flexGrow: 1,
      minWidth: 0,
    },
    aceito: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    aceitoTexto: {
      ...t.typography.caption,
      fontWeight: "700",
    },
  });
