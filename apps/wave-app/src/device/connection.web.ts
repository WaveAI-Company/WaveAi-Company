/**
 * Captação no **web**: não existe (`Architecture/22`, §3).
 *
 * Nem Bluetooth Classic (Android) nem BLE do MindWave são alcançáveis pelo
 * navegador de forma confiável. Em vez de falhar no meio do fluxo, a
 * capability é declarada como ausente e a UI avisa antes de oferecer a ação.
 */

import {
  DeviceUnsupportedError,
  type DeviceConnection,
  type DeviceInfo,
} from "./DeviceConnection";

export const deviceConnection: DeviceConnection = {
  supported: false,
  transport: "none",

  async listDevices(): Promise<DeviceInfo[]> {
    return [];
  },

  async connect(): Promise<void> {
    throw new DeviceUnsupportedError();
  },

  async disconnect(): Promise<void> {
    // Nada a desconectar.
  },
};
