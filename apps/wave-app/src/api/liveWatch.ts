/**
 * Assinatura da transmissão ao vivo do próprio titular (ADR-0039).
 *
 * Lê `GET /me/live` por **SSE via fetch**: o corpo é um `ReadableStream` lido com
 * o header `Authorization` (o app é Bearer; o `EventSource` nativo não seta
 * header). É a mesma intenção do ADR — SSE só-leitura, sem token na URL,
 * reusando a auth do app. **Capability de web:** no mobile o `fetch` não expõe o
 * corpo em stream (a tela é oferecida só no web).
 */

import { API_URL, getAccessToken } from "../auth/api";
import type { LiveEsense, LiveFeatures } from "./stream";

export type WatchClosed = { report: unknown; result: unknown };

export type WatchHandlers = {
  onStatus?(live: boolean): void;
  onFeatures?(features: LiveFeatures): void;
  onEsense?(esense: LiveEsense): void;
  onClosed?(closed: WatchClosed): void;
  onEnded?(): void;
  onError?(detail: string): void;
};

type EventoSSE = {
  type?: string;
  live?: boolean;
  features?: LiveFeatures;
  esense?: LiveEsense;
  report?: unknown;
  result?: unknown;
};

/**
 * Assina a própria transmissão ao vivo. Devolve uma função que **encerra** a
 * assinatura (chamar ao desmontar a tela).
 */
export function watchMyLive(handlers: WatchHandlers): () => void {
  const controller = new AbortController();
  void consumir(controller, handlers);
  return () => controller.abort();
}

async function consumir(controller: AbortController, h: WatchHandlers): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    h.onError?.("sem sessao autenticada");
    return;
  }
  try {
    const resp = await fetch(`${API_URL}/me/live`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      credentials: "include",
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) {
      h.onError?.(`nao foi possivel assinar a transmissao (${resp.status})`);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE separa eventos por linha em branco.
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        despachar(buffer.slice(0, sep), h);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
      }
    }
  } catch (e) {
    // Abortar (troca de tela) não é erro.
    if (!controller.signal.aborted) {
      h.onError?.(e instanceof Error ? e.message : "conexao interrompida");
    }
  }
}

function despachar(bruto: string, h: WatchHandlers): void {
  const linhas = bruto.split("\n");
  const linhaData = linhas.find((l) => l.startsWith("data:"));
  if (!linhaData) return; // comentário de keepalive ou frame sem dados
  let evento: EventoSSE;
  try {
    evento = JSON.parse(linhaData.slice("data:".length).trim());
  } catch {
    return;
  }
  // O tipo vem no `data` (features/esense/closed/ended) ou só na linha
  // `event:` (o `status` inicial manda apenas `{live}`).
  const nomeEvento = linhas.find((l) => l.startsWith("event:"))?.slice("event:".length).trim();
  switch (evento.type ?? nomeEvento) {
    case "status":
      h.onStatus?.(Boolean(evento.live));
      break;
    case "features":
      if (evento.features) h.onFeatures?.(evento.features);
      break;
    case "esense":
      if (evento.esense) h.onEsense?.(evento.esense);
      break;
    case "closed":
      h.onClosed?.({ report: evento.report, result: evento.result });
      break;
    case "ended":
      h.onEnded?.();
      break;
  }
}
