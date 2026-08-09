import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  acceptCareLink,
  declineCareLink,
  listPendingInvites,
  type CareLink,
} from "../../src/api/care";
import { Avatar } from "../../src/components/Avatar";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { Skeleton } from "../../src/components/Skeleton";
import { WaveField } from "../../src/components/brand/WaveField";
import { useAccentFor, useRoleAccent, useTheme, type Theme } from "../../src/theme";

/**
 * O que o aceite concede, em palavras da pessoa que aceita.
 *
 * Não é enfeite: é a lista que torna o consentimento **informado** (ADR-0024).
 * A sessão ao vivo entra porque o CareLink ativo é exatamente o que autoriza o
 * profissional a assistir (ADR-0039) — o mockup dizia que isso seria um aceite
 * à parte, e não é.
 */
const ESCOPO = [
  "tendências",
  "resumos exploratórios",
  "seus autorrelatos",
  "a sessão ao vivo, enquanto você capta",
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "enviado ontem", "enviado há 3 dias" — e a data seca quando já é antigo. */
function enviadoEm(iso: string, agora: Date): string {
  const d = new Date(iso);
  const dias = Math.floor((agora.getTime() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "enviado hoje";
  if (dias === 1) return "enviado ontem";
  if (dias <= 30) return `enviado há ${dias} dias`;
  return `enviado em ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Caixa de convites do paciente — porte de `Design/round1/convites.html`
 * (ADR-0024/0042).
 *
 * O aceite aqui é **o ato de consentimento** que leva o vínculo a `active` e dá
 * ao profissional acesso aos dados. Recusar o encerra (`declined`) sem conceder
 * nada. A invariante é enforçada no backend; esta tela é a porta desse
 * consentimento — por isso ela diz, antes do botão, o que o aceite concede.
 *
 * Todo convite pendente vem de um profissional: quando é o paciente quem
 * convida, o vínculo já **nasce ativo** (o próprio ato dele é o consentimento —
 * ver `solicitar_vinculo` na API), então nunca cai nesta lista.
 */
export default function PatientInvitesScreen() {
  const t = useTheme();
  const router = useRouter();
  const papel = useRoleAccent();
  const profissional = useAccentFor("doctor");
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [convites, setConvites] = useState<CareLink[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  //: id do convite em processamento, para desabilitar só os botões dele.
  const [emAcao, setEmAcao] = useState<string | null>(null);
  /** Aceitos nesta visita — o cartão fica, virado em recibo. */
  const [aceitos, setAceitos] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setConvites(await listPendingInvites());
      setAceitos([]);
    } catch {
      setErro("Não foi possível carregar seus convites.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const responder = useCallback(async (id: string, acao: "aceitar" | "recusar") => {
    setEmAcao(id);
    setErro(null);
    try {
      if (acao === "aceitar") {
        await acceptCareLink(id);
        // Fica à vista como recibo do que acabou de ser autorizado; some no
        // próximo carregamento, quando já não é notícia.
        setAceitos((atual) => [...atual, id]);
      } else {
        await declineCareLink(id);
        // Recusar não concede nada e não deixa rastro para a pessoa: sai.
        setConvites((atual) => atual.filter((c) => c.id !== id));
      }
    } catch {
      setErro("Não foi possível responder ao convite. Tente de novo.");
    } finally {
      setEmAcao(null);
    }
  }, []);

  const agora = new Date();
  const pendentes = convites.filter((c) => !aceitos.includes(c.id));

  return (
    <ScreenContainer largura="lista">
      <ScreenHeading
        title="Convites para te acompanhar"
        lead="Profissionais de bem-estar pediram para acompanhar suas tendências. Aceitar é opcional — e você pode revogar o acesso a qualquer momento, com efeito imediato."
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {carregando ? (
        <Panel>
          <View style={styles.cabeca}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={styles.cabecaTextos}>
              <Skeleton width="50%" height={17} />
              <Skeleton width="70%" height={12} />
            </View>
          </View>
          <Skeleton width="100%" height={60} radius={t.radius.md} />
          <Skeleton width={220} height={44} radius={t.radius.md} />
        </Panel>
      ) : null}

      {convites.map((convite) => {
        const aceito = aceitos.includes(convite.id);
        return (
          <Panel key={convite.id}>
            <View style={styles.cabeca}>
              <Avatar
                name={convite.counterpart_display_name}
                size={48}
                tone={profissional.accentText}
              />
              <View style={styles.cabecaTextos}>
                <Text style={styles.nome}>
                  {convite.counterpart_display_name ?? "Profissional de bem-estar"}
                </Text>
                <Text style={styles.papel}>profissional de bem-estar</Text>
              </View>
              <Chip label={enviadoEm(convite.created_at, agora)} />
            </View>

            {aceito ? (
              <View style={styles.recibo}>
                <Chip
                  label="acesso autorizado agora"
                  variant="estado"
                  accent={papel.accent}
                  icon={<Icon name="check" size={13} color={papel.accent} strokeWidth={2.6} />}
                />
                <NavAction
                  label="Gerenciar em “Quem me acompanha”"
                  tone="neutral"
                  onPress={() => router.push("/patient/profile")}
                />
              </View>
            ) : (
              <>
                <View style={styles.escopo}>
                  <Text style={styles.escopoTitulo}>
                    Se você aceitar, esta pessoa passa a ver (somente leitura):
                  </Text>
                  <View style={styles.escopoChips}>
                    {ESCOPO.map((item) => (
                      <Chip key={item} label={item} dot />
                    ))}
                  </View>
                </View>

                <View style={styles.acoes}>
                  <View style={styles.acao}>
                    <Button
                      label="Aceitar"
                      onPress={() => responder(convite.id, "aceitar")}
                      loading={emAcao === convite.id}
                    />
                  </View>
                  <View style={styles.acao}>
                    <Button
                      label="Recusar"
                      onPress={() => responder(convite.id, "recusar")}
                      disabled={emAcao === convite.id}
                      variant="secondary"
                    />
                  </View>
                </View>

                <Text style={styles.nota}>
                  Quem acompanha nunca vê o sinal bruto da sessão nem edita nada, e cada
                  leitura fica registrada em trilha de acesso.
                </Text>
              </>
            )}
          </Panel>
        );
      })}

      {/* ===== nunca houve convite: a tela inteira é o estado vazio ===== */}
      {!carregando && !erro && convites.length === 0 ? (
        <Panel>
          <View style={styles.vazio}>
            <View style={styles.vazioIcone}>
              <Icon name="mail" size={36} color={papel.accentText} strokeWidth={1.6} />
            </View>
            <Text style={styles.vazioTitulo}>Nenhum convite por enquanto</Text>
            <Text style={styles.vazioTexto}>
              Quando um profissional de bem-estar pedir para acompanhar suas tendências, o
              pedido chega aqui — e nada acontece sem o seu aceite. Você também pode
              continuar só, no seu ritmo.
            </Text>
            <NavAction
              label="Ver quem me acompanha"
              tone="neutral"
              onPress={() => router.push("/patient/profile")}
            />
            <WaveField height={90} opacity={0.35} amplitude={12} />
          </View>
        </Panel>
      ) : null}

      {/* Respondeu a todos nesta visita: uma linha basta — o hero de "nada por
          aqui" contradiria os recibos logo acima. */}
      {!carregando && !erro && convites.length > 0 && pendentes.length === 0 ? (
        <Text style={styles.emDia}>
          Tudo em dia — nenhum convite pendente. Novos pedidos aparecem aqui.
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
    },
    cabeca: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    cabecaTextos: {
      flex: 1,
      gap: 2,
      minWidth: 150,
    },
    nome: {
      ...t.typography.heading,
      color: t.colors.text,
    },
    papel: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    escopo: {
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
    escopoTitulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    escopoChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    acoes: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
    acao: {
      flex: 1,
      minWidth: 160,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    recibo: {
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    emDia: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      marginTop: t.spacing.sm,
      textAlign: "center",
    },
    vazio: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingTop: t.spacing.lg,
    },
    vazioIcone: {
      alignItems: "center",
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderRadius: 44,
      borderWidth: 1,
      height: 88,
      justifyContent: "center",
      width: 88,
    },
    vazioTitulo: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: "center",
    },
    vazioTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 460,
      textAlign: "center",
    },
  });
