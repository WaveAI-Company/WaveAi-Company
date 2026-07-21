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
  { key: "theta", label: "Theta", range: "4–8 Hz" },
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
  comparison?: unknown | null;
};

export type SessionResult = {
  id: string;
  session_id: string;
  engine_version: string;
  created_at: string;
  metrics: ResultMetrics;
};

type ResultsPayload = { results: SessionResult[] };

/** Direito de acesso do titular: os próprios Result. */
export async function listMyResults(): Promise<SessionResult[]> {
  const payload = await request<ResultsPayload>("/me/results", { auth: true });
  return ordenarPorData(payload.results ?? []);
}

/** Result de um paciente. A API devolve 403 sem vínculo ativo. */
export async function listPatientResults(patientId: string): Promise<SessionResult[]> {
  const payload = await request<ResultsPayload>(`/patients/${patientId}/results`, {
    auth: true,
  });
  return ordenarPorData(payload.results ?? []);
}

/** Mais antigo → mais recente: é a ordem que a linha do tempo espera. */
function ordenarPorData(results: SessionResult[]): SessionResult[] {
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
