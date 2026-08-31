/**
 * Traduz falhas do Bluetooth para uma frase que a pessoa entenda.
 *
 * As bibliotecas de transporte devolvem texto cru, em inglês e com nome de
 * variável dentro — `Bluetooth mAdapter is not enabled`,
 * `Already attempting connection to device C4:64:E3:EA:9B:56`. Isso chegava
 * inteiro à tela.
 *
 * **Traduzido no significado, não ao pé da letra.** A pessoa não precisa saber
 * o que é um "adapter" nem ver o endereço do rádio: precisa saber o que fazer
 * a seguir. Por isso cada caso vira uma instrução, e o endereço sai.
 *
 * Quem não casa com nenhum padrão cai numa frase honesta e genérica — nunca no
 * texto original, que não diria nada a quem está lendo.
 */

/** Endereço de hardware (`C4:64:E3:EA:9B:56`) — ruído para quem lê. */
const MAC = /\b([0-9A-F]{2}:){5}[0-9A-F]{2}\b/gi;

const PADROES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /not enabled|is disabled|powered ?off|poweredoff/i,
    "O Bluetooth está desligado. Ligue-o para procurar o aparelho.",
  ],
  [
    /already attempting connection|already connect/i,
    "Já estamos conectando a esse aparelho. Aguarde um instante.",
  ],
  // "permiss" cobre permission / permissão / permissao — inclusive a nossa
  // própria mensagem, que já vem em português e nomeia o que falta. Quando ela
  // é a origem, o texto dela passa direto: ver `PASSA_DIRETO` abaixo.
  [
    /unauthorized|permiss|denied|negad/i,
    "O app precisa da sua permissão para usar o Bluetooth. Autorize nos ajustes do celular, em Aplicativos › WaveAI › Permissões.",
  ],
  [
    /unsupported|not supported/i,
    "Este aparelho não oferece o Bluetooth de que a captação precisa.",
  ],
  [
    /timeout|timed out/i,
    "O aparelho demorou a responder. Verifique se ele está ligado e por perto.",
  ],
  [
    /not found|no device|não encontrado/i,
    "Não encontramos o aparelho. Confira se ele está ligado e pareado no celular.",
  ],
  [
    /connection (lost|failed)|disconnected|read failed|socket/i,
    "A conexão com o aparelho caiu. Aproxime-o do celular e tente de novo.",
  ],
  [
    /bonded|pair/i,
    "O aparelho ainda não está pareado. Pareie-o nas configurações de Bluetooth do celular.",
  ],
];

/** Frase para quando nada casa: diz o que houve sem inventar a causa. */
const GENERICA = "Não foi possível falar com o aparelho. Tente de novo.";

/**
 * Mensagens que **já são nossas** e já estão em português.
 *
 * O `garantirPermissoes` nomeia exatamente quais permissões faltam ("Dispositivos
 * por perto (conectar)") — informação que a frase genérica sobre permissão
 * perderia. Quando o texto vem de lá, ele passa direto.
 */
const PASSA_DIRETO = /^Permissão negada:/;

export function mensagemBluetooth(erro: unknown): string {
  const cru = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "";
  const limpo = cru.replace(MAC, "").trim();
  if (PASSA_DIRETO.test(limpo)) return limpo;
  for (const [padrao, texto] of PADROES) {
    if (padrao.test(limpo)) return texto;
  }
  return GENERICA;
}
