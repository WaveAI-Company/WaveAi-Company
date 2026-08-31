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
import { PermissionsAndroid, Platform } from "react-native";

import CaptacaoForegroundModule from "./src/CaptacaoForegroundModule";

const disponivel = Platform.OS === "android";

/** Android 13 (API 33): quando a notificação virou permissão de runtime. */
const ANDROID_13 = 33;

/**
 * Pede a permissão de notificação e responde **se o aviso vai aparecer** — que
 * não é a mesma pergunta que "a permissão foi pedida".
 *
 * `null` quando não se aplica: sem serviço, não há aviso a prometer nem a
 * desmentir, e a tela não deve avisar coisa nenhuma.
 *
 * **Por que isto existe** (medido no aparelho em 31/08/2026, Android 16):
 * `POST_NOTIFICATIONS` estava declarada no manifesto do módulo e mesmo assim o
 * `dumpsys` mostrava `granted=false`, **sem a flag `USER_SET`** — ou seja,
 * ninguém tinha sido perguntado. O serviço subia certo (`isForeground=true`,
 * `types=0x10`) e postava a notificação, mas o app estava em
 * `importance=NONE`, o padrão do Android 13+ para quem nunca pediu. Declarar
 * no manifesto não concede.
 */
export async function pedirPermissaoDeAviso(): Promise<boolean | null> {
  if (!disponivel) return null;
  if (Number(Platform.Version) < ANDROID_13) return true;
  try {
    const resposta = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return resposta === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    // Sem resposta do sistema, o honesto é assumir que o aviso NÃO aparece:
    // errar para o lado de avisar a mais é melhor que prometer um aviso que
    // ninguém vai ver (ADR-0027).
    return false;
  }
}

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
