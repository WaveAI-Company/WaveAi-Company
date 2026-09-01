import type { PhaseComparison } from "../api/results";

/**
 * Estado do protocolo guiado — **uma fonte só** para a voz e para a tela
 * (emenda à ADR-0053).
 *
 * A voz anuncia ao fim do roteiro e o cartão detalha ao encerrar a sessão. Se
 * cada um decidisse por conta própria, bastaria uma correção num deles para
 * passarem a dizer coisas diferentes sobre a mesma captação.
 */
export type VeredictoProtocolo = "incompleto" | "apareceu" | "nao-apareceu";

/**
 * `incompleto` **prevalece sobre o número**, inclusive quando o servidor
 * calculou `passed: true`.
 *
 * Não é esconder resultado: um roteiro que foi pulado ou interrompido não é
 * verificação válida, e apresentá-lo como aprovação daria à pessoa uma confiança
 * que o teste não sustenta. A tela diz que o roteiro foi interrompido — que é
 * exatamente o que aconteceu.
 *
 * Sem contraste e sem interrupção declarada também é `incompleto`: é o caso de
 * faltar uma das fases, quando o gateway devolve `comparison: null` de
 * propósito, em vez de fabricar um contraste.
 */
export function vereditoDoProtocolo(
  comparison: PhaseComparison | null | undefined,
  roteiroIncompleto: boolean,
): VeredictoProtocolo {
  if (roteiroIncompleto || !comparison) return "incompleto";
  return comparison.passed === true ? "apareceu" : "nao-apareceu";
}

/**
 * A frase que a voz diz ao fim do roteiro.
 *
 * Curta de propósito: quem acabou de abrir os olhos quer saber **se deu**, não
 * ouvir estatística. Os números e as causas ficam no relatório, ao encerrar.
 */
export function falaDoVeredito(veredito: VeredictoProtocolo): string {
  switch (veredito) {
    case "apareceu":
      return "O padrão esperado apareceu. Seu aparelho está captando bem.";
    case "nao-apareceu":
      return "O padrão esperado não apareceu desta vez. Veja os detalhes ao encerrar a sessão.";
    case "incompleto":
      return "O roteiro não foi concluído até o fim, então não dá para verificar. Refaça quando puder.";
  }
}
