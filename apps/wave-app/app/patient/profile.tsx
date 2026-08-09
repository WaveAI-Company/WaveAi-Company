import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listCareLinks, revokeCareLink, type CareLink } from "../../src/api/care";
import { getConsentStatus, type ConsentStatus } from "../../src/api/consent";
import { useAuth } from "../../src/auth/AuthContext";
import { DIAGNOSTICO_BLE_HABILITADO } from "../../src/capture/availability";
import { Avatar } from "../../src/components/Avatar";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Skeleton } from "../../src/components/Skeleton";
import { ThemeSelector } from "../../src/components/ThemeSelector";
import {
  bp,
  useAccentFor,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../src/theme";

/** A partir daqui configurações e acompanhamento ficam lado a lado. */
// `.prof-grid` do mockup: duas colunas iguais, empilhando em 960.

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "12 jul 2026" — sem os "de" que o `toLocaleDateString` pt-BR insere. */
function dataCurta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Perfil do paciente — porte de `Design/round1/perfil.html` (ADR-0042).
 *
 * Centro de controle do consent-first (ADR-0024/0026): o paciente vê e gere seu
 * consentimento, vê quem autorizou e pode **revogar** o acesso a qualquer
 * momento (efeito imediato). Convites pendentes e o termo têm telas próprias.
 *
 * "Dados da conta" é **leitura**: a API só expõe `GET /auth/me` — não há troca
 * de nome, e-mail ou senha. Desenhar o campo editável e o botão "Salvar" do
 * mockup seria oferecer uma ação que não acontece.
 */
export default function PatientProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const { accent } = useRoleAccent();
  const profissional = useAccentFor("doctor");
  const styles = useMemo(() => criarEstilos(t), [t]);
  const emColunas = useWindowDimensions().width > bp.duasColunas;

  const [links, setLinks] = useState<CareLink[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  /** Vínculos revogados nesta visita — ficam à vista, riscados, como recibo. */
  const [revogados, setRevogados] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [todos, status] = await Promise.all([listCareLinks(), getConsentStatus()]);
      setLinks(todos.filter((link) => link.status === "active"));
      setPendentes(todos.filter((link) => link.status === "pending").length);
      setConsent(status);
      setRevogados([]);
    } catch {
      setErro("Não foi possível carregar seu perfil.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Ao focar: voltando da tela de consentimento ou de convites, o que mudou
  // lá precisa aparecer aqui.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const revogar = useCallback(async (id: string) => {
    setRevogando(id);
    setErro(null);
    try {
      await revokeCareLink(id);
      // O vínculo não sai da lista: some no próximo carregamento. Some agora
      // seria a pessoa perder de vista o que acabou de fazer — e desfazer não
      // existe (revogar é terminal no servidor; voltar exige um novo convite).
      setRevogados((atual) => [...atual, id]);
    } catch {
      setErro("Não foi possível revogar o acesso. Tente de novo.");
    } finally {
      setRevogando(null);
    }
  }, []);

  const consentido = consent?.consent_given ?? false;
  const ativos = links.filter((link) => !revogados.includes(link.id));

  /** Sobrancelha de seção com a régua do design. */
  const rotuloSecao = (texto: string) => (
    <View style={styles.secao}>
      <Text style={styles.secaoTexto}>{texto}</Text>
      <View style={styles.secaoRegua} />
    </View>
  );

  /** Par rótulo/valor em leitura — a forma do campo, sem a promessa de editar. */
  const campoLeitura = (rotulo: string, valor: ReactNode) => (
    <View style={styles.campo}>
      <Text style={styles.campoRotulo}>{rotulo}</Text>
      <View style={styles.campoCaixa}>
        <Text style={styles.campoValor}>{valor}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer largura="perfil">
      {/* ===== cabeçalho ===== */}
      <View style={styles.cabecalho}>
        <Avatar name={user?.display_name} size={64} />
        <View style={styles.cabecalhoTextos}>
          <Text style={styles.nome}>{user?.display_name ?? "Paciente"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <Chip label="Paciente" dot accent={accent} />
      </View>

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        {/* ============ configurações ============ */}
        <View style={styles.coluna}>
          {rotuloSecao("Configurações")}

          <Panel title="Aparência" eyebrow="tema">
            <ThemeSelector />
            <Text style={styles.nota}>
              “Sistema” acompanha a preferência do seu aparelho automaticamente.
            </Text>
          </Panel>

          <Panel title="Dados da conta" eyebrow="identificação">
            {campoLeitura("Nome", user?.display_name ?? "—")}
            {campoLeitura("E-mail", user?.email ?? "—")}
            <Text style={styles.nota}>
              Editar o nome, trocar o e-mail e alterar a senha ainda não existem no
              servidor — por isso não há um botão aqui que não faria nada.
            </Text>
          </Panel>
        </View>

        {/* ============ quem me acompanha ============ */}
        <View style={styles.coluna}>
          {rotuloSecao("Quem me acompanha")}

          <Panel
            title="Profissionais autorizados"
            headerAccessory={<Chip label="leitura · nunca edição" />}
          >
            <Text style={styles.nota}>
              Compartilhar é opcional — e sempre reversível. Quem você autorizar vê suas
              tendências, resumos e autorrelatos. Revogar o acesso tem efeito imediato.
            </Text>

            {carregando ? (
              <View style={styles.pessoa}>
                <Skeleton width={46} height={46} radius={23} />
                <View style={styles.pessoaTextos}>
                  <Skeleton width="55%" height={16} />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
            ) : null}

            {!carregando && ativos.length === 0 && revogados.length === 0 ? (
              <Text style={styles.vazio}>
                Ninguém acompanha você no momento. Suas sessões ficam só com você até
                autorizar alguém.
              </Text>
            ) : null}

            {!carregando
              ? links.map((link) => {
                  const revogado = revogados.includes(link.id);
                  return (
                    <View
                      key={link.id}
                      style={[styles.pessoa, revogado && styles.pessoaRevogada]}
                    >
                      <Avatar
                        name={link.counterpart_display_name}
                        size={46}
                        tone={profissional.accentText}
                      />
                      <View style={styles.pessoaTextos}>
                        <Text style={[styles.pessoaNome, revogado && styles.riscado]}>
                          {link.counterpart_display_name ?? "Profissional de bem-estar"}
                        </Text>
                        <Text style={styles.pessoaNota}>
                          profissional de bem-estar · acesso desde{" "}
                          {dataCurta(link.consented_at ?? link.created_at)}
                        </Text>
                      </View>
                      {revogado ? (
                        <Text style={styles.recibo}>acesso revogado</Text>
                      ) : (
                        <View style={styles.pessoaAcao}>
                          <Button
                            label="Revogar acesso"
                            onPress={() => revogar(link.id)}
                            loading={revogando === link.id}
                            variant="secondary"
                          />
                        </View>
                      )}
                    </View>
                  );
                })
              : null}

            {/* O consentimento é o gate que libera guardar resultados — some da
                vista só quando está em dia, e mesmo assim continua acessível. */}
            <NavAction
              label={consentido ? "Consentimento de guarda dos resultados" : "Rever e autorizar a guarda dos resultados"}
              description={
                consentido
                  ? consent?.consent_given_at
                    ? `Ativo desde ${dataCurta(consent.consent_given_at)}.`
                    : "Ativo."
                  : "Sem consentimento, os resultados das suas sessões não são guardados."
              }
              tone={consentido ? "neutral" : "attention"}
              onPress={() => router.push("/patient/consent")}
            />

            <NavAction
              label={
                pendentes === 0
                  ? "Convites"
                  : pendentes === 1
                    ? "1 convite aguardando resposta"
                    : `${pendentes} convites aguardando resposta`
              }
              tone={pendentes > 0 ? "accent" : "neutral"}
              onPress={() => router.push("/patient/invites")}
            />
          </Panel>

          <Panel>
            <Text style={styles.nota}>
              O profissional de bem-estar nunca vê o sinal bruto da sessão nem edita nada —
              lê as medidas calculadas no servidor e o que você escreveu. Acompanhar uma
              sessão ao vivo passa pela mesma autorização e fica registrado em trilha de
              acesso. Revogar encerra tudo isso na hora.
            </Text>
          </Panel>
        </View>
      </View>

      {/* Ferramenta de dev (ADR-0040): descoberta dos UUIDs BLE do headset. */}
      {DIAGNOSTICO_BLE_HABILITADO ? (
        <NavAction
          label="Diagnóstico BLE (dev)"
          description="Enumera serviços/características do sensor para descobrir os UUIDs (iOS)."
          tone="neutral"
          onPress={() => router.push("/patient/ble-diag")}
        />
      ) : null}

      <Disclaimer />

      <Button label="Sair" onPress={signOut} variant="secondary" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    cabecalho: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
      marginBottom: t.spacing.sm,
    },
    cabecalhoTextos: {
      flex: 1,
      gap: 2,
      minWidth: 180,
    },
    nome: {
      ...t.typography.title,
      color: t.colors.text,
    },
    email: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 13,
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
    },
    grade: {
      gap: t.spacing.lg,
    },
    gradeLinha: {
      alignItems: "flex-start",
      flexDirection: "row",
    },
    // As duas colunas dividem a largura em partes iguais, então `flex: 1` é o
    // que se quer aqui — o cuidado da home (estilo próprio, sem `flex`) vale
    // para coluna de largura FIXA, que é outro caso.
    coluna: {
      flex: 1,
      gap: t.spacing.md,
      minWidth: 0,
    },
    secao: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    secaoTexto: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    secaoRegua: {
      backgroundColor: t.colors.border,
      flex: 1,
      height: 1,
    },
    campo: {
      gap: 6,
    },
    campoRotulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    campoCaixa: {
      backgroundColor: t.colors.surfaceAlt,
      borderColor: t.colors.border,
      borderRadius: t.radius.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    campoValor: {
      ...t.typography.body,
      color: t.colors.text,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    vazio: {
      ...t.typography.body,
      color: t.colors.textMuted,
      paddingVertical: t.spacing.sm,
    },
    pessoa: {
      alignItems: "center",
      borderTopColor: t.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
    },
    pessoaRevogada: {
      opacity: 0.65,
    },
    pessoaTextos: {
      flex: 1,
      gap: 2,
      minWidth: 140,
    },
    pessoaNome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    riscado: {
      textDecorationLine: "line-through",
    },
    pessoaNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    pessoaAcao: {
      minWidth: 160,
    },
    recibo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontWeight: "700",
    },
  });
