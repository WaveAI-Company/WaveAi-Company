import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getMyReport, type LongitudinalReport as Report } from "../../src/api/report";
import {
  dias,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  listMyResultsPage,
  ordenarPorData,
  type PeriodoOpcao,
  type SessionResult,
} from "../../src/api/results";
import { capturaDisponivel } from "../../src/capture/availability";
import { Button } from "../../src/components/Button";
import { Disclaimer } from "../../src/components/Disclaimer";
import { EmptyState } from "../../src/components/EmptyState";
import { LongitudinalReport } from "../../src/components/LongitudinalReport";
import { Pagination } from "../../src/components/Pagination";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SegmentedFilter } from "../../src/components/SegmentedFilter";
import { SessionAnnotation } from "../../src/components/SessionAnnotation";
import { SessionsDashboard } from "../../src/components/SessionsDashboard";
import { SessionRow } from "../../src/components/sessions/SessionRow";
import { Skeleton } from "../../src/components/Skeleton";
import { StateView } from "../../src/components/StateView";
import {
  larguras,
  useFaixa,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../src/theme";

/** A partir daqui a linha do tempo e o resumo ficam lado a lado. */
// `.sess-grid` do mockup: `minmax(0,1fr) 320px` acima de 1199, uma coluna
// abaixo.

/**
 * Sessões por página da linha do tempo.
 *
 * 12 e não 10: com uma captação por dia, doze cobrem um mês inteiro, que é a
 * unidade de agrupamento da própria lista — um "carregar mais" que traz menos
 * que um mês faria o cabeçalho de mês repetir sem nada novo embaixo.
 */
const POR_PAGINA = 12;

/** Rótulos como o mockup do paciente escreve (`sessoes.html:342`). */
const PERIODOS: Array<{ value: PeriodoOpcao; label: string }> = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "tudo", label: "Tudo" },
];

