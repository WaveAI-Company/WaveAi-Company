/**
 * Preferência de tema no **web**: `localStorage`.
 *
 * Aqui é aceitável — e é o contraste com `auth/storage.web.ts`, onde
 * `localStorage` é **proibido**: lá o dado é um token de sessão (alvo de XSS),
 * aqui é a escolha de cor de quem usa. Guardar preferência não cria risco.
 */

import type { ThemePreference } from "./tokens";

const CHAVE = "waveai.theme_preference";

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const valor = globalThis.localStorage?.getItem(CHAVE);
    return valor === "light" || valor === "dark" || valor === "system" ? valor : null;
  } catch {
    // Navegador com storage bloqueado: cai no padrão do sistema.
    return null;
  }
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  try {
    globalThis.localStorage?.setItem(CHAVE, pref);
  } catch {
    // Idem.
  }
}
