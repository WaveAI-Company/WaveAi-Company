/**
 * Armazenamento do refresh no **web**: nenhum (ADR-0021).
 *
 * O refresh chega num cookie `httpOnly` setado pelo backend — JS não consegue
 * lê-lo nem gravá-lo, e é exatamente esse o ponto: um XSS não tem o que roubar.
 * Por isso `saveRefreshToken` é um no-op e `getRefreshToken` devolve `null`.
 *
 * **Nunca** guardar token em `localStorage`/`sessionStorage`.
 */

import type { TokenStorage } from "./tokenStorage";

export const tokenStorage: TokenStorage = {
  usesHttpOnlyCookie: true,

  async saveRefreshToken(): Promise<void> {
    // No-op: quem guarda o refresh é o navegador, via cookie httpOnly.
  },

  async getRefreshToken(): Promise<string | null> {
    // Inacessível ao JS por design. O cookie vai junto com credentials:"include".
    return null;
  },

  async clearRefreshToken(): Promise<void> {
    // No-op: o cookie é apagado pelo backend em POST /auth/logout.
  },
};
