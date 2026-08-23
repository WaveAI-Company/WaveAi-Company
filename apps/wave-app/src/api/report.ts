/**
 * Relatório **longitudinal** (N5): tendências das features ao longo das sessões
 * do titular. O paciente lê o próprio; o médico lê o de um paciente e a API
 * exige CareLink `active` (403 sem) e audita — a autorização é do servidor.
 *
 * O `summary` são frases geradas por **template determinístico** no servidor
 * (N5-c, ADR-0035) — texto **descritivo, não-clínico**. Esta camada só exibe.
 */

import { request } from "../auth/api";
import type { Periodo } from "./results";
import type { IconName } from "../components/Icon";

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
  /** Intervalo **observado**: primeira e última sessão que entraram. */
  period: { first: string; last: string } | null;
  /**
   * Janela **pedida**, em dias (`null` = histórico inteiro). Separado do
   * `period` de propósito: o design mostra os dois — "últimos 30 dias" na
   * sobrancelha e o intervalo real embaixo —, e sem isto uma janela vazia
   * ficaria sem rótulo nenhum de período.
   */
  window_days: number | null;
  engine_version: string | null;
  report: LongitudinalData;
  /**
   * Soma da duração das sessões do período, em segundos. `null` = **não dá
   * para saber** (nenhuma sessão trouxe amostras/taxa) — diferente de zero,
   * que afirmaria um tempo que ninguém captou.
   */
  total_duration_seconds?: number | null;
  /** Quantas sessões do período têm autorrelato. Contagem, nunca o texto. */
  annotation_count?: number;
  /**
   * Série **por sessão** do período, cronológica. É o que sustenta a linha de
   * tendência quando a lista está paginada: os agregados acima não carregam
   * ponto por sessão, e derivar a linha de uma página faria o gráfico mudar de
   * forma conforme a página (ADR-0027).
   */
  series?: Array<{ at: string; features: Record<string, number> }>;
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
export async function getMyReport(days: Periodo = null): Promise<LongitudinalReport> {
  const path = days === null
    ? "/me/report/longitudinal"
    : `/me/report/longitudinal?days=${days}`;
  return request<LongitudinalReport>(path, { auth: true });
}

/** Relatório de um paciente. A API devolve 403 sem vínculo ativo. */
export async function getPatientReport(
  patientId: string,
  days: Periodo = null,
): Promise<LongitudinalReport> {
  const base = `/patients/${patientId}/report/longitudinal`;
  return request<LongitudinalReport>(days === null ? base : `${base}?days=${days}`, {
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

/**
 * Ícone neutro da direção — seta, não cor de "bom/ruim" (não há juízo aqui).
 *
 * Passou de glifo (`↑ ↓ →`) a nome de ícone na P8-b: seta tipográfica carrega
 * o desenho, o peso e a caixa da fonte do sistema, e ao lado de um conjunto de
 * traço isso aparece.
 */
export function directionIcon(direction: TrendDirection): IconName {
  if (direction === "subindo") return "arrowUp";
  if (direction === "descendo") return "arrowDown";
  return "arrowRight";
}
