/**
 * Entrega da cópia dos dados do titular no **navegador**: download direto.
 *
 * Ver `dataExport.ts` para o porquê de existirem duas versões. Aqui não há
 * dependência nova — `Blob` + âncora é API do próprio navegador — e o arquivo
 * nunca passa por terceiros: sai do servidor do WaveAI para o disco da pessoa.
 */

export const COPIA_DISPONIVEL = true;

/** Ver `dataExport.ts`: a cópia descreve o gesto da plataforma. */
export const ROTULO_COPIA = "Baixar cópia";
export const TEXTO_COPIA =
  "Baixa um arquivo aberto (JSON) com suas sessões e suas notas.";
export const AVISO_COPIA = "Cópia baixada — o arquivo tem seus resultados e suas notas.";

/**
 * No navegador o download é da própria plataforma — não há capability a
 * consultar. Existe para as duas versões do módulo terem a mesma forma: a tela
 * chama isto sem saber onde está rodando.
 */
export async function podeCompartilhar(): Promise<boolean> {
  return true;
}

export async function baixarCopia(dados: unknown): Promise<void> {
  const conteudo = JSON.stringify(dados, null, 2);
  const blob = new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dia = new Date().toISOString().slice(0, 10);

  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = `waveai-meus-dados-${dia}.json`;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();

  // Sem isso o Blob fica vivo até a aba fechar.
  URL.revokeObjectURL(url);
}
