/**
 * Captação no **iOS**: BLE (GATT) via `react-native-ble-plx` (ADR-0040).
 *
 * O MindWave Mobile 2 é dual-mode (`Architecture/21` §2.1): fala SPP no Android
 * (ver `connection.ts`) e **BLE no iOS**, sem MFi. Este arquivo cobre o iOS
 * atrás do **mesmo contrato** `DeviceConnection`; o resto do app não sabe a
 * diferença de transporte.
 *
 * **Auto-descoberta da característica de dados** (emenda à decisão #3 da
 * ADR-0040): o GATT do aparelho não é documentado, então **não fixamos UUID**.
 * Ao conectar, assinamos **todas** as características `notify` e deixamos o
 * `ThinkGearParser` decidir — a primeira cujo fluxo **fecha pacotes ThinkGear**
 * é a de dados; as outras são descartadas. Isso mantém a escolha do *aparelho*
 * por scan (como no Android) e dispensa constante amarrada a um MindWave.
 *
 * O ID do dispositivo (instância) segue vindo do scan/seleção do usuário —
 * nada específico de um aparelho é gravado no código.
 *
 * ⚠️ Depende de módulo nativo/hardware; **não exercitável em CI** nem no web. O
 * parser (testável) vive em `thinkgear.ts`.
 */

import {
  BleManager,
  State,
  type Device,
  type Subscription,
} from "react-native-ble-plx";

import {
  DeviceBusyError,
  type DeviceConnection,
  type DeviceHandlers,
  type DeviceInfo,
  type RawSample,
} from "./DeviceConnection";
import { ThinkGearParser, type TGPacket } from "./thinkgear";

/** Nome anunciado pelo aparelho — só para ordenar/destacar a lista. */
const NOME_PROVAVEL = /mindwave/i;
/** Janela de varredura antes de devolver a lista de aparelhos. */
const TEMPO_SCAN_MS = 6000;

let gerenciador: BleManager | null = null;
let assinaturas = new Map<string, Subscription>();
let assinaturaDesconexao: Subscription | null = null;
let dispositivoId: string | null = null;
/** Trava de conexão — ver o comentário extenso em `connection.ts`. */
let conectando = false;

/** Cria o gerenciador só quando usado — construir exige o módulo nativo. */
function obterGerenciador(): BleManager {
  gerenciador ??= new BleManager();
  return gerenciador;
}

/** Espera o rádio ligar (operar em estado errado não acha/entrega nada). */
function aguardarLigado(manager: BleManager): Promise<void> {
  return new Promise((resolve, reject) => {
    const sub = manager.onStateChange((estado) => {
      if (estado === State.PoweredOn) {
        sub.remove();
        resolve();
      } else if (estado === State.Unsupported || estado === State.Unauthorized) {
        sub.remove();
        reject(new Error(`Bluetooth indisponível (${estado}).`));
      }
    }, true);
  });
}

/**
 * A ponte nativa entrega o valor da característica em **base64**. Decodifica
 * para bytes crus do ThinkGear (mesmo formato que o SPP entrega no Android).
 */
