import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listCareLinks, revokeCareLink, type CareLink } from "../../src/api/care";
import { getConsentStatus, type ConsentStatus } from "../../src/api/consent";
import { useAuth } from "../../src/auth/AuthContext";
import { dataCurta } from "../../src/format/date";
import { DIAGNOSTICO_BLE_HABILITADO } from "../../src/capture/availability";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { PersonRow, PersonRowSkeleton } from "../../src/components/profile/PersonRow";
import { AccountEditor } from "../../src/components/profile/AccountEditor";
import { ProfileHeader } from "../../src/components/profile/ProfileHeader";
import { ProfileSection } from "../../src/components/profile/ProfileSection";
import { ScreenContainer } from "../../src/components/ScreenContainer";
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

/**
 * Perfil do paciente — porte de `Design/round1/perfil.html` (ADR-0042).
 *
 * Centro de controle do consent-first (ADR-0024/0026): o paciente vê e gere seu
 * consentimento, vê quem autorizou e pode **revogar** o acesso a qualquer
 * momento (efeito imediato). Convites pendentes e o termo têm telas próprias.
 *
 * "Dados da conta" **edita** desde a P13: nome e senha vão pelo `AccountEditor`,
 * compartilhado com o perfil do profissional. O **e-mail** segue em leitura —
 * trocá-lo é um fluxo de dois passos, com código no endereço novo, e ganha tela
 * própria.
 */
export default function PatientProfileScreen() {
  const { user } = useAuth();
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

  return (
    <ScreenContainer largura="perfil">
      <ProfileHeader
        name={user?.display_name}
        email={user?.email}
        fallback="Paciente"
        role="Paciente"
        accent={accent}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        {/* ============ configurações ============ */}
        <View style={[styles.coluna, emColunas && styles.colunaLinha]}>
          <ProfileSection label="Configurações" />

          <Panel title="Aparência" eyebrow="tema">
            <ThemeSelector />
            <Text style={styles.nota}>
              “Sistema” acompanha a preferência do seu aparelho automaticamente.
            </Text>
          </Panel>

          <AccountEditor />
        </View>

        {/* ============ quem me acompanha ============ */}
        <View style={[styles.coluna, emColunas && styles.colunaLinha]}>
          <ProfileSection label="Quem me acompanha" />

          <Panel
            title="Profissionais autorizados"
            headerAccessory={<Chip label="leitura · nunca edição" />}
          >
            <Text style={styles.nota}>
              Compartilhar é opcional — e sempre reversível. Quem você autorizar vê suas
              tendências, resumos e autorrelatos. Revogar o acesso tem efeito imediato.
            </Text>

            {carregando ? <PersonRowSkeleton /> : null}

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
                    <PersonRow
                      key={link.id}
                      name={link.counterpart_display_name}
                      fallback="Profissional de bem-estar"
                      note={`profissional de bem-estar · acesso desde ${dataCurta(
                        link.consented_at ?? link.created_at,
                      )}`}
                      tone={profissional.accentText}
                      ended={revogado}
                      status={revogado ? "acesso revogado" : undefined}
                      action={
                        <Button
                          label="Revogar acesso"
                          onPress={() => revogar(link.id)}
                          loading={revogando === link.id}
                          variant="secondary"
                        />
                      }
                    />
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

      {/* "Sair" saiu do perfil: ele vive na sidebar (decisão do fundador em
          2026-08-13). */}
      <Disclaimer />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
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
      gap: t.spacing.md,
      minWidth: 0,
    },
    // `flex` só quando a grade é uma LINHA. Empilhada no celular, o eixo
    // principal vira o vertical e o `flex: 1` (que o RN-web resolve como
    // `flex-basis: 0%`) reparte a ALTURA em partes iguais: sobra vazio no fim
    // da primeira coluna e a segunda transborda por cima do que vem depois.
    // Medido no perfil a 375px: 542px para cada coluna, 122px de vazio numa e
    // 121px de transbordo na outra — o "espaçamento muito grande" e a
    // "sobreposição" do pente fino eram a mesma causa.
    colunaLinha: {
      flex: 1,
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
  });
