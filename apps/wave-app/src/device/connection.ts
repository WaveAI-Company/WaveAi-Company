/**
 * Captação no **Android**: Bluetooth Classic (SPP/RFCOMM).
 *
 * O MindWave Mobile 2 é dual-mode (`Architecture/21`, §2.1): fala SPP no
 * Android e BLE no iOS. Este arquivo cobre o Android; o iOS entra como
 * `connection.ios.ts` atrás do mesmo contrato, sem tocar no resto do app.
 *
 * O aparelho precisa estar **pareado no sistema** antes — SPP não descobre
 * dispositivo não pareado de forma útil.
 *
 * ⚠️ Este código depende de hardware e **não é exercitável em CI**. O que é
 * testável (o parser do protocolo) vive em `thinkgear.ts`, separado de
 * propósito.
 */

import { PermissionsAndroid, Platform } from "react-native";
import RNBluetoothClassic, {
  type BluetoothDevice,
} from "react-native-bluetooth-classic";

import {
  DeviceUnsupportedError,
  type DeviceConnection,
  type DeviceHandlers,
  type DeviceInfo,
} from "./DeviceConnection";
import { ThinkGearParser } from "./thinkgear";

/** Nome anunciado pelo aparelho (usado só para ordenar a lista). */
const NOME_PROVAVEL = /mindwave/i;

let dispositivo: BluetoothDevice | null = null;
let inscricao: { remove(): void } | null = null;

/**
 * Permissões de Bluetooth no Android.
 *
 * A partir do Android 12 (API 31) valem `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN`;
 * antes disso, o sistema exigia permissão de **localização** para varredura.
 */
async function garantirPermissoes(): Promise<void> {
  if (Platform.OS !== "android") return;

  const nivel = typeof Platform.Version === "number" ? Platform.Version : 0;
  const pedidos =
    nivel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const resultado = await PermissionsAndroid.requestMultiple(pedidos);
  const negada = Object.values(resultado).some(
    (estado) => estado !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (negada) {
    throw new Error("permissao de Bluetooth negada");
  }
}

/**
 * Converte o que a ponte nativa entrega em bytes.
 *
 * ⚠️ **PONTO A VALIDAR NO PRIMEIRO TESTE COM O APARELHO.** Usamos
 * `connectionType: "binary"`, em que a biblioteca entrega o payload em
 * **base64** — o modo padrão dela (`delimited`) faria parsing de string por
 * delimitador e destruiria um stream binário.
 *
 * Se o parser não fechar nenhum pacote (ver `badChecksums` alto e
 * `packetsParsed` zero), a hipótese do base64 está errada e a alternativa é
 * ler como texto `ascii` e usar `charCodeAt(i) & 0xff`. A decodificação está
 * isolada aqui exatamente para essa troca ser de uma linha.
 */
function paraBytes(conteudo: string): number[] {
  const binario = globalThis.atob(conteudo);
  const bytes = new Array<number>(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export const deviceConnection: DeviceConnection = {
  supported: Platform.OS === "android",
  transport: "spp",

  async listDevices(): Promise<DeviceInfo[]> {
    if (Platform.OS !== "android") throw new DeviceUnsupportedError();
    await garantirPermissoes();

    const pareados = await RNBluetoothClassic.getBondedDevices();
    return pareados
      .map((d) => ({ id: d.address, name: d.name || d.address }))
      // MindWave primeiro: a lista de pareados costuma ter fone, carro etc.
      .sort((a, b) => Number(NOME_PROVAVEL.test(b.name)) - Number(NOME_PROVAVEL.test(a.name)));
  },

  async connect(deviceId: string, handlers: DeviceHandlers): Promise<void> {
    if (Platform.OS !== "android") throw new DeviceUnsupportedError();
    await garantirPermissoes();

    handlers.onStatus?.("connecting");
    try {
      dispositivo = await RNBluetoothClassic.connectToDevice(deviceId, {
        connectorType: "rfcomm",
        // O ThinkGear é um stream binário contínuo. O padrão da biblioteca é
        // `delimited`, que faria parsing de string e corromperia o sinal.
        connectionType: "binary",
      });
    } catch (erro) {
      handlers.onStatus?.("error", String(erro));
      throw erro;
    }

    const parser = new ThinkGearParser();
    inscricao = dispositivo.onDataReceived((evento) => {
      for (const pacote of parser.feed(paraBytes(evento.data))) {
        if (pacote.poorSignal !== undefined) {
          handlers.onSignalQuality?.({ poorSignal: pacote.poorSignal });
        }
        const agora = Date.now();
        for (const amplitude of pacote.rawSamples) {
          handlers.onRawSample?.({ t: agora, amplitude });
        }
      }
    });

    handlers.onStatus?.("connected");
  },

  async disconnect(): Promise<void> {
    inscricao?.remove();
    inscricao = null;
    if (dispositivo) {
      await dispositivo.disconnect().catch(() => undefined);
      dispositivo = null;
    }
  },
};