function paraBytes(base64: string): number[] {
  const binario = globalThis.atob(base64);
  const bytes = new Array<number>(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** Repassa um pacote decodificado aos handlers — idêntico ao caminho Android. */
function emitir(pacote: TGPacket, handlers: DeviceHandlers): void {
  if (pacote.poorSignal !== undefined) {
    handlers.onSignalQuality?.({ poorSignal: pacote.poorSignal });
  }
  // eSense (ADR-0034): repassado como veio; a UI rotula e separa das features.
  if (pacote.attention !== undefined || pacote.meditation !== undefined) {
    handlers.onEsense?.({ attention: pacote.attention, meditation: pacote.meditation });
  }
  const agora = Date.now();
  for (const amplitude of pacote.rawSamples) {
    const amostra: RawSample = { t: agora, amplitude };
    handlers.onRawSample?.(amostra);
  }
}

function limparAssinaturas(): void {
  for (const sub of assinaturas.values()) sub.remove();
  assinaturas = new Map();
}

export const deviceConnection: DeviceConnection = {
  supported: true,
  transport: "ble",

  async bluetoothLigado(): Promise<boolean> {
    return (await obterGerenciador().state()) === State.PoweredOn;
  },

  /**
   * Sempre `false`: **o iOS não deixa um app ligar o Bluetooth**. Não é
   * limitação da biblioteca — é da plataforma, e nenhum app faz isso. O que
   * resta é instruir a pessoa a ligar pela Central de Controle ou pelos
   * Ajustes, e é o que a tela faz quando recebe este `false`.
   */
  async pedirBluetooth(): Promise<boolean> {
    return false;
  },

  async listDevices(): Promise<DeviceInfo[]> {
    const manager = obterGerenciador();
    await aguardarLigado(manager);

    const vistos = new Map<string, DeviceInfo & { provavel: boolean; rssi: number | null }>();
    return new Promise<DeviceInfo[]>((resolve, reject) => {
      manager.startDeviceScan(null, null, (erro, device) => {
        if (erro) {
          manager.stopDeviceScan();
          reject(new Error(erro.message));
          return;
        }
        if (!device || vistos.has(device.id)) return;
        const nome = device.name || device.localName || device.id;
        vistos.set(device.id, {
          id: device.id,
          name: nome,
          provavel: NOME_PROVAVEL.test(nome),
          rssi: device.rssi,
        });
      });

      setTimeout(() => {
        manager.stopDeviceScan();
        const lista = [...vistos.values()]
          // MindWave primeiro; depois por sinal mais forte.
          .sort(
            (a, b) =>
              Number(b.provavel) - Number(a.provavel) || (b.rssi ?? -999) - (a.rssi ?? -999),
          )
          .map(({ id, name }) => ({ id, name }));
        resolve(lista);
      }, TEMPO_SCAN_MS);
    });
  },

  async connect(deviceId: string, handlers: DeviceHandlers): Promise<void> {
    // Mesma trava do transporte Android, pelo mesmo motivo: o rádio é um só, e
    // a guarda tem de estar onde o recurso está — não só na tela. Marcada
    // antes de qualquer `await`, senão duas chamadas concorrentes passam as
    // duas e a primeira conexão fica órfã.
    if (conectando || dispositivoId) throw new DeviceBusyError();
    conectando = true;

    const manager = obterGerenciador();
    handlers.onStatus?.("connecting");

    let dispositivo: Device;
    try {
      manager.stopDeviceScan();
      await aguardarLigado(manager);
      dispositivo = await manager.connectToDevice(deviceId);
      await dispositivo.discoverAllServicesAndCharacteristics();
    } catch (erro) {
      // Solta a trava: sem isto uma falha deixaria o app achando para sempre
      // que há tentativa em curso, e nenhuma nova seria aceita.
      conectando = false;
      handlers.onStatus?.("error", String(erro));
      throw erro;
    }
    conectando = false;

    dispositivoId = deviceId;
    limparAssinaturas();

    // Sensor caiu no meio da sessão (bateria/alcance): sinaliza como erro em vez
    // de silenciar — espelha o comportamento do Android (falha na leitura).
    assinaturaDesconexao?.remove();
    assinaturaDesconexao = dispositivo.onDisconnected(() => {
      handlers.onStatus?.("error", "conexão com o aparelho perdida");
    });

    // Auto-descoberta: assina TODA característica `notify` e deixa o parser
    // eleger a de dados (a primeira que fecha pacotes ThinkGear).
    const parsers = new Map<string, ThinkGearParser>();
    let travada: string | null = null;
    let candidatas = 0;

    for (const servico of await dispositivo.services()) {
      for (const c of await servico.characteristics()) {
        if (!c.isNotifiable) continue;
        candidatas += 1;
        const chave = `${servico.uuid}|${c.uuid}`;
        parsers.set(chave, new ThinkGearParser());

        const sub = dispositivo.monitorCharacteristicForService(
          servico.uuid,
          c.uuid,
          (erro, caracteristica) => {
            if (erro) {
              handlers.onStatus?.("error", erro.message);
              return;
            }
            if (!caracteristica?.value) return;
            // Já elegeu outra característica: ignora o resto do ruído.
            if (travada && travada !== chave) return;

            const parser = parsers.get(chave);
            if (!parser) return;
            const pacotes = parser.feed(paraBytes(caracteristica.value));
            if (pacotes.length === 0) return;

            if (!travada) {
              travada = chave;
              // Desliga as demais candidatas — a de dados foi encontrada.
              for (const [k, s] of assinaturas) {
                if (k !== chave) {
                  s.remove();
                  assinaturas.delete(k);
                }
              }
            }
            for (const pacote of pacotes) emitir(pacote, handlers);
          },
        );
        assinaturas.set(chave, sub);
      }
    }

    if (candidatas === 0) {
      await this.disconnect();
      const erro = new Error(
        "Aparelho sem característica de notificação — não parece um MindWave.",
      );
      handlers.onStatus?.("error", erro.message);
      throw erro;
    }

    handlers.onStatus?.("connected");
  },

  async disconnect(): Promise<void> {
    limparAssinaturas();
    assinaturaDesconexao?.remove();
    assinaturaDesconexao = null;
    if (dispositivoId && gerenciador) {
      await gerenciador.cancelDeviceConnection(dispositivoId).catch(() => undefined);
    }
    dispositivoId = null;
    // Desconectar durante uma tentativa é o cancelamento dela.
    conectando = false;
  },
};
