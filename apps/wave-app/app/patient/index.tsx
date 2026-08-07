import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listCareLinks, listPendingInvites, type CareLink } from "../../src/api/care";
import { getConsentStatus } from "../../src/api/consent";
import {
  formatDuration,
  formatPercent,
  listMyResults,
  sessionDurationSeconds,
  type SessionResult,
} from "../../src/api/results";
import { useAuth } from "../../src/auth/AuthContext";
import { capturaDisponivel, espectadorDisponivel } from "../../src/capture/availability";
import { Avatar } from "../../src/components/Avatar";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { HeadFigure } from "../../src/components/brand/HeadFigure";
import { WaveField } from "../../src/components/brand/WaveField";
import { BandColumns, type BandColumn } from "../../src/components/charts/BandColumns";
import { BandLegend } from "../../src/components/charts/BandLegend";
import { BandStack } from "../../src/components/charts/BandStack";
import { TrendChart, type TrendPoint } from "../../src/components/charts/TrendChart";
import { InfoButton } from "../../src/components/InfoButton";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Skeleton } from "../../src/components/Skeleton";
import { useRoleAccent, useTheme, type Theme } from "../../src/theme";

/** A partir daqui o herói e o resumo da última sessão ficam lado a lado. */
const LARGURA_COLUNAS = 900;
/** Quantas sessões entram nos gráficos rápidos da home. */
const JANELA_TENDENCIA = 8;

