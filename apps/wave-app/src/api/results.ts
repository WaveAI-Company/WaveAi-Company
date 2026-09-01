/**
 * Leitura dos `Result` persistidos (ADR-0026).
 *
 * O paciente lê os próprios; o médico lê os de um paciente e a API exige
 * CareLink `active` (403 sem) e audita o acesso — a autorização é do servidor,
 * o app só reflete o resultado.
 */

import { request } from "../auth/api";

/** Bandas do `wave_eeg` (Hz) — rótulos para exibição, não interpretação. */
export const BANDS = [
  { key: "delta", label: "Delta", range: "0,5–4 Hz" },
  { key: "theta", label: "Teta", range: "4–8 Hz" },
  { key: "alpha", label: "Alfa", range: "8–13 Hz" },
  { key: "beta", label: "Beta", range: "13–30 Hz" },
  { key: "gamma", label: "Gama", range: "30–45 Hz" },
] as const;

export type BandKey = (typeof BANDS)[number]["key"];

/**
 * Qualidade do sinal — **sem limiar e sem veredito** de propósito. O que conta
 * como "bom o suficiente" ainda não está definido (Q-TEC-06); aqui só medimos.
 */
export type SignalQuality = {
  signal_std: number;
  mains_power: number;
  mains_power_ratio: number;
};

/** Espelha o `SessionReport` do engine (serializado em `metrics`). */
export type ResultMetrics = {
  engine_version?: string;
  fs?: number;
  n_samples?: number;
  band_powers?: Partial<Record<BandKey, number>>;
  relative_band_powers?: Partial<Record<BandKey, number>>;
  rel_alpha?: number;
  quality?: SignalQuality;
  comparison?: PhaseComparison | null;
};

/**
 * Contraste olhos abertos/fechados do protocolo guiado (ADR-0053).
 *
 * Vem calculado pelo `AnalysisEngine` — o app **só consome**. O `verdict` do
 * `wave_eeg` é texto interno em português; a tela **não** o exibe e decide por
 * `passed`, que é estrutural e não muda de redação.
 */
export type PhaseComparison = {
  eyes_closed_rel_alpha?: number;
  eyes_open_rel_alpha?: number;
  ratio?: number;
  p_value?: number;
  /** O padrão esperado apareceu de forma estatisticamente detectável. */
  passed?: boolean;
};

export type SessionResult = {
  id: string;
  session_id: string;
  engine_version: string;
  created_at: string;
  metrics: ResultMetrics;
  /**
   * Há autorrelato nesta sessão? **Só a existência** — o texto continua vindo
   * pela rota da anotação, que é auditada (emenda à ADR-0037).
   *
   * Opcional porque o campo nasceu depois do resto do contrato: uma resposta
   * antiga em cache não deve derrubar a tela, e ausência lê-se como "não sei",
   * que a UI trata igual a "não há" — o selo simplesmente não aparece.
   */
  has_annotation?: boolean;
};

type ResultsPayload = {
  results: SessionResult[];
  window_days: number | null;
  /** Total do **recorte inteiro**, não da página. Ausente em respostas antigas. */
  total?: number;
};

/**
 * Uma página da lista, com o total do período.
 *
 * O total vem separado de propósito: é ele que deixa a tela dizer "12 de 40"
 * sem baixar as 40. Nenhum agregado sai daqui — resumo, tendência e duração do
 * período vêm do relatório longitudinal, que enxerga a janela toda. Derivar
 * qualquer um deles desta página faria a tela afirmar o que não é verdade
 * (ADR-0027).
 */
export type ResultsPage = { results: SessionResult[]; total: number };

export type OpcoesDePagina = {
  limit?: number;
  offset?: number;
  /** Só sessões com autorrelato (o `has_annotation` que o selo já usa). */
  withAnnotation?: boolean;
};

