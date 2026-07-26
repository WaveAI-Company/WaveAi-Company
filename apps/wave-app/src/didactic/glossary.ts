/**
 * Glossário didático (P1, fase Produto & UX) — explica em linguagem simples os
 * termos que a UI mostra ao paciente/médico.
 *
 * **Fonte de verdade:** derivado FIELMENTE do **Catálogo de Features N2**
 * (`packages/wave-eeg/src/wave_eeg/features.py`, `FEATURE_CATALOG`) e do
 * `ESENSE_CATALOG` (ADR-0034). Aqui só se **reformula** o que o catálogo já
 * sustenta — nenhuma claim nova, nada clínico (Medical/71). A `reliability`
 * é exposta de propósito: é o guarda-corpo que diz o quanto confiar na leitura.
 *
 * Espelhado à mão, como `FEATURE_LABELS` (report.ts) já faz com os nomes: se o
 * `engine_version` mudar o catálogo de forma material, atualizar aqui também.
 */

/** Confiabilidade herdada do catálogo — o quanto a leitura é confiável. */
export type Reliability = "defensável" | "cautela" | "proprietária/não-validada";

export type GlossaryEntry = {
  /** Nome amigável, exibido como título. */
  label: string;
  /** Explicação factual em linguagem simples, não-clínica. */
  plain: string;
  /** Confiabilidade do catálogo (ausente = métrica de aparelho, não de análise). */
  reliability?: Reliability;
  /** O que essa confiabilidade significa na hora de ler o número. */
  reliabilityNote?: string;
  /** De onde o termo vem (honestidade da fonte). */
  source?: string;
};

const NOTA_DEFENSAVEL =
  "Medida robusta a ganho e escala — dá para comparar entre sessões.";
const NOTA_CAUTELA =
  "Sensível ao contato e à escala do sensor — leia como contexto/qualidade, " +
  "não como medida direta do cérebro.";
const NOTA_ESENSE =
  "Algoritmo fechado da NeuroSky, sem validação científica independente — " +
  "exploratório e não-clínico. Complemento, nunca base de conclusão.";

const FONTE_CATALOGO = "Catálogo de Features (N2)";
const FONTE_ESENSE = "eSense NeuroSky (ADR-0034)";

/**
 * Verbetes. Chaves de banda batem com `rel_<banda>` do catálogo; eSense e
 * qualidade têm chaves próprias.
 */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  rel_delta: {
    label: "Delta relativo",
    plain:
      "Quanto da atividade está na faixa delta (0,5–4 Hz), as ondas mais lentas.",
    reliability: "defensável",
    reliabilityNote:
      "No sensor frontal (FP1), frequências baixas sofrem com movimento e " +
      "piscadas — interprete com cuidado.",
    source: FONTE_CATALOGO,
  },
  rel_theta: {
    label: "Teta relativo",
    plain: "Quanto da atividade está na faixa teta (4–8 Hz).",
    reliability: "defensável",
    reliabilityNote: NOTA_DEFENSAVEL,
    source: FONTE_CATALOGO,
  },
  rel_alpha: {
    label: "Alfa relativo",
    plain:
      "Quanto da atividade cerebral está na faixa alfa (8–13 Hz). " +
      "Costuma subir em repouso e de olhos fechados.",
    reliability: "defensável",
    reliabilityNote:
      "Robusta a escala, mas muito sensível ao estado (vigília, emoção) — " +
      "compare em condições parecidas.",
    source: FONTE_CATALOGO,
  },
  rel_beta: {
    label: "Beta relativo",
    plain:
      "Quanto da atividade está na faixa beta (13–30 Hz). " +
      "Tende a subir com engajamento e atenção ativa.",
    reliability: "defensável",
    reliabilityNote:
      "No sensor frontal pode ter contaminação por tensão muscular da testa.",
    source: FONTE_CATALOGO,
  },
  rel_gamma: {
    label: "Gama relativo",
    plain: "Quanto da atividade está na faixa gama (30–45 Hz).",
    reliability: "cautela",
    reliabilityNote:
      "Em sensor seco de canal único, é dominada por atividade muscular — " +
      "não é medida direta do cérebro.",
    source: FONTE_CATALOGO,
  },
  signal_quality: {
    label: "Qualidade do sinal",
    plain:
      "Indicadores de quão limpa está a captação: variação da amplitude e " +
      "quanto da energia vem da rede elétrica (60 Hz). Ajudam a saber se dá " +
      "para confiar na leitura.",
    reliability: "cautela",
    reliabilityNote:
      "São medidas de contexto/qualidade, não do cérebro.",
    source: "Motor de análise",
  },
  poor_signal: {
    label: "Contato do sensor",
    plain:
      "Valor que o próprio aparelho informa sobre o contato do eletrodo: " +
      "0 = bom contato, 200 = solto. Quanto menor, melhor a leitura.",
    source: "Aparelho (NeuroSky)",
  },
  esense: {
    label: "eSense (NeuroSky)",
    plain:
      "Índices proprietários da NeuroSky (0–100) que ela chama de 'atenção' e " +
      "'meditação'. Não são medidas diretas do cérebro.",
    reliability: "proprietária/não-validada",
    reliabilityNote: NOTA_ESENSE,
    source: FONTE_ESENSE,
  },
};

export function glossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term];
}
