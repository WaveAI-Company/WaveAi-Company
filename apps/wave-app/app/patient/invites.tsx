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
import { EmptyState } from "../../src/components/EmptyState";
import { Icon } from "../../src/components/Icon";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { Skeleton } from "../../src/components/Skeleton";
import { TextLink } from "../../src/components/TextLink";
import { dataCurta } from "../../src/format/date";
import {
  useAccentFor,
  useFaixa,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../src/theme";

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

/** "enviado ontem", "enviado há 3 dias" — e a data seca quando já é antigo. */
function enviadoEm(iso: string, agora: Date): string {
  const d = new Date(iso);
  const dias = Math.floor((agora.getTime() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "enviado hoje";
  if (dias === 1) return "enviado ontem";
  if (dias <= 30) return `enviado há ${dias} dias`;
  return `enviado em ${dataCurta(iso)}`;
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
  const movel = useFaixa() === "movel";

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
                {/* `convites.html:252` mostra papel **e** endereço na mesma
                    linha. O e-mail só existe enquanto o convite pende, e é o
                    que permite reconhecer quem convidou: o nome de exibição
                    qualquer um escolhe, o endereço não. */}
                <Text style={styles.papel}>
                  {["profissional de bem-estar", convite.counterpart_email]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Chip label={enviadoEm(convite.created_at, agora)} />
            </View>

            {/* `.inv-msg` do mockup (`convites.html:256`): o recado aparece
                como CITAÇÃO ATRIBUÍDA — aspas, itálico, com o nome de quem
                escreveu no cartão logo acima —, nunca como texto do sistema
                (ADR-0043, item 6). Some junto com as ações quando o convite é
                aceito, como no mockup (`.inv.accepted .inv-msg{display:none}`).

                É `<Text>`: não interpreta markup e **não faz autolink**. Convite
                com texto de terceiro é vetor clássico de phishing, e o autolink
                do RN é opt-in — a decisão é não ligar. */}
            {!aceito && convite.message ? (
              <Text
                style={styles.recado}
                accessibilityLabel={`Mensagem de ${convite.counterpart_display_name ?? "quem convidou"}: ${convite.message}`}
              >
                {`“${convite.message}”`}
              </Text>
            ) : null}

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
                  <View style={movel ? styles.acaoMovel : undefined}>
                    <Button
                      label="Aceitar"
                      onPress={() => responder(convite.id, "aceitar")}
                      loading={emAcao === convite.id}
                      largura={movel ? "bloco" : "conteudo"}
                    />
                  </View>
                  <View style={movel ? styles.acaoMovel : undefined}>
                    <Button
                      label="Recusar"
                      onPress={() => responder(convite.id, "recusar")}
                      disabled={emAcao === convite.id}
                      variant="secondary"
                      largura={movel ? "bloco" : "conteudo"}
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
        <EmptyState
          adorno={{ tipo: "icone", nome: "mail" }}
          titulo="Nenhum convite por enquanto"
          texto="Quando um profissional de bem-estar pedir para acompanhar suas tendências, o pedido chega aqui — e nada acontece sem o seu aceite. Você também pode continuar só, no seu ritmo."
          nota={
            // O mockup manda para o perfil por um **link dentro da frase**, não
            // por um botão: aqui não há nada a fazer, só um caminho a oferecer.
            <View style={styles.notaLinha}>
              <Text style={styles.notaTexto}>Já acompanha alguém? Veja</Text>
              <TextLink
                label="Quem me acompanha"
                compacto
                onPress={() => router.push("/patient/profile")}
              />
              <Text style={styles.notaTexto}>no seu perfil.</Text>
            </View>
          }
        />
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
    //: `.inv-msg`: fundo `surface-2`, raio médio, 13,5px, `ink-2`, itálico.
    recado: {
      ...t.typography.body,
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      color: t.colors.textMuted,
      fontSize: 13.5,
      fontStyle: "italic",
      marginTop: t.spacing.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
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
    // No celular cada botão toma metade da linha — é o `.inv-actions .btn{flex:1}`
    // que o mockup aplica só em `max-width:767px`. Acima disso eles ficam do
    // tamanho do rótulo, lado a lado e encostados à esquerda; antes este `flex`
    // valia em toda largura e era o que os espalhava pelo cartão inteiro.
    // Sem `minWidth`: com 160 os dois não cabiam na linha de 293 px de um
    // celular de 375, o `flexWrap` quebrava e cada um voltava a ocupar a
    // largura inteira — o oposto do que a regra do mockup faz.
    acaoMovel: {
      flex: 1,
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
    notaLinha: {
      alignItems: "center",
      flexDirection: "row",
      // Sem `wrap` a frase transborda no celular: `flexShrink` é 0 por padrão
      // no RN e a linha não quebra sozinha.
      flexWrap: "wrap",
      gap: t.spacing.xs,
      justifyContent: "center",
    },
    notaTexto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 13,
    },
  });
