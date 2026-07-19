/**
 * Parser do protocolo ThinkGear (NeuroSky) em TypeScript.
 *
 * Porte fiel de `packages/wave-eeg/src/wave_eeg/thinkgear.py`, que é a
 * referência testada. Existe em duplicidade por necessidade: o parser precisa
 * rodar **no aparelho**, e o pacote Python não roda em React Native.
 *
 * Isto é **decodificação de protocolo, não análise** — a regra de manter DSP
 * atrás do `AnalysisEngine` (no servidor) segue valendo.
 *
 * Pacote: `0xAA 0xAA [PLENGTH] [PAYLOAD...] [CHECKSUM]`
 * `checksum = (~(soma(payload) & 0xFF)) & 0xFF`
 */

const SYNC = 0xaa;

const CODE_POOR_SIGNAL = 0x02;
const CODE_RAW = 0x80;

/** PLENGTH válido é 0..169 (170 = 0xAA, reservado ao SYNC). */
const MAX_PLENGTH = 169;

export type TGPacket = {
  rawSamples: number[];
  poorSignal?: number;
};

export function checksum(payload: Uint8Array): number {
  let soma = 0;
  for (const b of payload) soma += b;
  return ~(soma & 0xff) & 0xff;
}

/** Raw EEG: 2 bytes big-endian em complemento de dois (16 bits). */
function decodeRaw(hi: number, lo: number): number {
  const valor = (hi << 8) | lo;
  return valor >= 0x8000 ? valor - 0x10000 : valor;
}

export function parsePayload(payload: Uint8Array): TGPacket {
  const pacote: TGPacket = { rawSamples: [] };
  let i = 0;
  const n = payload.length;

  while (i < n) {
    // EXCODE (0x55) só eleva o nível de código estendido; ignorado aqui.
    while (i < n && payload[i] === 0x55) i += 1;
    if (i >= n) break;

    const code = payload[i];
    i += 1;

    if (code >= 0x80) {
      if (i >= n) break;
      const vlen = payload[i];
      i += 1;
      const valor = payload.slice(i, i + vlen);
      i += vlen;
      if (code === CODE_RAW && valor.length === 2) {
        pacote.rawSamples.push(decodeRaw(valor[0], valor[1]));
      }
    } else {
      if (i >= n) break;
      const valor = payload[i];
      i += 1;
      if (code === CODE_POOR_SIGNAL) pacote.poorSignal = valor;
    }
  }
  return pacote;
}

/**
 * Máquina de estados incremental e tolerante a fragmentação.
 *
 * O Bluetooth entrega pedaços arbitrários: um pacote pode chegar partido entre
 * duas leituras, e pode vir lixo antes do SYNC. `feed` remonta e descarta o que
 * não fecha checksum.
 */
export class ThinkGearParser {
  private buffer: number[] = [];
  badChecksums = 0;
  packetsParsed = 0;

  feed(data: Uint8Array | number[]): TGPacket[] {
    for (const b of data) this.buffer.push(b);

    const pacotes: TGPacket[] = [];
    for (;;) {
      // Localiza o par de SYNC.
      let inicio = -1;
      for (let i = 0; i < this.buffer.length - 1; i += 1) {
        if (this.buffer[i] === SYNC && this.buffer[i + 1] === SYNC) {
          inicio = i;
          break;
        }
      }
      if (inicio === -1) {
        // Sem SYNC completo: preserva no máximo 1 byte (pode ser meio-SYNC).
        if (this.buffer.length > 1) {
          this.buffer = this.buffer.slice(this.buffer.length - 1);
        }
        return pacotes;
      }
      if (inicio > 0) this.buffer = this.buffer.slice(inicio);
      if (this.buffer.length < 3) return pacotes;

      const plength = this.buffer[2];
      if (plength === SYNC || plength > MAX_PLENGTH) {
        this.buffer = this.buffer.slice(1); // PLENGTH inválido: re-sincroniza
        continue;
      }

      const total = 3 + plength + 1;
      if (this.buffer.length < total) return pacotes; // aguarda mais bytes

      const payload = Uint8Array.from(this.buffer.slice(3, 3 + plength));
      if (checksum(payload) !== this.buffer[3 + plength]) {
        this.badChecksums += 1;
        this.buffer = this.buffer.slice(2); // descarta os SYNC e re-sincroniza
        continue;
      }

      this.packetsParsed += 1;
      this.buffer = this.buffer.slice(total);
      pacotes.push(parsePayload(payload));
    }
  }
}
