/**
 * Contrato de captação no cliente — espelha o `DeviceReader` do pacote
 * `wave_eeg` (ver `Architecture/21`, §6).
 *
 * Existe para isolar o resto do app do transporte, que é **assimétrico por
 * plataforma**: Android fala Bluetooth Classic (SPP/RFCOMM), iOS fala BLE/GATT
 * e o web não tem acesso a nenhum dos dois. Mitiga o risco R-07 (dependência
 * de SDK proprietário) e permite outro aparelho no futuro.
 */

export type RawSample = {
  /** Milissegundos desde a época, no momento em que o app recebeu a amostra. */
  t: number;
  /** Amplitude bruta do ThinkGear (inteiro com sinal). */
  amplitude: number;
};

export type DeviceStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/** Qualidade de contato reportada pelo próprio aparelho. */
export type SignalQuality = {
  /**
   * `poorSignal` do ThinkGear: 0 = contato bom, 200 = eletrodo solto.
   * Repassado **como veio**; interpretar (definir o que é "bom o suficiente")
   * é decisão em aberto — ver Q-TEC-06.
   */
  poorSignal: number;
};

export type DeviceHandlers = {
  onRawSample?(sample: RawSample): void;
  onSignalQuality?(quality: SignalQuality): void;
  onStatus?(status: DeviceStatus, detail?: string): void;
};

export type DeviceInfo = {
  id: string;
  name: string;
};

export class DeviceUnsupportedError extends Error {
  constructor(message = "captura indisponivel neste dispositivo") {
    super(message);
  }
}

export interface DeviceConnection {
  /** `false` no web: a UI deve avisar em vez de oferecer a captação. */
  readonly supported: boolean;
  /** Como o transporte funciona nesta plataforma (para exibir instruções). */
  readonly transport: "spp" | "ble" | "none";

  /** Aparelhos disponíveis. No Android, os já pareados no sistema. */
  listDevices(): Promise<DeviceInfo[]>;
  connect(deviceId: string, handlers: DeviceHandlers): Promise<void>;
  disconnect(): Promise<void>;
}
