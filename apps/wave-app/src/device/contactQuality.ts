/**
 * Traduz o `poorSignal` do aparelho numa faixa em linguagem simples (P4-a).
 *
 * O NeuroSky reporta um número de 0 (bom contato) a 200 (eletrodo sem contato).
 * O número cru continua visível na tela — aqui só o **rotulamos** para o titular
 * saber o que fazer. Isto **não é análise/DSP** (ADR: análise mora no
 * `AnalysisEngine`): é status do próprio aparelho, apenas apresentado melhor.
 *
 * Os limiares são de **apresentação**, não clínicos: qualidade de contato tem
 * valência legítima (contato firme é objetivamente melhor para a leitura), então
 * aqui a cor de alerta é honesta — diferente de bandas/estados, onde não há
 * "bom/ruim" (ADR-0027).
 */

export type ContactLevel = "bom" | "ajuste" | "solto";

export type ContactDescription = {
  level: ContactLevel;
  /** Rótulo curto para o título do card. */
  label: string;
  /** O que fazer, em uma frase. */
  hint: string;
};

/** Até este valor o contato é tratado como bom o suficiente para a leitura. */
const LIMIAR_BOM = 25;
/** Valor-sentinela do aparelho para "eletrodo sem contato". */
const SEM_CONTATO = 200;

export function describeContact(poorSignal: number): ContactDescription {
  if (poorSignal >= SEM_CONTATO) {
    return {
      level: "solto",
      label: "Sensor sem contato",
      hint: "O eletrodo não está tocando a pele. Reposicione o aparelho na testa.",
    };
  }
  if (poorSignal > LIMIAR_BOM) {
    return {
      level: "ajuste",
      label: "Ajuste o contato",
      hint: "Encoste melhor o eletrodo na testa e ajuste o clipe da orelha. Quanto menor o número, melhor.",
    };
  }
  return {
    level: "bom",
    label: "Bom contato",
    hint: "O eletrodo está firme na pele.",
  };
}
