/**
 * Utilitários de cor do design system.
 *
 * O design "Maré" usa muito a mesma cor de destaque em versão translúcida
 * (anel de foco, ladrilho de ícone, halo). Guardar esses tons como tokens
 * separados duplicaria a paleta e sairia de sincronia na primeira troca de
 * destaque — melhor derivá-los do token que já existe.
 */

/**
 * Mesma cor, com opacidade — aceita `#RRGGBB` e devolve `rgba(...)`.
 *
 * **Só para ornamento** (fundo translúcido, halo, anel de foco). Texto e
 * limite de controle continuam usando os pares de token validados pelo
 * `scripts/check-contrast.mjs`: contraste sobre fundo translúcido depende do
 * que estiver atrás, e isso o verificador não tem como garantir.
 */
export function withAlpha(hex: string, alpha: number): string {
  const limpo = hex.replace("#", "");
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