function comPagina(path: string, days: Periodo, opcoes: OpcoesDePagina): string {
  const q = new URLSearchParams();
  if (days !== null) q.set("days", String(days));
  if (opcoes.limit !== undefined) q.set("limit", String(opcoes.limit));
  if (opcoes.offset) q.set("offset", String(opcoes.offset));
  if (opcoes.withAnnotation) q.set("with_annotation", "true");
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Recorte de período pedido ao servidor (P9-b). `null` = histórico inteiro.
 *
 * O corte é do **servidor**, não do cliente: quem pede 30 dias não recebe anos
 * de resultados para a tela esconder o resto — minimização de dados —, e a
 * trilha de acesso passa a contar o que a pessoa de fato viu.
 */
export type Periodo = number | null;

function comPeriodo(path: string, days: Periodo): string {
  return days === null ? path : `${path}?days=${days}`;
}

/**
 * As três opções que o design oferece nas duas telas (`sessoes.html` e
 * `painel-profissional.html`). Os **rótulos** ficam em cada tela, porque o
 * mockup escreve diferente em cada uma ("30 dias" no paciente, "últimos 30
 * dias" no profissional); o que se compartilha é o valor e a conversão.
 */
export type PeriodoOpcao = "30" | "90" | "tudo";

export function dias(opcao: PeriodoOpcao): Periodo {
  return opcao === "tudo" ? null : Number(opcao);
}

/** Direito de acesso do titular: os próprios Result. */
export async function listMyResults(days: Periodo = null): Promise<SessionResult[]> {
  const payload = await request<ResultsPayload>(comPeriodo("/me/results", days), {
    auth: true,
  });
  return ordenarPorData(payload.results ?? []);
}

/** Result de um paciente. A API devolve 403 sem vínculo ativo. */
export async function listPatientResults(
  patientId: string,
  days: Periodo = null,
): Promise<SessionResult[]> {
  const payload = await request<ResultsPayload>(
    comPeriodo(`/patients/${patientId}/results`, days),
    { auth: true },
  );
  return ordenarPorData(payload.results ?? []);
}

/**
 * Uma página dos próprios Result, com o total do período.
 *
 * Separada de `listMyResults` em vez de substituí-la: a home pede as últimas
 * sessões e não pagina nada, e trocar a assinatura de lá por causa do
 * histórico seria mexer numa tela que esta fatia não toca.
 */
export async function listMyResultsPage(
  days: Periodo = null,
  opcoes: OpcoesDePagina = {},
): Promise<ResultsPage> {
  const payload = await request<ResultsPayload>(comPagina("/me/results", days, opcoes), {
    auth: true,
  });
  const results = ordenarPorData(payload.results ?? []);
  return { results, total: payload.total ?? results.length };
}

/** Uma página dos Result de um paciente. 403 sem vínculo ativo. */
export async function listPatientResultsPage(
  patientId: string,
  days: Periodo = null,
  opcoes: OpcoesDePagina = {},
): Promise<ResultsPage> {
  const payload = await request<ResultsPayload>(
    comPagina(`/patients/${patientId}/results`, days, opcoes),
    { auth: true },
  );
  const results = ordenarPorData(payload.results ?? []);
  return { results, total: payload.total ?? results.length };
}

/**
 * Direito de **portabilidade** (Medical/72): tudo o que é do titular em JSON
 * aberto — Result e notas de contexto. Devolve o objeto cru, porque quem chama
 * o transforma em arquivo.
 */
export async function exportMyData(): Promise<unknown> {
  return request<unknown>("/me/results/export", { auth: true });
}

/**
 * Direito de **exclusão**: apaga TODOS os Result e notas do titular.
 *
 * Não apaga as sessões de captação em si nem revoga o consentimento — são atos
 * separados de propósito (Medical/72 §2), para um não destruir o outro sem que
 * a pessoa tenha pedido.
 */
export async function deleteMyResults(): Promise<{ deleted: number; annotations_deleted: number }> {
  return request<{ deleted: number; annotations_deleted: number }>("/me/results", {
    method: "DELETE",
    auth: true,
  });
}

/** Mais antigo → mais recente: é a ordem que a linha do tempo espera. */
export function ordenarPorData(results: SessionResult[]): SessionResult[] {
  return [...results].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/** Duração da sessão em segundos, quando o engine registrou taxa e amostras. */
export function sessionDurationSeconds(metrics: ResultMetrics): number | null {
  const { n_samples: n, fs } = metrics;
  if (!n || !fs) return null;
  return n / fs;
}

/** "8 min 20 s" — formato curto para subtítulo de sessão. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const min = Math.floor(total / 60);
  const s = total % 60;
  if (min === 0) return `${s} s`;
  return s === 0 ? `${min} min` : `${min} min ${s} s`;
}

/** Número com vírgula decimal (pt-BR), para não misturar "29.6" e "26,9". */
export function formatNumber(value: number, casas = 1): string {
  return value.toFixed(casas).replace(".", ",");
}

/** Fração (0..1) → "24,7%". */
export function formatPercent(fraction: number, casas = 1): string {
  return `${formatNumber(fraction * 100, casas)}%`;
}

export function formatDate(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
}
