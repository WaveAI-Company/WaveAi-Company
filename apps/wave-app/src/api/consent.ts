/**
 * Consentimento informado para persistir dados biométricos derivados
 * (ADR-0026 / Medical/72).
 *
 * O texto do termo vive na tela `patient/consent`; aqui só a mecânica. O
 * backend é a fonte da versão vigente (`current_version`): o app envia a
 * versão que exibiu e, se o termo mudou nesse meio-tempo, o backend recusa —
 * consentir a um texto desatualizado não seria informado.
 */

import { request } from "../auth/api";

export type ConsentStatus = {
  consent_given: boolean;
  consent_given_at: string | null;
  /** Versão que o titular aceitou (ou `null`). */
  consent_version: string | null;
  /** Versão vigente do termo, definida pelo backend. */
  current_version: string;
};

export async function getConsentStatus(): Promise<ConsentStatus> {
  return request<ConsentStatus>("/me/consent", { auth: true });
}

/** Registra o consentimento para a versão que a tela exibiu. */
export async function giveConsent(version: string): Promise<void> {
  await request("/me/consent", { method: "POST", body: { version }, auth: true });
}

/**
 * Revoga o consentimento: nenhuma nova coleta é persistida. **Não apaga** o que
 * já existe — a exclusão é um direito separado (`DELETE /me/results`), para
 * revogar não destruir dados por engano (Medical/72 §2).
 */
export async function revokeConsent(): Promise<void> {
  await request("/me/consent", { method: "DELETE", auth: true });
}
