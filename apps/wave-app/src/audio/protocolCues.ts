import { Platform, Vibration } from "react-native";
import * as Speech from "expo-speech";

/**
 * Pistas de áudio do protocolo guiado (P4-d).
 *
 * Existe porque, de olhos fechados, a pessoa não vê a contagem: precisa de uma
 * pista **não-visual** para saber quando a fase termina e quando abrir os olhos.
 *
 * Capability por plataforma (Architecture/22): a **voz** usa `expo-speech`
 * (`speechSynthesis` no web — funciona já; TTS do SO no mobile — passa a falar
 * após um rebuild do dev-client). A **vibração** é a pista tátil do mobile
 * (`Vibration` do RN, built-in); o **beep** cobre o web, onde vibrar é no-op.
 *
 * Nada aqui é análise nem claim clínica — são só instruções de captação.
 */

const ehWeb = Platform.OS === "web";

/** AudioContext do web, criado sob demanda (precisa de gesto do usuário). */
let audioCtx: AudioContext | null = null;

function beep(frequencia: number, duracaoMs: number): void {
  if (!ehWeb || typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = frequencia;
    osc.type = "sine";
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const agora = audioCtx.currentTime;
    osc.start(agora);
    osc.stop(agora + duracaoMs / 1000);
  } catch {
    // Áudio é acessório: falhar aqui nunca deve quebrar a captação.
  }
}

function vibrar(padrao: number | number[]): void {
  if (ehWeb) return;
  try {
    Vibration.vibrate(padrao);
  } catch {
    // idem: pista tátil é acessório.
  }
}

export const protocolCues = {
  /** Fala uma instrução curta em pt-BR (interrompe a anterior). */
  announce(texto: string): void {
    try {
      Speech.stop();
      Speech.speak(texto, { language: "pt-BR" });
    } catch {
      // Sem TTS disponível, as pistas tátil/beep ainda cobrem a transição.
    }
  },

  /** Batida de cada segundo na contagem final (beep no web, vibra no mobile). */
  tick(): void {
    beep(880, 90);
    vibrar(60);
  },

  /** Transição de fase: pista mais forte que o tick. */
  transition(): void {
    beep(660, 180);
    vibrar([0, 120, 80, 120]);
  },

  /** Cancela qualquer fala pendente (ao silenciar ou desmontar). */
  stop(): void {
    try {
      Speech.stop();
    } catch {
      // no-op
    }
  },
};
