import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listCareLinks, revokeCareLink, type CareLink } from "../../src/api/care";
import { getConsentStatus, type ConsentStatus } from "../../src/api/consent";
import { useAuth } from "../../src/auth/AuthContext";
import { dataCurta } from "../../src/format/date";
import { DIAGNOSTICO_BLE_HABILITADO } from "../../src/capture/availability";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { Icon, type IconName } from "../../src/components/Icon";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { PersonRow, PersonRowSkeleton } from "../../src/components/profile/PersonRow";
import { AccountEditor } from "../../src/components/profile/AccountEditor";
import { ProfileHeader } from "../../src/components/profile/ProfileHeader";
import { ProfileSection } from "../../src/components/profile/ProfileSection";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ThemeSelector } from "../../src/components/ThemeSelector";
import {
  anelFoco,
  bp,
  motion,
  semContornoNativo,
  transicao,
  useAccentFor,
  useInteracao,
  useRoleAccent,
  useTheme,
  withAlpha,
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

          <AccountEditor showEmail={false} showPassword={false} />
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

            {/**
             * `.consent-links` do mockup: duas linhas discretas no pé do
             * cartão, com ícone à esquerda e o badge da contagem à direita —
             * e não dois `NavAction` da largura do cartão, que pesavam tanto
             * quanto a lista de pessoas acima deles.
             *
             * **Com uma exceção que o mockup não previu:** sem consentimento
             * os resultados não são guardados, e isso não é um link de
             * navegação — é uma condição. Nesse estado a linha troca de tom e
             * ganha a frase, em vez de virar mais um item cinza no rodapé.
             */}
            <View style={styles.linksConsentimento}>
              <LinhaAcao
                icone="mail"
                label="Convites pendentes"
                badge={pendentes}
                onPress={() => router.push("/patient/invites")}
              />
              <LinhaAcao
                icone="shield"
                label={
                  consentido
                    ? "Consentimento de guarda dos resultados"
                    : "Rever e autorizar a guarda dos resultados"
                }
                descricao={
                  consentido
                    ? undefined
                    : "Sem consentimento, os resultados das suas sessões não são guardados."
                }
                atencao={!consentido}
                onPress={() => router.push("/patient/consent")}
              />
            </View>
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

      {/* As credenciais saem da coluna de configurações e viram uma faixa
          própria, meio a meio na largura inteira: são dois formulários do
          mesmo peso, e espremidos numa coluna eles empurravam "Dados da conta"
          para longe do topo do cartão vizinho. */}
      <AccountEditor showIdentity={false} credenciaisEmLinha={emColunas} />

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

/**
 * Uma linha do `.consent-links`: ícone, rótulo e, à direita, o badge da
 * contagem — o mesmo gesto do item de navegação, em escala de rodapé.
 *
 * Declarada fora da tela porque cada linha precisa do seu `useInteracao`:
 * dentro do render, seria um componente novo a cada quadro.
 */
function LinhaAcao({
  icone,
  label,
  descricao,
  badge = 0,
  atencao,
  onPress,
}: {
  icone: IconName;
  label: string;
  /** Só no estado de atenção: a linha explica o que está em falta. */
  descricao?: string;
  badge?: number;
  atencao?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers } = useInteracao();
  const cor = atencao ? t.colors.warningText : t.colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} aguardando resposta` : label}
      onPress={onPress}
      {...handlers}
      style={[
        styles.linhaAcao,
        estado.hovered && { backgroundColor: t.colors.surfaceAlt },
        estado.pressed && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel
          ? { boxShadow: anelFoco(papel.accent, t.colors.surface) }
          : null,
      ]}
    >
      <Icon name={icone} size={17} color={cor} strokeWidth={1.8} />
      <View style={styles.linhaAcaoTextos}>
        <Text
          style={[
            styles.linhaAcaoLabel,
            { color: estado.hovered && !atencao ? t.colors.text : cor },
          ]}
        >
          {label}
        </Text>
        {descricao ? <Text style={styles.linhaAcaoNota}>{descricao}</Text> : null}
      </View>
      {badge > 0 ? (
        <View
          style={[
            styles.linhaAcaoBadge,
            { backgroundColor: withAlpha(papel.accent, t.isDark ? 0.18 : 0.12) },
          ]}
        >
          <Text style={[styles.linhaAcaoBadgeTexto, { color: papel.accent }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    // `.consent-links{display:flex; flex-direction:column; gap:2px; margin-top:6px}`.
    linksConsentimento: {
      gap: 2,
      marginTop: 6,
    },
    // `.consent-links a{min-height:44px; padding:0 12px; border-radius:var(--r-m)}`.
    linhaAcao: {
      alignItems: "center",
      borderRadius: t.radius.md,
      flexDirection: "row",
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 6,
      ...transicao("background-color, box-shadow", motion.rapida),
      ...semContornoNativo(),
    },
    linhaAcaoTextos: {
      flexShrink: 1,
      gap: 2,
    },
    // `font-weight:600; font-size:13.5px`.
    linhaAcaoLabel: {
      ...t.typography.label,
      fontSize: 13.5,
      fontWeight: "600",
    },
    linhaAcaoNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    // `.consent-links .badge{margin-left:auto; min-width:20px; height:20px}`.
    linhaAcaoBadge: {
      alignItems: "center",
      borderRadius: t.radius.pill,
      height: 20,
      justifyContent: "center",
      marginLeft: "auto",
      minWidth: 20,
      paddingHorizontal: 6,
    },
    linhaAcaoBadgeTexto: {
      ...t.typography.caption,
      fontSize: 11.5,
      fontWeight: "700",
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
    },
    grade: {
      gap: t.spacing.lg,
    },
    /**
     * `stretch` dá às duas colunas a mesma altura — mas **os cartões dentro
     * delas mantêm a altura do conteúdo**, e a sobra fica no fim da coluna,
     * fora de qualquer borda.
     *
     * Esticar o último cartão para as bordas de baixo coincidirem foi a
     * primeira tentativa, e ela quebra quando as colunas são desiguais: no
     * perfil do profissional, com quatro pessoas na lista ao lado, sobravam
     * ~250px **dentro** do cartão de identidade — vazio delimitado por borda,
     * que lê como erro. Fora do cartão não há nada para o olho comparar, e a
     * diferença que resta no perfil do paciente (9px) é invisível. Decisão do
     * fundador em 2026-08-16: uma regra só para os dois papéis, sem enfeite
     * para preencher — um ornamento cujo tamanho depende do tamanho da lista
     * vizinha passa a carregar informação que não é dele.
     */
    gradeLinha: {
      alignItems: "stretch",
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
