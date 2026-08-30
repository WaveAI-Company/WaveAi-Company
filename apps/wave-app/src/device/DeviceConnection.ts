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

/**
 * Métricas **eSense** da NeuroSky (attention/meditation), 0..100.
 *
 * ⚠️ ADR-0034: algoritmo **proprietário e não-validado** — complemento
 * exploratório, **nunca** fundamento nem "medida de atenção" sem a ressalva.
 * Chega em pacotes ThinkGear próprios (~1 Hz), à parte do raw; **não** é
 * feature transparente do Catálogo N2 e não passa pela análise do servidor.
 */
export type Esense = {
  attention?: number;
  meditation?: number;
};

export type DeviceHandlers = {
  onRawSample?(sample: RawSample): void;
  onSignalQuality?(quality: SignalQuality): void;
  /** eSense do aparelho (ADR-0034). Opcional: nem todo pacote traz. */
  onEsense?(esense: Esense): void;
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

  /**
   * O rádio Bluetooth está ligado?
   *
   * Existe para a tela **perguntar antes** em vez de descobrir pelo erro. Sem
   * isto, quem tocasse "Procurar" com o Bluetooth desligado recebia
   * `Bluetooth mAdapter is not enabled` — a mensagem crua da biblioteca, em
   * inglês e com nome de variável dentro.
   */
  bluetoothLigado(): Promise<boolean>;

  /**
   * Pede para ligar o rádio. Devolve `true` se ficou ligado.
   *
   * **Não é simétrico entre as plataformas, e isso é do sistema, não nosso:**
   * no Android dá para pedir e o próprio sistema mostra o diálogo; no iOS
   * nenhum app liga o Bluetooth de fora — o máximo é levar a pessoa aos
   * Ajustes. Por isso o retorno é `boolean` e não `void`: quem chama precisa
   * saber se ainda tem de instruir a pessoa a fazer à mão.
   */
  pedirBluetooth(): Promise<boolean>;
}
