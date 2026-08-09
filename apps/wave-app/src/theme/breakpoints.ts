import { useWindowDimensions } from "react-native";

/**
 * Larguras de corte do design "Maré" (P8-d).
 *
 * **São as do mockup**, colhidas das `@media` de `Design/round1/*.html` — não
 * arredondamentos nossos. Antes disto o app usava `900` em cinco telas e
 * `1024` em uma, valores que não existem em lugar nenhum do design; o
 * resultado é que as telas trocavam de forma em momentos diferentes do
 * original, e o conjunto nunca "assentava" na mesma hora.
 */
export const bp = {
  /** Acima disto, a grade de tiles do painel cabe em quatro colunas. */
  tiles: 1280,
  /** O corte principal: navegação cheia, e as grades no arranjo largo. */
  largo: 1199,
  /** Cena de marca + formulário (login e cadastro) lado a lado. */
  auth: 1100,
  /** Duas colunas em telas de conteúdo mais leve (perfil, convidar). */
  duasColunas: 960,
  /** Abaixo disto é celular: navegação em gaveta e tudo empilhado. */
  movel: 767,
} as const;

/** Larguras fixas do design — colunas que não esticam. */
export const larguras = {
  /** Navegação lateral completa. */
  navegacao: 240,
  /** Navegação recolhida a ícones, entre `movel` e `largo`. */
  navegacaoRail: 76,
  /** Trilho lateral do estado ao vivo. */
  trilhoLive: 360,
  /** Trilho lateral do histórico de sessões. */
  trilhoSessoes: 320,
  /** Lista de pessoas do painel do profissional. */
  listaPessoas: 280,
} as const;

/** Teto de largura do conteúdo, por tipo de tela — cada um sai do mockup. */
export const teto = {
  /** Painel do profissional: a tela mais densa do produto. */
  painel: 1720,
  /** Telas de app com colunas (início, ao vivo, sessões). */
  app: 1600,
  /** Perfil. */
  perfil: 1400,
  /** Telas de lista mais leve (convites, convidar). */
  lista: 1100,
  /** Documento corrido — linha longa demais cansa de ler. */
  documento: 720,
} as const;

export type FaixaLargura = "movel" | "medio" | "largo";

/**
 * Em qual das três faixas a janela está.
 *
 * **Três e não duas:** é a diferença estrutural que o porte da P7 não pegou. O
 * mockup quase nunca vai de "duas colunas" direto para "empilhado" — no meio
 * existe um arranjo próprio, com as colunas em proporção igual e a navegação
 * recolhida a ícones.
 */
export function useFaixa(): FaixaLargura {
  const { width } = useWindowDimensions();
  if (width <= bp.movel) return "movel";
  if (width <= bp.largo) return "medio";
  return "largo";
}

/** Atalho: `true` da faixa média para cima. */
export function useAoMenosMedio(): boolean {
  return useFaixa() !== "movel";
}
