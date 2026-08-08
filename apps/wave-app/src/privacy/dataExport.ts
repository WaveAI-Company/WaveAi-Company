/**
 * Entrega da cópia dos dados do titular — **capability por plataforma**.
 *
 * O direito de portabilidade (Medical/72) já existe no servidor: o
 * `GET /me/results/export` devolve tudo em JSON aberto. O que muda por
 * plataforma é como esse JSON **chega às mãos da pessoa**.
 *
 * Este é o caminho nativo, e ele **não** entrega: salvar ou compartilhar um
 * arquivo no iOS/Android exige dependência nativa (`expo-file-system` +
 * `expo-sharing`), que é decisão de ADR — e enviar por e-mail depende da
 * infraestrutura de e-mail que só chega na P5. Enquanto isso, a tela não
 * oferece o botão em vez de oferecer um botão que falha.
 *
 * O web tem a sua própria versão deste módulo (`dataExport.web.ts`), resolvida
 * pelo Metro — assim o pacote nativo nunca carrega código de DOM.
 */

export const COPIA_DISPONIVEL = false;

export async function baixarCopia(_dados: unknown): Promise<void> {
  throw new Error("cópia de dados indisponível nesta plataforma");
}
