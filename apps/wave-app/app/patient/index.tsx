import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { capturaDisponivel } from "../../src/capture/availability";
import { PersonAvatar } from "../../src/components/profile/PersonAvatar";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { EmptyState } from "../../src/components/EmptyState";
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
import { TextLink } from "../../src/components/TextLink";
import { diaMes } from "../../src/format/date";
import {
  anelFoco,
  elevar,
  motion,
  transicao,
  useFaixa,
  useInteracao,
  useRoleAccent,
  useTheme,
  type FaixaLargura,
  type Theme,
} from "../../src/theme";

/** A partir daqui o herói e o resumo da última sessão ficam lado a lado. */
// A home do mockup (`.home-grid`) tem **três** arranjos: 1,4fr/1fr acima de
// 1199, colunas iguais entre 768 e 1199, e empilhado no celular.
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
  return `${semana} · ${diaMes(iso)} · ${hora}`;
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
  const faixa = useFaixa();
  const emColunas = faixa !== "movel";
  /**
   * `grow` (que é `flex:1`) só vale para um cartão que **divide uma linha**
   * com outro — ali ele empata as alturas.
   *
   * Como filho direto da coluna da grade, o mesmo `flex:1` vira
   * `flex-basis:0%` na **altura**: os cartões repartem a altura disponível em
   * frações iguais e o que tem mais conteúdo transborda a própria borda —
   * 131px do "Tendências rápidas" saindo para fora do cartão em 1160x568, com
   * as colunas de banda e a legenda por baixo dele. Por isso cada cartão só
   * recebe `grow` na faixa em que está lado a lado com outro:
   *
   * ```
   * largo   [herói | última]   [tendências | acompanha]
   * médio   [herói]  [última | acompanha]  [tendências]
   * móvel   um por linha
   * ```
   */
  const ultimaEmLinha = faixa !== "movel";

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
      <ScreenContainer largura="app">
        <Skeleton width={280} height={32} />
        <Skeleton width={190} height={14} />
        <Text style={styles.carregandoNota}>Sincronizando suas sessões com o servidor…</Text>
        {/* O esqueleto imita a primeira linha da grade: mesmas proporções, para
            a tela não saltar quando o conteúdo real chega. */}
        <View style={emColunas ? styles.gradeLinha : styles.grade}>
          <View style={emColunas ? styles.celulaLarga : undefined}>
            <Panel>
              <Skeleton width="60%" height={22} />
              <Skeleton width="85%" height={14} />
              <Skeleton width="100%" height={110} />
              <Skeleton width={160} height={44} radius={t.radius.md} />
            </Panel>
          </View>
          <View style={emColunas ? styles.celulaEstreita : undefined}>
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

  /**
   * As quatro células da grade, montadas antes do `return`.
   *
   * Ficam em variáveis porque a **ordem** delas muda entre as faixas — no
   * mockup a linha 2 é "trend right" no desktop e "last right" no tablet, com
   * o "trend" descendo para uma terceira linha. Descrever isso como três
   * árvores é o que mantém cada arranjo fiel; montá-las aqui evita repetir o
   * conteúdo três vezes.
   */
  const celulas: CelulasHome = {
    /**
     * `.sess-hero{position:relative; overflow:hidden; justify-content:center;
     * gap:14px; padding:36px 32px; min-height:260px}`.
     *
     * A onda é **fundo**, não composição: `.sess-hero .wavefield` é
     * `position:absolute; inset:auto 0 -8px 0`, e a fileira de ações sobe por
     * cima dela com `z-index:2`. Estava como último filho no fluxo, o que
     * empurrava o botão para acima da onda e transformava o gradiente num
     * elemento a mais da pilha.
     */
    heroi: (
      <Panel
        grow={faixa === "largo"}
        style={[styles.heroi, faixa === "movel" && styles.heroiMovel]}
      >
        <WaveField height={110} opacity={0.4} amplitude={12} style={styles.heroiOnda} />

        <Text style={styles.heroiTitulo}>Um bom momento para uma nova onda?</Text>
        <Text style={styles.heroiTexto}>
          A sessão guiada leva 2 minutos — 60 s de olhos abertos, 60 s de olhos fechados,
          com guia por voz. O alfa costuma contar uma boa história.
        </Text>
        {capturaDisponivel() ? (
          // `.sess-hero .row` — e no celular ela vira coluna esticada, para o
          // botão ocupar a linha inteira (`.row .btn{width:100%}`).
          <View style={[styles.heroiAcoes, faixa === "movel" && styles.heroiAcoesMovel]}>
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
      </Panel>
    ),

    ultima: ultima ? (
      <Panel title="Última sessão" eyebrow={carimbo(ultima.created_at)} grow={ultimaEmLinha}>
        {ultima.metrics?.relative_band_powers ? (
          <>
            <BandStack relative={ultima.metrics.relative_band_powers} tamanho="destaque" />
            <BandLegend relative={ultima.metrics.relative_band_powers} />
          </>
        ) : null}

        {typeof ultima.metrics?.rel_alpha === "number" ? (
          <View style={styles.alfaLinha}>
            <Text style={styles.alfaValor}>{formatPercent(ultima.metrics.rel_alpha, 0)}</Text>
            <Text style={styles.alfaUnidade}>de alfa no espectro — sem valência</Text>
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

        {/* `<p style="margin-top:14px"><a>Ver sessão completa →</a></p>` — no
            mockup é um link de texto, não um botão de navegação. O `NavAction`
            é uma caixa da largura do cartão e pesava tanto quanto o gráfico
            que ele acompanha. */}
        <View style={styles.ultimaLink}>
          <TextLink
            label="Ver sessão completa →"
            onPress={() => router.push("/patient/history")}
            accent={papel.accent}
          />
        </View>
      </Panel>
    ) : null,

    tendencias:
      tendenciaAlfa.length > 1 || colunas.length > 1 ? (
        <Panel
          title="Tendências rápidas"
          eyebrow={`últimas ${recentes.length} sessões`}
          headerAccessory={<InfoButton term="trend_direction" />}
          grow={faixa === "largo"}
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
      ) : null,

    /**
     * A coluna direita do mockup tem **dois** cartões; aqui vai um.
     *
     * O "Qualidade do sinal" (a média de contato com barras verdes e amarelas)
     * não foi portado, e não é esquecimento: o nosso `Result` não tem "% de
     * contato" — tem `signal_std`, `mains_power` e `mains_power_ratio` — e a
     * faixa de verde/amarelo dependeria de um limiar de "sinal bom o
     * suficiente" que é a **Q-TEC-06, em aberto**. Ver `Documentation/15`.
     *
     * Sem `grow`: o cartão toma a **altura do seu conteúdo** e a célula o
     * ancora no topo da linha. Esticado, ele abria um vão morto embaixo (102px
     * medidos com um profissional) só para empatar com o gráfico ao lado.
     * Crescendo com a lista, ele encosta no gráfico quando houver gente
     * suficiente — que é o teto natural da linha.
     *
     * Cada pessoa é uma **linha clicável**, com o realce do `.pcard` do painel
     * do profissional. O botão "Gerenciar no perfil" saiu: era uma segunda
     * afordância para o mesmo destino, embaixo de linhas que pareciam
     * clicáveis e não eram.
     */
    acompanha:
      acompanhantes.length > 0 ? (
        <Panel title="Quem me acompanha" eyebrow="autorização sua">
          {acompanhantes.map((v) => (
            <LinhaAcompanhante
              key={v.id}
              nome={v.counterpart_display_name}
              userId={v.counterpart_user_id}
              onPress={() => router.push("/patient/profile")}
            />
          ))}
        </Panel>
      ) : null,
  };

  return (
    <ScreenContainer largura="app">
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
        <EmptyState
          adorno={{ tipo: "figura" }}
          titulo="Sua primeira onda começa aqui"
          texto="Uma sessão leva poucos minutos e já mostra sua composição por banda, o ritmo alfa e a qualidade do sinal — tudo exploratório, sem veredito."
          acao={
            capturaDisponivel() ? (
              <Button
                label="Iniciar primeira sessão"
                onPress={() => router.push("/patient/live")}
                accent={papel.accent}
              />
            ) : undefined
          }
          nota={
            capturaDisponivel() ? (
              "Só você vê seus dados. Compartilhar com um profissional de bem-estar é opcional — e sempre revogável."
            ) : (
              <View style={styles.notasVazio}>
                <Text style={styles.notaVazio}>
                  A captação acontece no app do celular. Por aqui você acompanha o histórico
                  assim que a primeira sessão existir.
                </Text>
                <Text style={styles.notaVazio}>
                  Só você vê seus dados. Compartilhar com um profissional de bem-estar é
                  opcional — e sempre revogável.
                </Text>
              </View>
            )
          }
        >
          <View style={[styles.passos, emColunas && styles.passosLinha]}>
            {[
              {
                n: "1",
                titulo: "Vista a faixa",
                texto: "Apoie o sensor frontal na testa, sem cabelos no meio do caminho.",
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
                texto: "60 s de olhos abertos, 60 s de olhos fechados — a guia conduz você.",
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
        </EmptyState>
      ) : null}

      {/* ===== a grade da home ===== */}
      {sessoes.length > 0 ? <GradeHome faixa={faixa} celulas={celulas} /> : null}

      {/* Superfície por plataforma (P6-b): sem captação aqui (web de produção),
          "Estado ao vivo" não é função do produto — só histórico/tendências. */}
      {/* A fila de "Estado ao vivo · Assistir ao vivo · Ver histórico completo ·
          Meu perfil" saiu daqui (pente fino: "não fazem sentido existirem ali").
          Ela é anterior à casca: os quatro destinos são itens da **sidebar**
          desde a P6, e repeti-los no rodapé da home era a navegação de antes
          sobrevivendo embaixo da navegação de agora.

          O conteúdo continua levando a cada um: o herói tem "Iniciar sessão", o
          cartão da última sessão tem "Ver no histórico" e o de acompanhamento
          tem "Gerenciar no perfil". Só "Assistir ao vivo" passa a existir
          exclusivamente na sidebar — que é onde o mockup o coloca. */}

      <Disclaimer />
    </ScreenContainer>
  );
}

/**
 * Um profissional que acompanha, como **cartão clicável** — o gesto do
 * `.pcard` do painel do profissional (sobe 2px, borda no destaque).
 *
 * Declarado fora da tela porque cada linha precisa do seu próprio
 * `useInteracao`: dentro do render, seria um componente novo a cada quadro e
 * perderia o estado de hover a cada atualização da home.
 */
function LinhaAcompanhante({
  nome,
  userId,
  onPress,
}: {
  nome: string | null | undefined;
  /** Id do profissional para a foto (ADR-0050); vínculo ativo. */
  userId: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers, reduzirMovimento } = useInteracao();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nome ?? "Profissional de bem-estar"} — gerenciar acesso no perfil`}
      onPress={onPress}
      {...handlers}
      style={[
        styles.acompanhante,
        estado.hovered && {
          backgroundColor: t.colors.surfaceAlt,
          borderColor: t.colors.accentDoctorText,
        },
        estado.hovered && elevar(-2, reduzirMovimento),
        estado.pressed && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel
          ? { boxShadow: anelFoco(t.colors.accentDoctorText, t.colors.surface) }
          : null,
      ]}
    >
      <PersonAvatar name={nome} tone={t.colors.accentDoctorText} userId={userId} />
      <View style={styles.acompanhanteTextos}>
        <Text style={styles.acompanhanteNome}>{nome ?? "Profissional de bem-estar"}</Text>
        <Text style={styles.acompanhanteNota}>
          profissional de bem-estar · vê suas medidas e notas
        </Text>
      </View>
    </Pressable>
  );
}

type CelulasHome = {
  heroi: ReactNode;
  ultima: ReactNode;
  tendencias: ReactNode;
  acompanha: ReactNode;
};

/**
 * A `.home-grid` do mockup, nas suas três formas.
 *
 * ```
 * ≥1200   1.4fr 1fr   "hero last"  "trend right"
 * ≤1199   1fr 1fr     "hero hero"  "last right"  "trend trend"
 * ≤767    1fr         hero · last · right · trend
 * ```
 *
 * **Três árvores, e não uma.** A ordem muda de faixa para faixa — o "trend"
 * está à esquerda da linha 2 no desktop e sozinho numa terceira linha no
 * tablet —, e não há arranjo de `flexWrap` que produza os dois com a mesma
 * ordem de filhos. Isso significa que **cruzar 1199 ou 767 remonta os
 * cartões**: os gráficos piscam e a onda reinicia. Decisão do fundador em
 * 2026-08-14, com o custo exposto: a pessoa usa computador **ou** tablet
 * **ou** celular, e não fica arrastando a janela pela quebra. Nada se perde na
 * remontagem porque não há nada digitado nesta tela.
 *
 * Declarado **fora** do componente da tela de propósito: dentro, ele seria uma
 * função nova a cada render e remontaria a grade inteira a cada carregamento.
 */
function GradeHome({ faixa, celulas }: { faixa: FaixaLargura; celulas: CelulasHome }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { heroi, ultima, tendencias, acompanha } = celulas;

  if (faixa === "movel") {
    return (
      <View style={styles.grade}>
        {heroi}
        {ultima}
        {acompanha}
        {tendencias}
      </View>
    );
  }

  if (faixa === "medio") {
    return (
      <View style={styles.grade}>
        {heroi}
        <View style={styles.gradeLinha}>
          <View style={styles.celulaMeia}>{ultima}</View>
          <View style={[styles.celulaMeia, styles.celulaNoTopo]}>{acompanha}</View>
        </View>
        {tendencias}
      </View>
    );
  }

  return (
    <View style={styles.grade}>
      <View style={styles.gradeLinha}>
        <View style={styles.celulaLarga}>{heroi}</View>
        <View style={styles.celulaEstreita}>{ultima}</View>
      </View>
      <View style={styles.gradeLinha}>
        <View style={styles.celulaLarga}>{tendencias}</View>
        <View style={[styles.celulaEstreita, styles.celulaNoTopo]}>{acompanha}</View>
      </View>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    carregandoNota: {
      ...t.typography.body,
      color: t.colors.textSubtle,
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
    // `.home-grid{gap:20px}` — o valor é literal do mockup, entre o nosso
    // `md` (16) e o `lg` (24).
    grade: {
      gap: 20,
    },
    gradeLinha: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 20,
    },
    /**
     * Proporção, não largura fixa: o mockup pede `1.4fr 1fr`, e uma coluna
     * fixa de 360px não acompanharia o teto de 1600px desta tela.
     *
     * `minWidth: 0` porque o conteúdo (gráfico, nome longo) senão segura a
     * célula acima da fração que lhe cabe e a proporção deixa de valer.
     */
    celulaLarga: {
      flex: 1.4,
      minWidth: 0,
    },
    celulaEstreita: {
      flex: 1,
      minWidth: 0,
    },
    celulaMeia: {
      flex: 1,
      minWidth: 0,
    },
    /**
     * Ancora o cartão no topo da linha em vez de esticá-lo até a altura do
     * vizinho: `alignItems:"stretch"` da linha é o padrão e é o que criava o
     * vão morto no "Quem me acompanha".
     */
    celulaNoTopo: {
      alignSelf: "flex-start",
    },
    // `.sess-hero{gap:14px; padding:36px 32px; min-height:260px}`.
    heroi: {
      gap: 14,
      justifyContent: "center",
      minHeight: 260,
      overflow: "hidden",
      paddingHorizontal: 32,
      paddingVertical: 36,
    },
    // `.sess-hero{padding:28px 22px; min-height:220px}` no celular.
    heroiMovel: {
      minHeight: 220,
      paddingHorizontal: 22,
      paddingVertical: 28,
    },
    // `.sess-hero .wavefield{position:absolute; inset:auto 0 -8px 0}`.
    heroiOnda: {
      bottom: -8,
      left: 0,
      pointerEvents: "none",
      position: "absolute",
      right: 0,
    },
    // `.sess-hero .row{margin-top:6px; position:relative; z-index:2}` — a
    // fileira sobe por cima da onda em vez de empurrá-la para baixo.
    heroiAcoes: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 6,
      zIndex: 2,
    },
    /**
     * `.sess-hero .row{flex-direction:column; align-items:stretch}` no celular,
     * com `.row .btn{width:100%}`.
     *
     * O `flexWrap:"wrap"` **precisa** sair junto: numa coluna que quebra, o
     * eixo transversal passa a ser a largura da *linha do wrap* — que é a do
     * conteúdo — e o `stretch` esticava o botão até 144px em vez dos 292 do
     * contêiner. Foi o que segurou o botão do tamanho do rótulo no celular.
     */
    heroiAcoesMovel: {
      alignItems: "stretch",
      alignSelf: "stretch",
      flexDirection: "column",
      flexWrap: "nowrap",
    },
    // `.sess-hero h2` e `p` param nos 420px, e não na largura do cartão.
    heroiTitulo: {
      ...t.typography.title,
      color: t.colors.text,
      maxWidth: 420,
    },
    heroiTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 420,
    },
    heroiNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    // `<p style="margin-top:14px">` do mockup.
    ultimaLink: {
      alignSelf: "flex-start",
      marginTop: 14,
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
      color: t.colors.textSubtle,
      flexShrink: 1,
      lineHeight: 17,
      maxWidth: 190,
    },
    ultimaMeta: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
    figuraLegenda: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      marginTop: t.spacing.sm,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    // O `.pcard` como linha: a borda só aparece no realce, mas o espaço dela
    // é reservado desde o começo — senão a linha pula 2px ao passar o mouse.
    acompanhante: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: t.radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: t.spacing.sm,
      padding: t.spacing.sm,
      ...transicao("background-color, border-color, transform, box-shadow", motion.rapida),
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
      color: t.colors.textSubtle,
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
      color: t.colors.textSubtle,
      lineHeight: 17,
    },
    notasVazio: {
      alignItems: "center",
      gap: t.spacing.sm,
    },
    notaVazio: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 13,
      textAlign: "center",
    },
  });