/** Agrupa por mês, do mais recente para o mais antigo. */
function porMes(results: SessionResult[]): Array<{ titulo: string; sessoes: SessionResult[] }> {
  const grupos = new Map<string, SessionResult[]>();
  // `results` chega do mais antigo ao mais recente; a linha do tempo lê ao contrário.
  for (const r of [...results].reverse()) {
    const d = new Date(r.created_at);
    const chave = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const atual = grupos.get(chave);
    if (atual) atual.push(r);
    else grupos.set(chave, [r]);
  }
  return [...grupos.entries()].map(([chave, sessoes]) => {
    const [ano, mes] = chave.split("-").map(Number);
    const nome = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long" });
    return {
      titulo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`,
      sessoes,
    };
  });
}

/**
 * Histórico e tendências do paciente — porte de `Design/round1/sessoes.html`
 * (ADR-0042).
 *
 * Lê os `Result` reais do titular (#15). Sem sessões, mostra vazio honesto —
 * antes havia mock aqui, mas exibir sessão fictícia ao lado de medição real
 * confundiria as duas coisas.
 */
export default function PatientHistoryScreen() {
  const t = useTheme();
  const papel = useRoleAccent();
  const router = useRouter();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const faixa = useFaixa();
  const emColunas = faixa === "largo";
  /** No tablet só a primeira linha do panorama divide ao meio. */
  const emMeio = faixa === "medio";

  const [results, setResults] = useState<SessionResult[]>([]);
  /** Não há sessão nenhuma na conta — diferente de "nenhuma neste recorte". */
  const [semNenhuma, setSemNenhuma] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Padrão **30 dias**, como o design marca (`sessoes.html`, botão com `.on`).
   * O estado vazio diz explicitamente como ver tudo — sem isso, quem capta de
   * vez em quando abriria a tela vazia e leria "perdi meus dados".
   */
  const [periodo, setPeriodo] = useState<PeriodoOpcao>("30");

  /**
   * Trocar de período **volta para a primeira página**: 90 dias tem mais
   * páginas que 30, e ficar na página 4 ao encolher o recorte abriria uma
   * página que não existe mais — lista vazia sem explicação.
   */
  const trocarPeriodo = useCallback((novo: PeriodoOpcao) => {
    setPeriodo(novo);
    setPagina(1);
  }, []);

  /**
   * Total do período, do servidor — **não** `results.length`, que conta só o
   * que já foi carregado. É ele que rotula "12 de 40" e decide se ainda há o
   * que buscar.
   */
  const [total, setTotal] = useState(0);
  /** Página atual, começando em 1. Trocar de período volta para a primeira. */
  const [pagina, setPagina] = useState(1);
  const [trocandoPagina, setTrocandoPagina] = useState(false);
  /**
   * Sessão mais recente do **período**, buscada à parte (`limit:1`).
   *
   * Não sai de `results`: com a lista paginada, `results` é a página aberta, e
   * na página 3 a "última sessão" viraria uma do meio do recorte — a tela
   * afirmando o que não é verdade (ADR-0027). Uma linha a mais no servidor
   * custa menos que um painel que mente.
   */
  const [ultimaDoPeriodo, setUltimaDoPeriodo] = useState<SessionResult | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [atual, maisNova] = await Promise.all([
        listMyResultsPage(dias(periodo), {
          limit: POR_PAGINA,
          offset: (pagina - 1) * POR_PAGINA,
        }),
        // A mais recente do recorte, independente da página aberta.
        listMyResultsPage(dias(periodo), { limit: 1 }),
      ]);
      const dados = atual.results;
      setResults(dados);
      setTotal(atual.total);
      setUltimaDoPeriodo(maisNova.results[maisNova.results.length - 1] ?? null);
      /**
       * Vazio **no recorte** não diz se a pessoa nunca captou: a lista já vem
       * filtrada do servidor (P9-b), então "zero em 30 dias" e "zero desde
       * sempre" chegam idênticos aqui. Como a tela abre em 30 dias, quem nunca
       * captou via a mensagem de recorte — "escolha Tudo para ver o histórico
       * inteiro" — em vez do convite à primeira sessão, e o convite só
       * aparecia para quem fosse mexer no filtro.
       *
       * Uma segunda leitura, **só quando a primeira volta vazia**, desfaz o
       * empate. Já em "Tudo" a resposta é a própria lista.
       */
      setSemNenhuma(
        dados.length > 0
          ? false
          : periodo === "tudo" ||
            // `limit: 1` porque a pergunta é "existe alguma?", e não "quais".
            // Baixar o histórico inteiro para responder sim/não decifraria (e
            // auditaria) tudo por causa de um booleano.
            (await listMyResultsPage(dias("tudo"), { limit: 1 })).total === 0,
      );
    } catch {
      setErro("Não foi possível carregar suas sessões.");
    } finally {
      setLoading(false);
      setTrocandoPagina(false);
    }
    // O relatório depende da Analysis estar de pé; sua falha (ex.: 503) não pode
    // esconder as sessões — por isso carrega à parte e some sem alarde.
    try {
      setReport(await getMyReport(dias(periodo)));
    } catch {
      setReport(null);
    }
  }, [periodo, pagina]);

  /**
   * Troca de página: **substitui** a lista.
   *
   * Substituir e não acrescentar é o que o controle de setas promete: "Página
   * 2 de 3" com as duas primeiras ainda na tela seria um rótulo falso. O
   * carregamento em si mora no `carregar`, que já observa `pagina`.
   */
  const irParaPagina = useCallback((alvo: number) => {
    setTrocandoPagina(true);
    setPagina(alvo);
  }, []);

  // Recarrega **ao focar**, não só ao montar: voltando de uma captação, a
  // sessão recém-encerrada precisa aparecer sem recarregar o app (#17).
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  // O recorte é do **servidor** (P9-b): `results` já vem só com a janela
  // pedida. Antes o filtro era do cliente e a tela misturava dois períodos —
  // sessões filtradas aqui, qualidade e tendências vindas do histórico inteiro.
  const filtradas = results;

  /**
   * Resumo do período: médias **descritivas**, sem veredito (ADR-0027).
   *
   * Todos os cinco vêm do **servidor**, sobre o período inteiro — nenhum é
   * derivado de `results`, que agora é só a página carregada. Somar a página
   * diria "12 sessões" num recorte de 40, e a linha de tendência mudaria de
   * forma a cada "carregar mais": a tela afirmando o que não é verdade.
   *
   * `null` em qualquer um deles lê-se **"não sei"** (o relatório não veio, ou
   * a Analysis está fora) e a linha mostra "—". Nunca zero: zero afirmaria uma
   * medição que ninguém fez.
   */
  const resumo = useMemo(
    () => ({
      sessoes: total,
      tempo: report?.total_duration_seconds ?? null,
      alfaMedio: report?.report.features?.rel_alpha?.mean ?? null,
      qualidade: report?.report.quality?.mean ?? null,
      comAutorrelato: report?.annotation_count ?? null,
    }),
    [total, report],
  );

  /**
   * Pontos da tendência, do período inteiro. Vêm da série do relatório, e não
   * de `results`, pelo mesmo motivo do resumo. Sem relatório, `undefined` faz
   * o painel voltar a derivar da lista — degradação honesta: com a lista
   * inteira carregada (períodos curtos) o desenho é o mesmo.
   */
  const tendenciaDoPeriodo = useMemo(
    () =>
      report?.series?.map((ponto) => ({
        value: ponto.features.rel_alpha,
        label: formatDate(ponto.at),
      })).filter((p) => typeof p.value === "number"),
    [report],
  );

  const grupos = useMemo(() => porMes(filtradas), [filtradas]);
  /**
   * "Nunca captou" e "captou, mas não neste recorte" são coisas diferentes — e
   * confundi-las diria a alguém com histórico que ela não tem nenhum. O convite
   * da primeira sessão só aparece com o período em "Tudo".
   */
  const pronto = !loading && !erro;
  const nuncaCaptou = pronto && results.length === 0 && semNenhuma;
  //: A moldura (título + seletor) fica de pé mesmo com a janela vazia: é ela
  //: que dá a saída do recorte. Escondê-la prenderia a pessoa no filtro.
  const temSessoes = pronto && !nuncaCaptou;

  return (
    <ScreenContainer largura="app">
      {loading ? (
        <>
          <Text style={styles.carregandoNota}>Buscando suas sessões no servidor…</Text>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.esqueletoLinha}>
              <Skeleton width={52} height={56} radius={t.radius.md} />
              <View style={styles.esqueletoMeta}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="65%" height={12} />
              </View>
              <Skeleton width={140} height={14} />
            </View>
          ))}
        </>
      ) : null}

      <StateView error={erro} />

      {/* Vazio: convite, não erro — a tela ainda não tem o que mostrar. */}
      {nuncaCaptou ? (
        <EmptyState
          adorno={{ tipo: "figura" }}
          titulo="Seu histórico começa na primeira onda"
          texto="Cada sessão que você fizer aparece aqui, com composição por banda, qualidade do sinal e as suas notas de contexto — uma linha do tempo do seu bem-estar."
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
            capturaDisponivel()
              ? undefined
              : "A captação acontece no app do celular. Por aqui você acompanha o histórico assim que a primeira sessão existir."
          }
        />
      ) : null}

      {temSessoes ? (
        <>
          <View style={styles.topo}>
            <View style={styles.topoTextos}>
              <Text style={styles.titulo}>Suas sessões</Text>
              <Text style={styles.subtitulo}>
                {/* O mockup diz "mostrando 8 de 12", mas o total só existiria
                    com uma segunda busca sem recorte — pedir o histórico
                    inteiro só para exibir um número desfaria a minimização que
                    o corte no servidor comprou. Dizemos o que sabemos. */}
                {/* `total` e não `results.length`: a contagem é do **período**,
                    e `results` virou a página carregada. Dizer "12 sessões nos
                    últimos 30 dias" com 29 no recorte seria a tela afirmando o
                    que não é verdade (ADR-0027). */}
                {`${total} ${total === 1 ? "sessão" : "sessões"}`}
                {periodo === "tudo" ? "" : ` nos últimos ${periodo} dias`}
              </Text>
            </View>
            <SegmentedFilter
              label="Período"
              options={PERIODOS}
              value={periodo}
              onChange={trocarPeriodo}
              accent={papel.accent}
            />
          </View>

          <View style={[styles.grade, emColunas && styles.gradeLinha]}>
            <View style={[styles.coluna, emColunas && styles.colunaLinha]}>
              {filtradas.length === 0 ? (
                <Panel>
                  <Text style={styles.semResultado}>
                    Nenhuma sessão nos últimos {periodo} dias. Você pode ter captado
                    antes — escolha “Tudo” para ver o histórico inteiro.
                  </Text>
                </Panel>
              ) : (
                grupos.map((grupo) => (
                  <View key={grupo.titulo} style={styles.grupo}>
                    <View style={styles.grupoCabecalho}>
                      <Text style={styles.grupoTitulo}>{grupo.titulo}</Text>
                      <View style={styles.grupoRegua} />
                    </View>
                    {grupo.sessoes.map((r) => (
                      <SessionRow key={r.id} result={r} />
                    ))}
                  </View>
                ))
              )}
              {/* A contagem fica **fora** do controle: "12 de 29" responde
                  quanto do recorte se está vendo, e "Página 2 de 3" responde
                  onde se está. São perguntas diferentes e o rodapé responde as
                  duas. */}
              {temSessoes ? (
                <>
                  <Text style={styles.maisContagem}>
                    {`${results.length} de ${total} ${total === 1 ? "sessão" : "sessões"}`}
                  </Text>
                  <Pagination
                    pagina={pagina}
                    totalPaginas={Math.ceil(total / POR_PAGINA)}
                    onChange={irParaPagina}
                    label="Sessões"
                    ocupado={trocandoPagina}
                  />
                </>
              ) : null}
            </View>

            <View style={[styles.trilho, emColunas && styles.trilhoLateral]}>
              <Panel
                title="Resumo do período"
                eyebrow={periodo === "tudo" ? "tudo" : `${periodo} dias`}
              >
                <ResumoLinha rotulo="Sessões" valor={String(resumo.sessoes)} />
                <ResumoLinha
                  rotulo="Tempo captado"
                  valor={resumo.tempo !== null ? (formatDuration(resumo.tempo) ?? "—") : "—"}
                />
                <ResumoLinha
                  rotulo="Qualidade média do sinal"
                  valor={
                    resumo.qualidade !== null ? `${formatNumber(resumo.qualidade, 2)} (0–1)` : "—"
                  }
                />
                <ResumoLinha
                  rotulo="Alfa relativa média"
                  valor={resumo.alfaMedio !== null ? formatPercent(resumo.alfaMedio) : "—"}
                  cor={t.colors.bandAlpha}
                />
                <ResumoLinha
                  rotulo="Sessões com autorrelato"
                  valor={
                    resumo.comAutorrelato !== null ? String(resumo.comAutorrelato) : "—"
                  }
                />
                <Text style={styles.resumoNota}>
                  Médias descritivas do período — sem veredito. As bandas não têm valência.
                </Text>
              </Panel>

              {capturaDisponivel() ? (
                <Button
                  label="Iniciar nova sessão"
                  onPress={() => router.push("/patient/live")}
                  accent={papel.accent}
                />
              ) : null}
            </View>
          </View>

          {/**
           * O panorama, depois da lista. Esta área **não tem mockup**.
           *
           * Três faixas, e o critério mudou: era "quem ganha com largura"
           * (`1.4fr 1fr`, o gráfico e o texto na coluna larga). Agora a
           * tendência de alfa fica **sozinha na linha inteira** — é a figura
           * da tela e não divide com ninguém — e os outros quatro cartões se
           * emparelham **meio a meio**, cada par numa linha. Decisão do
           * fundador em 2026-08-16.
           *
           * Só no desktop: abaixo de 1200 todos voltam à linha inteira, e o
           * "Panorama das sessões" agradece — é texto corrido, e meia coluna
           * estreita o transforma em coluna de jornal.
           */}
          <SessionsDashboard
            results={results}
            trend={tendenciaDoPeriodo}
            showAllSessions={false}
            showLast={false}
          />

          {/* `grow` nos dois lados de cada par: a célula já é esticada pela
              linha, mas o painel dentro dela parava na altura do conteúdo e
              cada linha terminava em degrau. */}
          <View style={[styles.panorama, emColunas && styles.panoramaLinha]}>
            <View style={emColunas ? styles.panoramaMetade : undefined}>
              <SessionsDashboard
                results={results}
                last={ultimaDoPeriodo}
                showAllSessions={false}
                showTrend={false}
                grow={emColunas}
              />
            </View>
            {report && report.n_sessions > 0 ? (
              <View style={emColunas ? styles.panoramaMetade : undefined}>
                <LongitudinalReport report={report} showSummary={false} grow={emColunas} />
              </View>
            ) : null}
          </View>

          <View style={[styles.panorama, emColunas && styles.panoramaLinha]}>
            {report && report.n_sessions > 0 ? (
              <View style={emColunas ? styles.panoramaMetade : undefined}>
                <LongitudinalReport report={report} showFeatureTrends={false} grow={emColunas} />
              </View>
            ) : null}

            {/* Anotação de contexto (P2, ADR-0037) da sessão mais recente.
                Último cartão da página, na coluna da direita. */}
            {(() => {
              const alvo = ultimaDoPeriodo;
              return alvo ? (
                <View style={emColunas ? styles.panoramaMetade : undefined}>
                  <Panel title="Nota de contexto" eyebrow="sessão mais recente" grow>
                    <SessionAnnotation sessionId={alvo.session_id} mode="edit" embedded />
                  </Panel>
                </View>
              ) : null;
            })()}
          </View>
        </>
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

/** Linha do resumo: rótulo à esquerda, valor à direita. */
function ResumoLinha({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  return (
    <View style={styles.resumoLinha}>
      <Text style={styles.resumoRotulo}>{rotulo}</Text>
      <Text style={[styles.resumoValor, cor ? { color: cor } : null]}>{valor}</Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    carregandoNota: {
      ...t.typography.body,
      color: t.colors.textSubtle,
      fontSize: 14,
    },
    esqueletoLinha: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderSoft,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.spacing.md,
    },
    esqueletoMeta: {
      flex: 1,
      gap: t.spacing.sm,
    },
    topo: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
    },
    topoTextos: {
      flex: 1,
      gap: 2,
      minWidth: 180,
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    subtitulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    grade: {
      gap: t.spacing.md,
    },
    gradeLinha: {
      alignItems: "flex-start",
      flexDirection: "row",
    },
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
    // ---------- panorama (área sem mockup) ----------
    // Gap de 20, como na home do paciente.
    panorama: {
      gap: 20,
    },
    panoramaLinha: {
      alignItems: "stretch",
      flexDirection: "row",
    },
    // Meio a meio: `flexBasis:0` para a divisão sair da fração e não do
    // conteúdo — um dos pares tem um gráfico de um lado e uma lista do outro.
    panoramaMetade: {
      flexBasis: 0,
      flexGrow: 1,
      minWidth: 0,
    },
    trilho: {
      gap: t.spacing.md,
    },
    trilhoLateral: {
      flexGrow: 0,
      flexShrink: 0,
      width: larguras.trilhoSessoes,
    },
    maisContagem: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      paddingTop: t.spacing.md,
      textAlign: "center",
    },
    grupo: {
      gap: t.spacing.sm,
    },
    grupoCabecalho: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    grupoTitulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    grupoRegua: {
      backgroundColor: t.colors.borderSoft,
      flex: 1,
      height: 1,
    },
    resumoLinha: {
      alignItems: "center",
      borderBottomColor: t.colors.borderSoft,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: t.spacing.sm,
      justifyContent: "space-between",
      paddingVertical: t.spacing.sm,
    },
    resumoRotulo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
    },
    resumoValor: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    resumoNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    // Filtro sem resultado não é o herói de "nunca captou": quem já tem
    // sessões precisa de uma linha, não de um convite à primeira onda.
    semResultado: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 460,
      textAlign: "center",
    },
  });
