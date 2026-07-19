/**
 * Armazenamento do refresh no **mobile** (ADR-0021).
 *
 * `expo-secure-store` usa Keychain (iOS) e Keystore (Android) — armazenamento
 * cifrado pelo sistema, não um arquivo qualquer do app. O access token não é
 * persistido: fica só em memória.
 */

import * as SecureStore from "expo-secure-store";

import type { TokenStorage } from "./tokenStorage";

const REFRESH_KEY = "waveai.refresh_token";

export const tokenStorage: TokenStorage = {
  usesHttpOnlyCookie: false,

  async saveRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async clearRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
