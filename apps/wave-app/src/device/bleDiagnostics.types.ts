/**
 * Contrato do **diagnóstico BLE** (fatia iOS da ADR-0040).
 *
 * Ferramenta de **desenvolvimento**: o GATT do MindWave Mobile 2 no iOS não é
 * documentado publicamente, então a única forma honesta de descobrir o serviço
 * e a característica que transmitem os pacotes ThinkGear é **enumerar o aparelho
 * físico**. Esta tela lista serviços/características/propriedades para o dev ler
 * os UUIDs; depois eles são travados numa constante no `connection.ios.ts`.
 *
 * **Não é função do produto** — fica atrás de gate de dev (ver
 * `capture/availability.ts`, `DIAGNOSTICO_BLE_HABILITADO`).
 *
 * O transporte é **assimétrico por plataforma** como o resto da captação: a
 * implementação nativa (`bleDiagnostics.ts`) usa `react-native-ble-plx`; o web
 * (`bleDiagnostics.web.ts`) é um stub que declara indisponibilidade.
 */

export type BleDeviceInfo = {
  id: string;
  name: string;
  /** Intensidade do sinal (dBm), quando o scan reporta. */
  rssi: number | null;
  /** Nome casa com /mindwave/i — só para ordenar/destacar na lista. */
  provavel: boolean;
};

/** Propriedades GATT de uma característica — o que interessa é `notifiable`. */
export type BleCharInfo = {
  uuid: string;
  /** Emite `notify` — candidata a carregar o stream ThinkGear contínuo. */
  notifiable: boolean;
  indicatable: boolean;
  readable: boolean;
  writableWithResponse: boolean;
  writableWithoutResponse: boolean;
};

export type BleServiceInfo = {
  uuid: string;
  characteristics: BleCharInfo[];
};

export type BleInspection = {
  id: string;
  name: string;
  services: BleServiceInfo[];
};

export interface BleDiagnostics {
  /** `false` no web: a tela avisa em vez de tentar. */
  readonly supported: boolean;

  /** Inicia a varredura; reporta cada aparelho (já deduplicado) e erros. */
  scan(onDevice: (device: BleDeviceInfo) => void, onError: (message: string) => void): void;
  stopScan(): void;
  /** Conecta, descobre todos os serviços/características e os devolve. */
  inspect(deviceId: string): Promise<BleInspection>;
  disconnect(deviceId: string): Promise<void>;
  /** Libera o gerenciador nativo (ao sair da tela). */
  destroy(): void;
}
