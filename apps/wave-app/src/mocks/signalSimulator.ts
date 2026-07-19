/**
 * Gerador de sinal **simulado** para exercitar o streaming sem hardware.
 *
 * Espelha o simulador do pacote `wave_eeg` (alfa de 10 Hz sobre ruído), e
 * existe porque a captação real é uma capability de mobile (#12) — no web não
 * há aparelho. **Não é medição de ninguém**: as telas que o usam precisam
 * deixar claro que o sinal é simulado.
 *
 * Isto NÃO é análise: é só geração de um sinal de teste. Toda a análise
 * continua atrás do `AnalysisEngine`, no servidor.
 */

const ALPHA_HZ = 10;

export class SignalSimulator {
  private amostra = 0;

  constructor(
    private readonly sampleRate: number,
    /** Amplitude do componente alfa — mais alto simula "olhos fechados". */
    private readonly alphaAmplitude = 20,
  ) {}

  /** Próximo bloco de `n` amostras. */
  nextBlock(n: number): number[] {
    const bloco = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const t = this.amostra / this.sampleRate;
      const alfa = this.alphaAmplitude * Math.sin(2 * Math.PI * ALPHA_HZ * t);
      // Ruído gaussiano aproximado (soma de uniformes).
      const ruido = (Math.random() + Math.random() + Math.random() - 1.5) * 12;
      bloco[i] = alfa + ruido;
      this.amostra += 1;
    }
    return bloco;
  }
}
