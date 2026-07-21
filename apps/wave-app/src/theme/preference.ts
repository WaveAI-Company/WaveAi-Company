/**
 * Preferência de tema no **mobile**.
 *
 * Usa `expo-secure-store` porque já é dependência do app (guarda o refresh,
 * ADR-0021) — evitar dependência **nativa** nova é decisão consciente: cada
 * uma exige recompilar o app, e isso já custou caro na #17.
 *
 * Não é segredo, mas o custo de reusar o que existe é zero.
 */

import * as SecureStore from "expo-secure-store";

import type { ThemePreference } from "./tokens";

const CHAVE = "waveai.theme_preference";

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const valor = await SecureStore.getItemAsync(CHAVE);
    return valor === "light" || valor === "dark" || valor === "system" ? valor : null;
  } catch {
    // Preferência é conforto, não função: falhar aqui cai no padrão do sistema.
    return null;
  }
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  try {
    await SecureStore.setItemAsync(CHAVE, pref);
  } catch {
    // Idem: não vale quebrar a tela por não conseguir lembrar a escolha.
  }
}
