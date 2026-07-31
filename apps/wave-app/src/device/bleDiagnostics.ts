/**
 * Diagnóstico BLE **nativo** (Android/iOS) via `react-native-ble-plx`.
 *
 * Ver `bleDiagnostics.types.ts` para o porquê. Este arquivo depende do módulo
 * nativo (dev-client/EAS) e **não é exercitável em CI** nem no web (stub).
 */

import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  State,
  type Device,
  type Subscription,
} from "react-native-ble-plx";

import type {
  BleDeviceInfo,
  BleDiagnostics,
  BleInspection,
  BleServiceInfo,
} from "./bleDiagnostics.types";

const NOME_PROVAVEL = /mindwave/i;

let gerenciador: BleManager | null = null;
let inscricaoEstado: Subscription | null = null;

/** Cria o gerenciador só quando usado — construir exige o módulo nativo. */
function obterGerenciador(): BleManager {
  gerenciador ??= new BleManager();
  return gerenciador;
}

/**
 * Permissões de scan no Android. No iOS o sistema pede sozinho no primeiro uso,
 * a partir do texto de `NSBluetoothAlwaysUsageDescription` (config plugin).
 */
async function garantirPermissoes(): Promise<void> {
  if (Platform.OS !== "android") return;
  const nivel = typeof Platform.Version === "number" ? Platform.Version : 0;
  const pedidos =
    nivel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const resultado = await PermissionsAndroid.requestMultiple(pedidos);
  const negada = Object.values(resultado).some(
    (estado) => estado !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (negada) throw new Error("permissao de Bluetooth negada");
}

/** Espera o rádio ligar antes de varrer (scan em estado errado não acha nada). */
function aguardarLigado(manager: BleManager): Promise<void> {
  return new Promise((resolve, reject) => {
    inscricaoEstado = manager.onStateChange((estado) => {
      if (estado === State.PoweredOn) {
        inscricaoEstado?.remove();
        inscricaoEstado = null;
        resolve();
      } else if (estado === State.Unsupported || estado === State.Unauthorized) {
        inscricaoEstado?.remove();
        inscricaoEstado = null;
        reject(new Error(`Bluetooth indisponível (${estado}).`));
      }
    }, true);
  });
}

function paraInfo(d: Device): BleDeviceInfo {
  const nome = d.name || d.localName || d.id;
  return { id: d.id, name: nome, rssi: d.rssi, provavel: NOME_PROVAVEL.test(nome) };
}

export const bleDiagnostics: BleDiagnostics = {
  supported: true,

  scan(onDevice, onError) {
    const vistos = new Set<string>();
    const manager = obterGerenciador();

    void (async () => {
      try {
        await garantirPermissoes();
        await aguardarLigado(manager);
        manager.startDeviceScan(null, null, (erro, device) => {
          if (erro) {
            onError(erro.message);
            return;
          }
          if (!device || vistos.has(device.id)) return;
          vistos.add(device.id);
          onDevice(paraInfo(device));
        });
      } catch (erro) {
        onError(erro instanceof Error ? erro.message : String(erro));
      }
    })();
  },

  stopScan() {
    gerenciador?.stopDeviceScan();
  },

  async inspect(deviceId): Promise<BleInspection> {
    const manager = obterGerenciador();
    manager.stopDeviceScan();
    const conectado = await manager.connectToDevice(deviceId);
    await conectado.discoverAllServicesAndCharacteristics();

    const services: BleServiceInfo[] = [];
    for (const servico of await conectado.services()) {
      const chars = await servico.characteristics();
      services.push({
        uuid: servico.uuid,
        characteristics: chars.map((c) => ({
          uuid: c.uuid,
          notifiable: c.isNotifiable,
          indicatable: c.isIndicatable,
          readable: c.isReadable,
          writableWithResponse: c.isWritableWithResponse,
          writableWithoutResponse: c.isWritableWithoutResponse,
        })),
      });
    }
    return {
      id: deviceId,
      name: conectado.name || conectado.localName || deviceId,
      services,
    };
  },

  async disconnect(deviceId): Promise<void> {
    await gerenciador?.cancelDeviceConnection(deviceId).catch(() => undefined);
  },

  destroy() {
    inscricaoEstado?.remove();
    inscricaoEstado = null;
    gerenciador?.stopDeviceScan();
    gerenciador?.destroy();
    gerenciador = null;
  },
};
