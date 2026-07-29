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
 * Captação é possível nesta superfície? Verdadeiro no mobile (aparelho) e onde
 * o simulador está ligado (dev). No web de produção é falso — a captação
 * acontece no app do celular, e o web mostra só o que consegue.
 */
export function capturaDisponivel(): boolean {
  return deviceConnection.supported || SIMULADOR_HABILITADO;
}
