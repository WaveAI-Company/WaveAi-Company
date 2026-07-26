/**
 * Relatório **longitudinal** (N5): tendências das features ao longo das sessões
 * do titular. O paciente lê o próprio; o médico lê o de um paciente e a API
 * exige CareLink `active` (403 sem) e audita — a autorização é do servidor.
 *
 * O `summary` são frases geradas por **template determinístico** no servidor
 * (N5-c, ADR-0035) — texto **descritivo, não-clínico**. Esta camada só exibe.
 */

import { request } from "../auth/api";

/** Direção da tendência de uma feature — direção NUMÉRICA, sem juízo de valor. */
export type TrendDirection = "subindo" | "descendo" | "estável";

/** Tendência longitudinal de uma feature (espelha `wave_eeg.FeatureTrend`). */
export type FeatureTrend = {
  n: number;
  mean: number;
  std: number;
  first: number;
  last: number;
  minimum: number;
  maximum: number;
  delta_abs: number;
  /** Variação relativa à média, em % (ex.: +42). */
  delta_pct: number;
  slope: number;
  direction: TrendDirection;
};

export type QualitySummary = {
  n: number;
  mean: number;
  min: number;
  last: number;
};

export type LongitudinalData = {
  n_sessions: number;
  features: Record<string, FeatureTrend>;
  quality?: QualitySummary;
};

export type LongitudinalReport = {
  patient_id: string;
  n_sessions: number;
  period: { first: string; last: string } | null;
  engine_version: string | null;
  report: LongitudinalData;
  /** Frases do sumário determinístico (N5-c). Já vêm rotuladas não-clínicas. */
  summary: string[];
  /**
   * Narrativa aterrada por LLM (N6-b, ADR-0035): prosa derivada do sumário
   * acima. `null` quando desligada/indisponível — aí o app mostra o `summary`
   * determinístico. Sempre rotulada como gerada por IA e não-diagnóstica.
   */
  narrative: string | null;
  disclaimer: string | null;
};

/** Relatório longitudinal do próprio titular. */
export async function getMyReport(): Promise<LongitudinalReport> {
  return request<LongitudinalReport>("/me/report/longitudinal", { auth: true });
}

/** Relatório de um paciente. A API devolve 403 sem vínculo ativo. */
export async function getPatientReport(patientId: string): Promise<LongitudinalReport> {
  return request<LongitudinalReport>(`/patients/${patientId}/report/longitudinal`, {
    auth: true,
  });
}

/**
 * Rótulos legíveis das features — descrições factuais de banda/espectro, **sem
 * interpretação** (espelha `wave_eeg.summary.FRIENDLY_NAMES`). Chave fora do mapa
 * cai no próprio nome.
 */
export const FEATURE_LABELS: Record<string, string> = {
  rel_delta: "Delta relativo",
  rel_theta: "Teta relativo",
  rel_alpha: "Alfa relativo",
  rel_beta: "Beta relativo",
  rel_gamma: "Gama relativo",
  ratio_theta_beta: "Razão teta/beta",
  ratio_alpha_beta: "Razão alfa/beta",
  spectral_edge_95: "Frequência de borda (95%)",
  median_frequency: "Frequência mediana",
  spectral_entropy: "Entropia espectral",
  peak_alpha_frequency: "Frequência de pico alfa",
  rms: "Amplitude RMS",
  total_power: "Potência total",
};

export function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key;
}

/** Símbolo neutro da direção — seta, não cor de "bom/ruim" (não há juízo aqui). */
export function directionSymbol(direction: TrendDirection): string {
  if (direction === "subindo") return "↑";
  if (direction === "descendo") return "↓";
  return "→";
}
