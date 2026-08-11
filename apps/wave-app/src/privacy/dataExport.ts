/**
 * Entrega da cópia dos dados do titular — **capability por plataforma**.
 *
 * O direito de portabilidade (Medical/72) já existe no servidor: o
 * `GET /me/results/export` devolve tudo em JSON aberto. O que muda por
 * plataforma é como esse JSON **chega às mãos da pessoa**.
 *
 * Este é o caminho nativo (ADR-0046): o arquivo é escrito no armazenamento
 * **privado do app** e oferecido ao share sheet do sistema, que é quem deixa a
 * pessoa escolher o destino — Arquivos, Drive, e-mail dela, o que for. Nós não
 * escolhemos por ela e o arquivo não passa por nenhuma infraestrutura nossa
 * além da resposta da API que ela já pediu.
 *
 * **Por que não por e-mail**, que é o que `Design/round1/consentimento.html`
 * promete: mandaríamos o conjunto inteiro — inclusive as notas que ciframos em
 * repouso (ADR-0037) — em claro, por infraestrutura de terceiros, para ficar
 * indexado e permanente numa caixa de entrada. Quem tomasse a caixa levaria
 * tudo, sem passar pela trilha de acesso. A cópia da tela mudou para dizer o
 * que o produto faz.
 *
 * O web tem a sua própria versão deste módulo (`dataExport.web.ts`), resolvida
 * pelo Metro — assim o pacote nativo nunca carrega código de DOM.
 */

import { File, Paths } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";

/**
 * No nativo a capability é do sistema, não do bundle: em iOS/Android o share
 * sheet existe, mas a checagem real acontece em `podeCompartilhar()` — daí
 * este `true` significar "há um caminho", e não "vai funcionar sempre".
 */
export const COPIA_DISPONIVEL = true;

/**
 * Cópia da tela, aqui e não lá, porque ela descreve **o gesto da plataforma**:
 * no celular a pessoa escolhe o destino num menu do sistema; no navegador o
 * arquivo cai na pasta de downloads. Uma frase só para os dois casos ou mentiria
 * num deles ou seria vaga nos dois.
 */
export const ROTULO_COPIA = "Salvar ou compartilhar";
export const TEXTO_COPIA =
  "Gera um arquivo aberto (JSON) com suas sessões e suas notas, e deixa você " +
  "escolher onde guardar.";
/**
 * **Não afirma entrega**: o share sheet resolve igual se a pessoa concluir ou
 * cancelar, então dizer "salvo" seria afirmar o que não sabemos (ADR-0027).
 */
export const AVISO_COPIA = "Cópia gerada e oferecida para você escolher o destino.";

/** O share sheet está disponível neste aparelho? */
export async function podeCompartilhar(): Promise<boolean> {
  return isAvailableAsync();
}

export async function baixarCopia(dados: unknown): Promise<void> {
  const dia = new Date().toISOString().slice(0, 10);
  // `cache` e não `document`: é um arquivo de passagem. O sistema pode
  // recuperar o espaço, e nós apagamos assim que o share sheet fecha — dado do
  // titular não fica esquecido no aparelho por nossa causa.
  const arquivo = new File(Paths.cache, `waveai-meus-dados-${dia}.json`);

  try {
    arquivo.create({ overwrite: true });
    arquivo.write(JSON.stringify(dados, null, 2));
    await shareAsync(arquivo.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Cópia dos seus dados do WaveAI",
    });
  } finally {
    // Apaga mesmo se a pessoa cancelar o share sheet: o arquivo só existe para
    // a duração do gesto. `try` porque apagar o que já não existe não é erro
    // que mereça derrubar a tela.
    try {
      arquivo.delete();
    } catch {
      // Nada a fazer: o arquivo é descartável por construção.
    }
  }
}
