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

  sendSamples(data: number[]): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.seq += 1;
    this.ws.send(JSON.stringify({ type: "samples", seq: this.seq, data }));
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
