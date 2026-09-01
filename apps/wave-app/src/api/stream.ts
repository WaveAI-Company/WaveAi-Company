/**
 * Cliente do gateway de captação (`WS /stream`, ADR-0025).
 *
 * O token vai na **primeira mensagem**, nunca na URL — query string vaza em
 * log de servidor, proxy e histórico.
 */

import { API_URL, getAccessToken } from "../auth/api";
import type { ResultMetrics } from "./results";

export type LiveFeatures = {
  rel_alpha?: number;
  relative_band_powers?: Record<string, number>;
  quality?: { signal_std: number; mains_power: number; mains_power_ratio: number };
  engine_version?: string;
  /** `true` quando a Analysis está indisponível (a captação continua). */
  unavailable?: boolean;
};

/**
 * eSense ao vivo relayado pelo gateway (ADR-0034).
 *
 * Vem numa chave **separada** das `LiveFeatures` de propósito: é métrica
 * proprietária/não-validada da NeuroSky, complemento e não fundamento. O
 * `proprietary` é o marcador vindo do servidor; o rótulo textual obrigatório
 * é responsabilidade da UI.
 */
/**
 * Fase do protocolo guiado, como ela viaja no protocolo (ADR-0053).
 *
 * Os valores são os rótulos canônicos que o `wave_eeg` já reconhece — a
 * tradução do vocabulário da tela ("aberto"/"fechado") acontece **uma vez**, na
 * borda, para o gateway não precisar traduzir nada no meio do caminho.
 */
export type StreamPhase = "eyes_open" | "eyes_closed";

export type LiveEsense = {
  attention?: number;
  meditation?: number;
  proprietary?: boolean;
};

/** Onde (e se) o relatório da sessão foi guardado (gate do ADR-0026). */
export type StorageStatus = {
  persisted: boolean;
  /** Por que não foi guardado: "sem consentimento", "persistencia desligada"… */
  reason?: string;
  result_id?: string;
};

/** Encerramento da sessão: o que foi medido e se foi guardado. */
export type SessionClosed = {
  sampleCount: number;
  /** Conteúdo do relatório — vem mesmo quando nada é persistido. */
  report: ResultMetrics | null;
  storage: StorageStatus;
};

export type StreamHandlers = {
  onSession?(sessionId: string): void;
  onFeatures?(features: LiveFeatures): void;
  /** eSense relayado pelo gateway (ADR-0034), à parte das features. */
  onEsense?(esense: LiveEsense): void;
  onError?(detail: string): void;
  onClosed?(closed: SessionClosed): void;
};

function wsUrl(): string {
  // wss:// quando a API estiver sob TLS — o token trafega nesta conexão.
  return `${API_URL.replace(/^http/, "ws")}/stream`;
}

/**
 * Uma sessão de streaming. Encapsula o handshake do protocolo para as telas
 * não precisarem conhecê-lo.
 */
export class StreamSession {
  private ws: WebSocket | null = null;
  private seq = 0;

  constructor(private readonly handlers: StreamHandlers) {}

  connect(device: string, sampleRate: number): Promise<void> {
    const token = getAccessToken();
    if (!token) {
      return Promise.reject(new Error("sem sessao autenticada"));
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl());
      this.ws = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (evento) => {
        const msg = JSON.parse(String(evento.data));
        switch (msg.type) {
          case "auth_ok":
            ws.send(JSON.stringify({ type: "start", device, sample_rate: sampleRate }));
            break;
          case "session":
            this.handlers.onSession?.(msg.session_id);
            resolve();
            break;
          case "ack":
            if (msg.features) this.handlers.onFeatures?.(msg.features);
            // eSense vem em chave própria e no ritmo do device (~1 Hz),
            // independente do fechamento da janela das features.
            if (msg.esense) this.handlers.onEsense?.(msg.esense);
            break;
          case "closed":
            this.handlers.onClosed?.({
              sampleCount: msg.sample_count,
              report: msg.report ?? null,
              storage: msg.result ?? { persisted: false },
            });
            break;
          case "error":
            this.handlers.onError?.(msg.detail);
            reject(new Error(msg.detail));
            break;
        }
      };

      ws.onerror = () => {
        this.handlers.onError?.("falha de conexao");
        reject(new Error("falha de conexao"));
      };
    });
  }

  /**
   * Envia um bloco de raw. O eSense (ADR-0034) e a fase do protocolo guiado
   * (ADR-0053), quando houver, **pegam carona** neste frame (opção A do
   * protocolo): campos opcionais, retrocompatível. O gateway relaya só o que
   * estiver bem-formado; valor ausente é omitido.
   */
  sendSamples(data: number[], esense?: LiveEsense, phase?: StreamPhase): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.seq += 1;
    const frame: Record<string, unknown> = { type: "samples", seq: this.seq, data };
    if (typeof esense?.attention === "number") frame.attention = esense.attention;
    if (typeof esense?.meditation === "number") frame.meditation = esense.meditation;
    if (phase) frame.phase = phase;
    this.ws.send(JSON.stringify(frame));
  }

  stop(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop" }));
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
