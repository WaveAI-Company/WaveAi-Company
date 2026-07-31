/**
 * Diagnóstico BLE no **web**: não existe (não há acesso ao rádio no navegador).
 *
 * Stub que declara indisponibilidade, no mesmo padrão de `connection.web.ts`.
 * A tela de diagnóstico é gated para dev/nativo e não é linkada no web; este
 * stub existe para o bundle web não importar `react-native-ble-plx` (módulo
 * nativo) via resolução por plataforma do Metro.
 */

import {
  DeviceUnsupportedError,
} from "./DeviceConnection";
import type { BleDiagnostics, BleInspection } from "./bleDiagnostics.types";

export const bleDiagnostics: BleDiagnostics = {
  supported: false,

  scan(_onDevice, onError) {
    onError("Diagnóstico BLE indisponível no navegador.");
  },

  stopScan() {
    // Nada a parar.
  },

  async inspect(): Promise<BleInspection> {
    throw new DeviceUnsupportedError();
  },

  async disconnect(): Promise<void> {
    // Nada a desconectar.
  },

  destroy() {
    // Nada a liberar.
  },
};
