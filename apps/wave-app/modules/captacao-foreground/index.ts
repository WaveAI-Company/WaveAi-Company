/**
 * Serviço em primeiro plano da captação (ADR-0052, parte 2).
 *
 * Mantém o processo vivo enquanto a tela está apagada. **Só Android**: no iOS o
 * equivalente é `UIBackgroundModes: bluetooth-central`, que é configuração e
 * não serviço, e no web não existe nada disso.
 *
 * Nas plataformas sem serviço as funções são **no-op silencioso e deliberado**:
 * quem chama é o `CaptureSession`, e obrigá-lo a ramificar por plataforma
 * espalharia `Platform.OS` por cima de uma regra de sessão. O silêncio aqui não
 * esconde falha — esconde ausência de mecanismo.
 */
import { Platform } from "react-native";

import CaptacaoForegroundModule from "./src/CaptacaoForegroundModule";

const disponivel = Platform.OS === "android";

/** Sobe o serviço e a notificação. Idempotente. */
export function iniciarServicoCaptacao(): void {
  if (!disponivel) return;
  try {
    CaptacaoForegroundModule.iniciar();
  } catch {
    // Falhar em subir o serviço **não pode derrubar a captação**: sem ele a
    // sessão ainda funciona com o app na tela, que é o comportamento que existia
    // antes desta decisão. Degradar é melhor que impedir.
  }
}

/** Derruba o serviço e a notificação. */
export function pararServicoCaptacao(): void {
  if (!disponivel) return;
  try {
    CaptacaoForegroundModule.parar();
  } catch {
    // Idem: o serviço some sozinho quando o processo morre.
  }
}
