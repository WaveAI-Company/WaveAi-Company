import { Platform } from "react-native";

import { deviceConnection } from "../device/connection";

/**
 * Disponibilidade de captação por plataforma/superfície (P6-b, ADR-0038).
 *
 * O **simulador** é ferramenta de dev/teste — não faz sentido como função do
 * produto (no web não há aparelho; fingir captar seria desonesto). Fica atrás de
 * um gate: ligado em desenvolvimento, desligado no build de produção, com
 * override explícito por variável de ambiente para o smoke.
 *
 * `EXPO_PUBLIC_ENABLE_SIMULATOR`: "true"/"false" força; ausente = segue `__DEV__`.
 */
const flag = process.env.EXPO_PUBLIC_ENABLE_SIMULATOR;

export const SIMULADOR_HABILITADO =
  flag === "true" ? true : flag === "false" ? false : __DEV__;

/**
 * Diagnóstico BLE (fatia iOS da ADR-0040): ferramenta de **dev** para ler os
 * UUIDs de serviço/característica do headset físico — o GATT do MindWave Mobile
 * 2 no iOS não é documentado. **Nativo-only** (módulo BLE) e atrás de flag de
 * dev; **não** é função do produto.
 *
 * `EXPO_PUBLIC_ENABLE_BLE_DIAG`: "true"/"false" força; ausente = segue `__DEV__`.
 */
const flagBleDiag = process.env.EXPO_PUBLIC_ENABLE_BLE_DIAG;

export const DIAGNOSTICO_BLE_HABILITADO =
  Platform.OS !== "web" &&
  (flagBleDiag === "true" ? true : flagBleDiag === "false" ? false : __DEV__);

/**
 * Captação é possível nesta superfície? Verdadeiro no mobile (aparelho) e onde
 * o simulador está ligado (dev). No web de produção é falso — a captação
 * acontece no app do celular, e o web mostra só o que consegue.
 */
export function capturaDisponivel(): boolean {
  return deviceConnection.supported || SIMULADOR_HABILITADO;
}

/**
 * Assistir ao vivo (espectador, ADR-0039) faz sentido no **web**: o celular
 * capta e o navegador acompanha. No próprio aparelho que capta é redundante, e o
 * `fetch` do RN não expõe o corpo em stream — então é capability de web.
 */
export function espectadorDisponivel(): boolean {
  return Platform.OS === "web";
}
