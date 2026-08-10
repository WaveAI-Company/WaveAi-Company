/**
 * Datas curtas em PT-BR, no formato do design.
 *
 * O `toLocaleDateString` de pt-BR insere "de" ("12 de jul. de 2026") e abrevia
 * com ponto; o design escreve "12 jul 2026". Formatar à mão é o que mantém as
 * telas iguais ao mockup em qualquer navegador.
 */

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "12 jul 2026" — para datas que podem ser de outro ano. */
export function dataCurta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 jul" — quando o ano não acrescenta nada (listas do período corrente). */
export function diaMes(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/**
 * "jul" — só o mês.
 *
 * Existe para o selo de data da linha de sessão, que empilha o dia e o mês em
 * **duas linhas**: ali uma string "12 jul" não serviria. É isto ou exportar o
 * array de meses — e exportá-lo devolveria a quem chama a tarefa de indexar
 * por `getMonth()`, que é justamente o que este módulo existe para guardar.
 */
export function mesCurto(iso: string): string {
  return MESES[new Date(iso).getMonth()];
}