/** Saudação pela hora do dia — mesma leitura que a pessoa faz do relógio. */
function saudacao(agora: Date): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function dataPorExtenso(agora: Date): string {
  const texto = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * "sáb · 2 ago · 09:14" — o cabeçalho da última sessão.
 *
 * Montado à mão em vez de `toLocaleDateString` com tudo junto: o formato do
 * navegador para pt-BR devolve "sáb., 2 de ago.", cheio de pontos e do "de"
 * que o design não tem.
 */
function carimbo(iso: string): string {
  const d = new Date(iso);
  const semana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(/\.$/, "");
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${semana} · ${d.getDate()} ${MESES[d.getMonth()]} · ${hora}`;
}

/**
 * Home do paciente — porte de `Design/round1/inicio-paciente.html` (ADR-0042).
 *
 * Captação é uma **capability por plataforma** (`Architecture/22`, §3): existe
 * no mobile (módulo nativo BLE/SPP) e não no web puro.
 *
 * Surfaça — sem bloquear — dois pontos do consent-first (ADR-0024/0026): o
 * lembrete de consentimento (o gate que libera guardar resultados) e a caixa de
 * convites, quando há algum pendente.
 */
export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const emColunas = useWindowDimensions().width >= LARGURA_COLUNAS;

  const [consentido, setConsentido] = useState<boolean | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [acompanhantes, setAcompanhantes] = useState<CareLink[]>([]);
  const [sessoes, setSessoes] = useState<SessionResult[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [status, convites, vinculos, resultados] = await Promise.all([
        getConsentStatus(),
        listPendingInvites(),
        listCareLinks(),
        listMyResults(),
      ]);
      setConsentido(status.consent_given);
      setPendentes(convites.length);
      setAcompanhantes(vinculos.filter((v) => v.status === "active"));
      setSessoes(resultados);
    } catch {
      // A home não deve quebrar se os avisos falharem; ficam ocultos.
      setConsentido(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Ao focar, não só ao montar: voltando do consentimento ou de uma captação,
  // o aviso e as sessões recentes precisam refletir o que acabou de mudar.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const agora = new Date();
  const primeiroNome = (user?.display_name ?? "").split(" ")[0] || "por aqui";
  const ultima = sessoes.length > 0 ? sessoes[sessoes.length - 1] : null;

  // Últimas N sessões para os gráficos rápidos.
  const recentes = useMemo(() => sessoes.slice(-JANELA_TENDENCIA), [sessoes]);

  const tendenciaAlfa: TrendPoint[] = recentes
    .filter((r) => typeof r.metrics?.rel_alpha === "number")
    .map((r) => ({
      value: r.metrics.rel_alpha as number,
      label: new Date(r.created_at).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "numeric",
      }),
    }));

  const colunas: BandColumn[] = recentes
    .filter((r) => r.metrics?.relative_band_powers)
    .map((r) => ({
      label: new Date(r.created_at).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "numeric",
      }),
      relative: r.metrics.relative_band_powers ?? {},
    }));

  /** Desde quando existem sessões — vira o chip do cabeçalho. */
  const desde =
    sessoes.length > 0
      ? new Date(sessoes[0].created_at).toLocaleDateString("pt-BR", { month: "long" })
      : null;

  if (carregando) {
    return (
      <ScreenContainer wide>
        <Skeleton width={280} height={32} />
        <Skeleton width={190} height={14} />
        <Text style={styles.carregandoNota}>Sincronizando suas sessões com o servidor…</Text>
        <View style={[styles.grade, emColunas && styles.gradeLinha]}>
          <View style={styles.coluna}>
            <Panel>
              <Skeleton width="60%" height={22} />
              <Skeleton width="85%" height={14} />
              <Skeleton width="100%" height={110} />
              <Skeleton width={160} height={44} radius={t.radius.md} />
            </Panel>
          </View>
          <View style={emColunas ? styles.colunaLateral : styles.coluna}>
            <Panel>
              <Skeleton width="45%" height={18} />
              <Skeleton width="100%" height={22} radius={6} />
              <Skeleton width="70%" height={14} />
              <Skeleton width="55%" height={30} />
            </Panel>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer wide>
      {/* ===== saudação ===== */}
      <View style={styles.ola}>
        <View style={styles.olaTextos}>
          <Text style={styles.olaTitulo}>
            {saudacao(agora)}, {primeiroNome}.
          </Text>
          <Text style={styles.olaData}>{dataPorExtenso(agora)}</Text>
        </View>
        {sessoes.length > 0 && desde ? (
          <Chip
            label={`${sessoes.length} ${sessoes.length === 1 ? "sessão" : "sessões"} desde ${desde}`}
            dot
            accent={papel.accent}
          />
        ) : null}
      </View>

      {/* Lembrete não-bloqueante: sem consentimento, nada é guardado. */}
      {consentido === false ? (
        <NavAction
          label="Autorize guardar seus resultados"
          description="Sem consentimento, os resultados das suas sessões não são guardados. Toque para rever e autorizar."
          tone="attention"
          onPress={() => router.push("/patient/consent")}
        />
      ) : null}

      {pendentes > 0 ? (
        <NavAction
          label={
            pendentes === 1
              ? "1 convite aguardando resposta"
              : `${pendentes} convites aguardando resposta`
          }
          onPress={() => router.push("/patient/invites")}
        />
      ) : null}

      {/* ===== primeira vez ===== */}
      {sessoes.length === 0 ? (
        <Panel>
          <View style={styles.vazio}>
            <HeadFigure width={180} />
            <Text style={styles.vazioTitulo}>Sua primeira onda começa aqui</Text>
            <Text style={styles.vazioTexto}>
              Uma sessão leva poucos minutos e já mostra sua composição por banda, o ritmo
              alfa e a qualidade do sinal — tudo exploratório, sem veredito.
            </Text>
            <View style={[styles.passos, emColunas && styles.passosLinha]}>
              {[
                {
                  n: "1",
                  titulo: "Vista a faixa",
                  texto:
                    "Apoie o sensor frontal na testa, sem cabelos no meio do caminho.",
                },
                {
                  n: "2",
                  titulo: "Confira o contato",
                  texto:
                    "O indicador de qualidade do sinal mostra quando está bom para começar.",
                },
                {
                  n: "3",
                  titulo: "Siga a voz",
                  texto:
                    "60 s de olhos abertos, 60 s de olhos fechados — a guia conduz você.",
                },
              ].map((p) => (
                <View key={p.n} style={styles.passo}>
                  <View style={styles.passoNumero}>
                    <Text style={styles.passoNumeroTexto}>{p.n}</Text>
                  </View>
                  <Text style={styles.passoTitulo}>{p.titulo}</Text>
                  <Text style={styles.passoTexto}>{p.texto}</Text>
                </View>
              ))}
            </View>
            {capturaDisponivel() ? (
              <View style={styles.vazioAcao}>
                <Button
                  label="Iniciar primeira sessão"
                  onPress={() => router.push("/patient/live")}
                  accent={papel.accent}
                />
              </View>
            ) : (
              <Text style={styles.vazioNota}>
                A captação acontece no app do celular. Por aqui você acompanha o histórico
                assim que a primeira sessão existir.
              </Text>
            )}
            <Text style={styles.vazioNota}>
              Só você vê seus dados. Compartilhar com um profissional de bem-estar é
              opcional — e sempre revogável.
            </Text>
          </View>
        </Panel>
      ) : null}

      {/* ===== herói + última sessão ===== */}
      {sessoes.length > 0 ? (
        <View style={[styles.grade, emColunas && styles.gradeLinha]}>
          <View style={styles.coluna}>
            <Panel grow>
              <Text style={styles.heroiTitulo}>Um bom momento para uma nova onda?</Text>
              <Text style={styles.heroiTexto}>
                A sessão guiada leva 2 minutos — 60 s de olhos abertos, 60 s de olhos
                fechados, com guia por voz. O alfa costuma contar uma boa história.
              </Text>
              {capturaDisponivel() ? (
                <View style={styles.heroiAcao}>
                  <Button
                    label="Iniciar sessão"
                    onPress={() => router.push("/patient/live")}
                    accent={papel.accent}
                  />
                </View>
              ) : (
                <Text style={styles.heroiNota}>
                  A captação acontece no app do celular. Por aqui você acompanha histórico e
                  tendências.
                </Text>
              )}
              <WaveField height={90} opacity={0.4} amplitude={12} />
            </Panel>
          </View>

          {ultima ? (
            <View style={emColunas ? styles.colunaLateral : styles.coluna}>
              <Panel title="Última sessão" eyebrow={carimbo(ultima.created_at)} grow>
                {ultima.metrics?.relative_band_powers ? (
                  <>
                    <BandStack relative={ultima.metrics.relative_band_powers} />
                    <BandLegend relative={ultima.metrics.relative_band_powers} />
                  </>
                ) : null}

                {typeof ultima.metrics?.rel_alpha === "number" ? (
                  <View style={styles.alfaLinha}>
                    <Text style={styles.alfaValor}>
                      {formatPercent(ultima.metrics.rel_alpha, 0)}
                    </Text>
                    <Text style={styles.alfaUnidade}>
                      de alfa no espectro — sem valência
                    </Text>
                    <InfoButton term="rel_alpha" accent={papel.accent} />
                  </View>
                ) : null}

                <Text style={styles.ultimaMeta}>
                  {[
                    formatDuration(sessionDurationSeconds(ultima.metrics)),
                    ultima.engine_version ? `motor ${ultima.engine_version}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>

                <NavAction
                  label="Ver no histórico"
                  onPress={() => router.push("/patient/history")}
                  tone="neutral"
                />
              </Panel>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ===== tendências rápidas ===== */}
      {tendenciaAlfa.length > 1 || colunas.length > 1 ? (
        <Panel
          title="Tendências rápidas"
          eyebrow={`últimas ${recentes.length} sessões`}
          headerAccessory={<InfoButton term="trend_direction" />}
        >
          {tendenciaAlfa.length > 1 ? (
            <>
              <Text style={styles.figuraLegenda}>Alfa · % do espectro por sessão</Text>
              <TrendChart
                data={tendenciaAlfa}
                accent={t.colors.bandAlpha}
                formatValue={(v) => formatPercent(v, 0)}
              />
            </>
          ) : null}

          {colunas.length > 1 ? (
            <>
              <Text style={styles.figuraLegenda}>Composição por banda · % por sessão</Text>
              <BandColumns columns={colunas} />
              <BandLegend relative={ultima?.metrics?.relative_band_powers ?? {}} />
            </>
          ) : null}

          <Text style={styles.nota}>
            Bandas sem valência — nenhuma é “boa” ou “ruim”. O interessante é como a
            composição se move junto com o seu contexto.
          </Text>
        </Panel>
      ) : null}

      {/* ===== quem acompanha ===== */}
      {acompanhantes.length > 0 ? (
        <Panel title="Quem me acompanha" eyebrow="autorização sua">
          {acompanhantes.map((v) => (
            <View key={v.id} style={styles.acompanhante}>
              <Avatar name={v.counterpart_display_name} tone={t.colors.accentDoctorText} />
              <View style={styles.acompanhanteTextos}>
                <Text style={styles.acompanhanteNome}>
                  {v.counterpart_display_name ?? "Profissional de bem-estar"}
                </Text>
                <Text style={styles.acompanhanteNota}>
                  profissional de bem-estar · vê suas medidas e notas
                </Text>
              </View>
            </View>
          ))}
          <NavAction
            label="Gerenciar no perfil"
            onPress={() => router.push("/patient/profile")}
            tone="neutral"
          />
        </Panel>
      ) : null}

      {/* Superfície por plataforma (P6-b): sem captação aqui (web de produção),
          "Estado ao vivo" não é função do produto — só histórico/tendências. */}
      {capturaDisponivel() ? (
        <NavAction label="Estado ao vivo" onPress={() => router.push("/patient/live")} />
      ) : null}
      {/* Espectador ao vivo (ADR-0039): acompanhar no navegador a captação do
          celular. Web-only. */}
      {espectadorDisponivel() ? (
        <NavAction label="Assistir ao vivo" onPress={() => router.push("/patient/watch")} />
      ) : null}
      <NavAction
        label="Ver histórico completo"
        onPress={() => router.push("/patient/history")}
      />
      <NavAction label="Meu perfil" onPress={() => router.push("/patient/profile")} />

      <Disclaimer />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    carregandoNota: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 13,
    },
    ola: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
    },
    olaTextos: {
      flex: 1,
      gap: 2,
      minWidth: 200,
    },
    olaTitulo: {
      ...t.typography.display,
      color: t.colors.text,
    },
    olaData: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
    },
    grade: {
      gap: t.spacing.md,
    },
    gradeLinha: {
      alignItems: "stretch",
      flexDirection: "row",
    },
    coluna: {
      flex: 1,
      gap: t.spacing.md,
      minWidth: 0,
    },
    // Largura fixa, **sem** compor com `coluna`: aquela tem `flex: 1`, que no
    // RN-web vira `flex-basis: 0%` e vence a largura no eixo principal — a
    // coluna encolhia até o texto quebrar letra a letra.
    colunaLateral: {
      flexGrow: 0,
      flexShrink: 0,
      gap: t.spacing.md,
      width: 360,
    },
    heroiTitulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    heroiTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
    },
    heroiAcao: {
      alignSelf: "flex-start",
      minWidth: 220,
    },
    heroiNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    alfaLinha: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    alfaValor: {
      color: t.colors.bandAlpha,
      fontSize: 32,
      fontWeight: "700",
    },
    alfaUnidade: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      flexShrink: 1,
      lineHeight: 17,
      maxWidth: 190,
    },
    ultimaMeta: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
    },
    figuraLegenda: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.sm,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      lineHeight: 18,
    },
    acompanhante: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    acompanhanteTextos: {
      flexShrink: 1,
      gap: 2,
    },
    acompanhanteNome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    acompanhanteNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    vazio: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.md,
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
    passos: {
      alignSelf: "stretch",
      gap: t.spacing.md,
      marginTop: t.spacing.md,
      maxWidth: 680,
    },
    passosLinha: {
      alignSelf: "center",
      flexDirection: "row",
    },
    passo: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      flex: 1,
      gap: t.spacing.xs,
      padding: t.spacing.md,
    },
    passoNumero: {
      alignItems: "center",
      backgroundColor: t.colors.surfaceStrong,
      borderRadius: t.radius.pill,
      height: 26,
      justifyContent: "center",
      width: 26,
    },
    passoNumeroTexto: {
      ...t.typography.caption,
      color: t.colors.text,
      fontWeight: "700",
    },
    passoTitulo: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontSize: 14,
    },
    passoTexto: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      lineHeight: 17,
    },
    vazioNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      maxWidth: 440,
      textAlign: "center",
    },
    vazioAcao: {
      marginTop: t.spacing.sm,
      minWidth: 240,
    },
  });
