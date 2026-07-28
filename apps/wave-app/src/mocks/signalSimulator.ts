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

  /**
   * eSense **simulado** (attention/meditation), 0..100, derivando devagar.
   *
   * Existe só para exercitar o caminho do eSense (device → gateway → UI) sem
   * hardware. **Não é medição de ninguém** — a tela que o usa já rotula o sinal
   * como simulado, e o eSense real carrega o rótulo proprietário/não-validado
   * (ADR-0034). Os valores acompanham a "fase alfa" para dar um movimento
   * plausível, sem qualquer pretensão de significado.
   */
  nextEsense(): { attention: number; meditation: number } {
    const t = this.amostra / this.sampleRate;
    const onda = (freq: number, fase: number) =>
      Math.round(50 + 30 * Math.sin(2 * Math.PI * freq * t + fase));
    return { attention: onda(0.05, 0), meditation: onda(0.03, Math.PI / 2) };
  }

  /**
   * `poorSignal` **simulado** (0..200), para exercitar a leitura de contato
   * (P4-a) sem aparelho. Começa alto (contato ainda se acomodando) e cai para
   * bom, passando pela faixa "ajuste" — assim a UI de contato mostra os três
   * estados no web. **Não é medição de ninguém**: a tela já rotula como simulado.
   */
  nextPoorSignal(): number {
    const t = this.amostra / this.sampleRate;
    // Decaimento suave de ~200 para ~0 nos primeiros segundos, com leve
    // ondulação para não travar exatamente em um valor.
    const base = 200 * Math.exp(-t / 6);
    const ondulacao = 6 * (Math.sin(2 * Math.PI * 0.2 * t) + 1);
    return Math.min(200, Math.max(0, Math.round(base + ondulacao)));
  }
}
