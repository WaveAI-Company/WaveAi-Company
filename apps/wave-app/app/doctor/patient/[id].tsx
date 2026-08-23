import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { listCareLinks, type CareLink } from "../../../src/api/care";
import { watchPatientLive } from "../../../src/api/liveWatch";
import { getPatientReport, type LongitudinalReport as Report } from "../../../src/api/report";
import {
  dias,
  formatDate,
  formatNumber,
  formatPercent,
  listPatientResultsPage,
  ordenarPorData,
  type PeriodoOpcao,
  type SessionResult,
} from "../../../src/api/results";
import { Avatar } from "../../../src/components/Avatar";
import { Button } from "../../../src/components/Button";
import { Chip } from "../../../src/components/Chip";
import { Disclaimer } from "../../../src/components/Disclaimer";
import { LiveSpectator } from "../../../src/components/LiveSpectator";
import { LongitudinalReport } from "../../../src/components/LongitudinalReport";
import { Panel } from "../../../src/components/Panel";
import { Select } from "../../../src/components/Select";
import { diaMes } from "../../../src/format/date";
import { ScreenContainer } from "../../../src/components/ScreenContainer";
import { SearchField } from "../../../src/components/SearchField";
import { SessionAnnotation } from "../../../src/components/SessionAnnotation";
import { SessionsDashboard } from "../../../src/components/SessionsDashboard";
import { WaveField } from "../../../src/components/brand/WaveField";
import { Skeleton } from "../../../src/components/Skeleton";
import { BandColumns, type BandColumn } from "../../../src/components/charts/BandColumns";
import { BandLegend } from "../../../src/components/charts/BandLegend";
import { TrendChart, type TrendPoint } from "../../../src/components/charts/TrendChart";
import {
  anelFoco,
  grudarNoTopo,
  larguras,
  motion,
  semContornoNativo,
  transicao,
  useFaixa,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../../src/theme";

/** A partir daqui o trilho de pessoas fica ao lado do conteúdo. */
// `.pro-wrap` do mockup: `280px minmax(0,1fr)` acima de 1199, uma coluna
// abaixo.
/** Quantas sessões entram nos gráficos do painel. */
const JANELA = 8;

/** Sessão mais recente (por data) — alvo da anotação lida na tela do médico. */
function maisRecente(results: SessionResult[]): SessionResult | null {
  return results.reduce<SessionResult | null>(
    (mr, r) => (mr === null || r.created_at > mr.created_at ? r : mr),
    null,
  );
}

/** Rótulos como o mockup do profissional escreve (`painel-profissional.html`). */
const PERIODOS: Array<{ value: PeriodoOpcao; label: string }> = [
  { value: "30", label: "últimos 30 dias" },
  { value: "90", label: "últimos 90 dias" },
  { value: "tudo", label: "tudo" },
];

/** Normaliza para busca: sem acento, sem caixa. */
function chave(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Painel do profissional — porte de `Design/round1/painel-profissional.html`
 * (ADR-0024/0027/0035/0039/0042).
 *
 * Cockpit de **uma pessoa**: quem autorizou, o que ela mede, o que o servidor
 * resume e o que ela mesma escreveu. Os dados vêm da API, que devolve **403 sem
 * vínculo ativo** — a autorização é do servidor, esta tela só reflete o
 * resultado, e cada leitura fica **auditada** (ADR-0026/0037).
 *
 * O trilho da esquerda troca de pessoa sem passar pela lista. Ele mostra
 * **apenas nomes e situação**: pôr ali "12 sessões" ou "última sessão" custaria
 * uma leitura auditada por pessoa a cada visita — a mesma razão que manteve os
 * cartões do início do profissional sem números.
 */
/**
 * Sessões por página da lista "Todas as sessões".
 *
 * Cada página é uma **leitura auditada em nome do titular** por quem não é o
 * titular, então o tamanho não é só desempenho: doze é o que cobre um mês de
 * captação diária sem obrigar a folhear, e sem trazer o ano inteiro de uma vez.
 */
const POR_PAGINA = 12;

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const faixa = useFaixa();
  const comTrilho = faixa === "largo";
  const estiloTile =
    faixa === "largo"
      ? styles.tileLargo
      : faixa === "medio"
        ? styles.tileMedio
        : styles.tileEstreito;

  const [vinculos, setVinculos] = useState<CareLink[]>([]);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  /** Assistir ao vivo é opt-in: só ao ativar é que se assina (e audita). */
  const [assistindo, setAssistindo] = useState(false);
  /**
   * Recorte de período (P9-b), o quarto tile do mockup. O corte é do
   * **servidor**: sessões, gráficos e relatório saem todos da mesma janela —
   * senão a tela misturaria dois períodos diferentes no mesmo painel.
   */
  const [periodo, setPeriodo] = useState<PeriodoOpcao>("30");
  /** Total do período, do servidor — `results` é só a página carregada. */
  const [total, setTotal] = useState(0);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    try {
      // `listCareLinks` não lê dado de ninguém — não entra na trilha de acesso.
      const [links, pagina] = await Promise.all([
        listCareLinks(),
        listPatientResultsPage(id, dias(periodo), { limit: POR_PAGINA }),
      ]);
      setVinculos(links);
      setResults(pagina.results);
      setTotal(pagina.total);
    } catch {
      // Cobre 403 (vínculo revogado enquanto a tela estava aberta) e falhas
      // de rede: em ambos os casos não há o que mostrar.
      setErro("Não foi possível abrir esta pessoa. O acompanhamento pode ter sido revogado.");
    } finally {
      setCarregando(false);
    }
    // O relatório depende da Analysis; sua falha não pode blindar o resto da
    // tela — carrega à parte e some sem alarde.
    try {
      setReport(await getPatientReport(id, dias(periodo)));
    } catch {
      setReport(null);
    }
  }, [id, periodo]);

  /**
   * Próxima página da lista "Todas as sessões".
   *
   * Aqui o peso é maior que no histórico do titular: **cada página é uma
   * leitura auditada em nome de quem não é o titular** (emenda à ADR-0037 de
   * 2026-08-22). Por isso a página só vem quando o profissional pede — nada de
   * buscar adiante "por via das dúvidas".
   */
  const carregarMais = useCallback(async () => {
    if (!id) return;
    setCarregandoMais(true);
    try {
      const pagina = await listPatientResultsPage(id, dias(periodo), {
        limit: POR_PAGINA,
        offset: results.length,
      });
      setResults((atuais) => {
        const vistos = new Set(atuais.map((r) => r.id));
        return ordenarPorData([...atuais, ...pagina.results.filter((r) => !vistos.has(r.id))]);
      });
      setTotal(pagina.total);
    } catch {
      // A lista já na tela continua válida; alarmar aqui sugeriria o contrário.
    } finally {
      setCarregandoMais(false);
    }
  }, [id, periodo, results.length]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Trocar de PESSOA fecha o ao vivo (a assinatura é por paciente e o opt-in é
  // deliberado). Trocar de PERÍODO não: o recorte é do histórico, e derrubar a
  // transmissão por causa dele seria efeito colateral sem relação.
  useEffect(() => {
    setAssistindo(false);
  }, [id]);

  const ativos = vinculos.filter((v) => v.status === "active");
  const pendentes = vinculos.filter((v) => v.status === "pending");
  const atual = ativos.find((v) => v.counterpart_user_id === id) ?? null;
  const nome = atual?.counterpart_display_name ?? "Paciente";

  const filtro = chave(busca.trim());
  const casa = (v: CareLink) =>
    filtro.length === 0 || chave(v.counterpart_display_name ?? "").includes(filtro);

  // Últimas N sessões para os gráficos.
  const recentes = useMemo(() => results.slice(-JANELA), [results]);

  const tendenciaAlfa: TrendPoint[] = recentes
    .filter((r) => typeof r.metrics?.rel_alpha === "number")
    .map((r) => ({
      value: r.metrics.rel_alpha as number,
      label: diaMes(r.created_at),
    }));

  const colunas: BandColumn[] = recentes
    .filter((r) => r.metrics?.relative_band_powers)
    .map((r) => ({
      label: diaMes(r.created_at),
      relative: r.metrics.relative_band_powers ?? {},
    }));

  const ultima = maisRecente(results);
  const qualidadeMedia = report?.report.quality?.mean;
  //: Intervalo **observado** (primeira e última sessão que entraram) — coisa
  //: diferente da janela **pedida**, que é o `periodo` do seletor. O design
  //: mostra os dois: o rótulo da opção no seletor, o intervalo real embaixo.
  const intervaloObservado = report?.period
    ? `${formatDate(report.period.first)} – ${formatDate(report.period.last)}`
    : null;

  /**
   * Tile de número — um fato por painel, como no design.
   *
   * O mockup põe quatro por linha e cai para duas em 1280; aqui são **três**
   * fatos (o quarto do mockup era o motor de análise, que já vive no rastro do
   * rodapé), então a faixa larga divide a linha em três em vez de deixar um
   * buraco na grade.
   */
  const tile = (rotulo: string, valor: string, sub?: string) => (
    <View key={rotulo} style={[styles.tile, estiloTile]}>
      <Panel grow>
        <Text style={styles.tileRotulo}>{rotulo}</Text>
        <Text style={styles.tileValor}>{valor}</Text>
        {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
      </Panel>
    </View>
  );

  const trilho = (
    <Panel>
      <SearchField
        value={busca}
        onChangeText={setBusca}
        label="Buscar pessoa"
        placeholder="Buscar pessoa"
      />

      {ativos.filter(casa).map((v) => (
        <LinhaPessoa
          key={v.id}
          nome={v.counterpart_display_name}
          selecionado={v.counterpart_user_id === id}
          accent={accent}
          styles={styles}
          onPress={() => router.replace(`/doctor/patient/${v.counterpart_user_id}`)}
        />
      ))}

      {/* Pendentes aparecem, mas não abrem nada: convite pendente não concede
          acesso (ADR-0024), então um item clicável mentiria. */}
      {pendentes.filter(casa).map((v) => (
        <View key={v.id} style={[styles.pessoa, styles.pessoaPendente]}>
          <Avatar name={v.counterpart_display_name} size={36} tone={t.colors.textMuted} />
          <View style={styles.pessoaTextos}>
            <Text style={styles.pessoaNome} numberOfLines={1}>
              {v.counterpart_display_name ?? "Convite enviado"}
            </Text>
            <Text style={styles.pessoaNota} numberOfLines={1}>
              convite pendente — aguarda a pessoa
            </Text>
          </View>
        </View>
      ))}
    </Panel>
  );

  if (carregando) {
    return (
      <ScreenContainer largura="painel">
        <Skeleton width={64} height={64} radius={32} />
        <Skeleton width={260} height={28} />
        <Skeleton width={340} height={14} />
        <Panel>
          <Skeleton width="40%" height={18} />
          <Skeleton width="100%" height={160} />
        </Panel>
      </ScreenContainer>
    );
  }

  if (erro) {
    return (
      <ScreenContainer largura="painel">
        <Text style={styles.erro} accessibilityRole="alert">
          {erro}
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer largura="painel">
      <View style={[styles.grade, comTrilho && styles.gradeLinha]}>
        {comTrilho ? <View style={styles.colunaTrilho}>{trilho}</View> : null}

        <View style={styles.conteudo}>
          {/* Em tela estreita o trilho vai para cima, empilhado. O mockup faz
              dele uma tira que desliza na horizontal; aqui a lista vertical
              custa menos e não esconde nome atrás de arrasto. */}
          {!comTrilho ? trilho : null}

          {/* ===== cabeçalho da pessoa ===== */}
          <View style={styles.cabeca}>
            <Avatar name={nome} size={56} tone={accent} />
            <View style={styles.cabecaTextos}>
              <Text style={styles.nome}>{nome}</Text>
              <Text style={styles.cabecaNota}>
                {atual?.consented_at
                  ? `autorizou seu acesso em ${formatDate(atual.consented_at)} · pode revogar a qualquer momento`
                  : "pode revogar o acesso a qualquer momento"}
              </Text>
            </View>
            <Chip label="leitura · nunca edição" />
          </View>

          {/* ===== ao vivo (ADR-0039): opt-in ===== */}
          {assistindo && id ? (
            <LiveSpectator
              subscribe={(h) => watchPatientLive(id, h)}
              accent={accent}
              semCaptacaoTexto="Esta pessoa não está captando agora."
            />
          ) : (
            <Panel title="Ao vivo" eyebrow="acesso registrado" style={styles.cartaoVivo}>
              {/* `.live-banner`: a onda cobre o cartão (`inset:0`, meia
                  opacidade) e o conteúdo passa por cima com `z-index:2`. É o
                  único cartão do painel com fundo animado — o assunto dele é
                  justamente uma captação acontecendo agora. */}
              <WaveField
                height={140}
                opacity={0.5}
                amplitude={12}
                style={styles.ondaVivo}
              />
              <Text style={styles.nota}>
                Se esta pessoa estiver captando agora <Text style={styles.notaForte}>e
                tiver ligado o compartilhamento desta sessão</Text>, você acompanha as
                medidas em tempo real — nunca o sinal bruto. É um aceite separado, que
                ela liga e desliga na própria sessão, e o acesso fica registrado em
                trilha.
              </Text>
              <View style={[styles.acaoVivo, styles.acimaDaOnda]}>
                <Button
                  label="Acompanhar ao vivo"
                  onPress={() => setAssistindo(true)}
                  accent={accent}
                />
              </View>
            </Panel>
          )}

          {/* ===== tiles =====
              A linha aparece SEMPRE, inclusive com a janela vazia: é nela que
              mora o seletor de período, e escondê-la deixaria a pessoa presa
              num recorte sem nenhuma forma de sair dele. */}
          <View style={styles.tiles}>
            {tile(
              "Sessões no período",
              // Recuo para `total` (contagem do período) e não para
              // `results.length`, que agora é a página: sem relatório, o número
              // continua sendo o do recorte.
              String(report?.n_sessions ?? total),
              intervaloObservado ?? undefined,
            )}
            {tile(
              "Qualidade média do sinal",
              typeof qualidadeMedia === "number" ? formatNumber(qualidadeMedia, 2) : "—",
              "índice 0–1 calculado no servidor",
            )}
            {tile("Última sessão", ultima ? formatDate(ultima.created_at) : "—")}
            {/* O quarto tile do mockup (`painel-profissional.html:419`): o
                seletor de período, que faltava desde o porte. */}
            <View key="Período" style={[styles.tile, estiloTile]}>
              <Panel grow>
                <Text style={styles.tileRotulo}>Período</Text>
                <Select
                  label="Selecionar período"
                  options={PERIODOS}
                  value={periodo}
                  onChange={setPeriodo}
                  accent={accent}
                />
                {intervaloObservado ? (
                  <Text style={styles.tileSub}>{intervaloObservado}</Text>
                ) : null}
              </Panel>
            </View>
            {/* Espaçadores: sem eles um tile sozinho na última fila estica. */}
            {[0, 1, 2].map((i) => (
              <View key={`espaco-${i}`} style={[styles.espacador, estiloTile]} aria-hidden />
            ))}
          </View>

          {results.length === 0 ? (
            <Panel>
              <Text style={styles.nota}>
                {periodo === "tudo"
                  ? "Esta pessoa ainda não tem sessões guardadas. Elas aparecem aqui assim que ela captar — e só se tiver autorizado a guarda dos resultados."
                  : "Nenhuma sessão neste período. Ela pode ter captado antes — escolha “tudo” no seletor de período para ver o histórico inteiro."}
              </Text>
            </Panel>
          ) : (
            <>
              {/**
               * A ordem da tela, decidida pelo fundador em 2026-08-16.
               *
               * ```
               * [ alfa por sessão — linha inteira ]
               * [ composição por banda | panorama das sessões ]
               * [ tendências por medida | última sessão       ]
               * [ contexto da sessão — linha inteira ]
               * [ todas as sessões ]
               * ```
               *
               * O alfa sozinho porque é a figura da tela; os quatro do meio
               * emparelhados por peso (um gráfico ao lado de um texto, uma
               * lista ao lado de um cartão); e o contexto embaixo, inteiro,
               * porque é a fala da pessoa e não divide espaço com número.
               *
               * Abaixo de 1200 tudo volta à linha inteira, como no mockup —
               * lá o `.dash` cai para duas colunas e `span 2` é a linha toda.
               */}
              {tendenciaAlfa.length > 1 ? (
                <Panel
                  title="Alfa · % do espectro por sessão"
                  eyebrow={`últimas ${recentes.length} sessões`}
                >
                  <TrendChart
                    data={tendenciaAlfa}
                    accent={t.colors.bandAlpha}
                    formatValue={(v) => formatPercent(v, 0)}
                  />
                  <Text style={styles.nota}>
                    Proporção do alfa no espectro, sessão a sessão. Sem valência —
                    descreve, não avalia.
                  </Text>
                </Panel>
              ) : null}

              <View style={[styles.dupla, faixa === "largo" && styles.duplaLinha]}>
                {colunas.length > 1 ? (
                  <View style={faixa === "largo" ? styles.duplaCelula : undefined}>
                    <Panel
                      title="Composição por banda · % por sessão"
                      eyebrow="categórica · sem valência"
                      grow={faixa === "largo"}
                    >
                      <BandColumns columns={colunas} />
                      <BandLegend relative={ultima?.metrics?.relative_band_powers ?? {}} />
                      <Text style={styles.nota}>
                        Cada coluna vale 100% da própria sessão: a quantidade de sinal não
                        é comparável entre dias, a composição é.
                      </Text>
                    </Panel>
                  </View>
                ) : null}

                {report && report.n_sessions > 0 ? (
                  <View style={faixa === "largo" ? styles.duplaCelula : undefined}>
                    <LongitudinalReport
                      report={report}
                      showFeatureTrends={false}
                      grow={faixa === "largo"}
                    />
                  </View>
                ) : null}
              </View>

              <View style={[styles.dupla, faixa === "largo" && styles.duplaLinha]}>
                {report && report.n_sessions > 0 ? (
                  <View style={faixa === "largo" ? styles.duplaCelula : undefined}>
                    <LongitudinalReport
                      report={report}
                      showSummary={false}
                      grow={faixa === "largo"}
                    />
                  </View>
                ) : null}

                <View style={faixa === "largo" ? styles.duplaCelula : undefined}>
                  <SessionsDashboard
                    results={results}
                    showTrend={false}
                    showAllSessions={false}
                    grow={faixa === "largo"}
                  />
                </View>
              </View>

              {/* ===== nota de contexto (ADR-0037) ===== */}
              {(() => {
                const alvo = maisRecente(results);
                return alvo && id ? (
                  <SessionAnnotation sessionId={alvo.session_id} mode="read" patientId={id} />
                ) : null;
              })()}

              {/* A lista completa fecha a tela. Filtro e paginação dela estão
                  no backlog registrado no `Documentation/15`. */}
              <SessionsDashboard results={results} showTrend={false} showLast={false} />

              {/* A contagem diz o que está na tela **e** o que existe no
                  período. Cada "carregar mais" é uma leitura auditada em nome
                  do titular, então a página só vem quando se pede. */}
              {total > results.length ? (
                <View style={styles.maisLinha}>
                  <Text style={styles.maisContagem}>
                    {`${results.length} de ${total} ${total === 1 ? "sessão" : "sessões"}`}
                  </Text>
                  <Button
                    label={carregandoMais ? "Carregando…" : "Carregar mais"}
                    onPress={carregarMais}
                    variant="secondary"
                    compacto
                    largura="conteudo"
                    disabled={carregandoMais}
                  />
                </View>
              ) : null}

              <Text style={styles.rastro}>
                {[
                  ultima?.engine_version ? `motor ${ultima.engine_version}` : null,
                  "medidas calculadas no servidor WaveAI",
                  "cada leitura registrada em trilha de acesso",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </>
          )}

          <Disclaimer variant="profissional" />
        </View>
      </View>
    </ScreenContainer>
  );
}

/**
 * Uma pessoa na lista lateral — o `.person` do mockup, que ao ponteiro só
 * pinta o fundo. Sem deslocamento aqui de propósito: é uma linha de lista
 * densa, e um pulo por item transformaria percorrer a lista num tremor.
 */
function LinhaPessoa({
  nome,
  selecionado,
  accent,
  onPress,
  styles,
}: {
  nome: string | null | undefined;
  selecionado: boolean;
  accent: string;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const t = useTheme();
  const { estado, handlers } = useInteracao();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selecionado }}
      aria-current={selecionado ? "true" : undefined}
      accessibilityLabel={`${nome ?? "Paciente"}${selecionado ? ", em exibição" : ""}`}
      onPress={onPress}
      {...handlers}
      style={[
        styles.pessoa,
        selecionado && { backgroundColor: t.colors.surfaceAlt, borderColor: accent },
        !selecionado && estado.hovered && { backgroundColor: t.colors.surfaceAlt },
        estado.pressed && { backgroundColor: t.colors.surfaceStrong },
        estado.focoVisivel ? { boxShadow: anelFoco(accent, t.colors.surface) } : null,
      ]}
    >
      <Avatar name={nome} size={36} tone={accent} />
      <View style={styles.pessoaTextos}>
        <Text style={styles.pessoaNome} numberOfLines={1}>
          {nome ?? "Paciente"}
        </Text>
        <Text style={styles.pessoaNota} numberOfLines={1}>
          {selecionado ? "em exibição" : "autorizou seu acesso"}
        </Text>
      </View>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({

    maisLinha: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingTop: t.spacing.md,
    },
    maisContagem: {
      ...t.typography.caption,
      color: t.colors.textMuted,
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
    // Largura fixa com estilo **próprio**, sem `flex`: `flex: 1` vira
    // `flex-basis: 0%` no RN-web e vence a largura no eixo principal — foi
    // assim que a coluna lateral da home colapsou (#111).
    /**
     * `.people{position:sticky; top:88px}` — a lista de pessoas acompanha a
     * rolagem em vez de sumir no topo da página, que é o que permite trocar de
     * pessoa sem voltar ao começo.
     *
     * `position:"sticky"` é **web-only**; no nativo o RN ignora o valor e a
     * coluna se comporta como sempre. `alignSelf:"flex-start"` é o que impede
     * a coluna de esticar até o pé do conteúdo — esticada, não há o que colar.
     */
    colunaTrilho: {
      alignSelf: "flex-start",
      flexGrow: 0,
      flexShrink: 0,
      width: larguras.listaPessoas,
      ...grudarNoTopo(t.spacing.md),
    },
    conteudo: {
      flex: 1,
      gap: t.spacing.md,
      minWidth: 0,
    },
    pessoa: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: t.radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: t.spacing.sm,
      minHeight: t.minTouch,
      padding: t.spacing.sm,
      ...transicao("background-color, border-color, box-shadow", motion.media),
      ...semContornoNativo(),
    },
    pessoaPendente: {
      opacity: 0.7,
    },
    pessoaTextos: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    pessoaNome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontSize: 14,
    },
    pessoaNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
    cabeca: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
    },
    cabecaTextos: {
      flex: 1,
      gap: 2,
      minWidth: 200,
    },
    nome: {
      ...t.typography.title,
      color: t.colors.text,
    },
    cabecaNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    //: Realce dentro da nota: a condição que decide se o botão vai funcionar
    //: não pode ficar no mesmo peso do resto da frase.
    notaForte: {
      color: t.colors.textMuted,
      fontWeight: "600",
    },
    // Só o respiro: largura é assunto do `Button` desde o pente fino de UI.
    // `.live-banner{position:relative; overflow:hidden}`.
    cartaoVivo: {
      overflow: "hidden",
    },
    // `.live-banner .wavefield{position:absolute; inset:0; opacity:.5}`.
    ondaVivo: {
      bottom: 0,
      left: 0,
      pointerEvents: "none",
      position: "absolute",
      right: 0,
    },
    // `.live-banner > *{position:relative; z-index:2}`.
    acimaDaOnda: {
      zIndex: 2,
    },
    acaoVivo: {
      marginTop: t.spacing.xs,
    },
    tiles: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
    },
    // ---------- os quatro cartões grandes (`span 2` do `.dash`) ----------
    dupla: {
      gap: 20,
    },
    duplaLinha: {
      alignItems: "stretch",
      flexDirection: "row",
      flexWrap: "wrap",
    },
    // Metade menos a folga do `gap`: dois por linha, e o terceiro quebra.
    duplaCelula: {
      flexBasis: "48%",
      flexGrow: 1,
      minWidth: 0,
    },
    tile: {
      flexGrow: 1,
      minWidth: 0,
    },
    espacador: {
      flexGrow: 1,
      height: 0,
      marginBottom: -t.spacing.md,
      minWidth: 0,
    },
    /**
     * Quantos cabem por linha, por faixa. A base fica abaixo da fração exata
     * para o `gap` caber sem empurrar o último para a linha de baixo.
     *
     * **Quatro no desktop**, e não três: o `.dash` do mockup é
     * `repeat(4, minmax(0,1fr))`, e com 30% o quarto tile — o seletor de
     * período — caía sozinho para a linha seguinte.
     */
    tileLargo: { flexBasis: "22%" },
    tileMedio: { flexBasis: "46%" },
    tileEstreito: { flexBasis: "100%" },
    tileRotulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
    tileValor: {
      ...t.typography.title,
      color: t.colors.text,
      fontSize: 24,
    },
    tileSub: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
    },
    rastro: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      marginTop: t.spacing.xs,
      textAlign: "center",
    },
  });
