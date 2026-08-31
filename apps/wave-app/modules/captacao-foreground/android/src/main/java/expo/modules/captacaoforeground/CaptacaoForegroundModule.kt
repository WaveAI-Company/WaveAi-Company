package expo.modules.captacaoforeground

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte entre o JavaScript e o serviço em primeiro plano (ADR-0052, parte 2).
 *
 * Superfície mínima de propósito: **ligar e desligar**. Quem decide quando é o
 * `CaptureSession`, que já é o dono da sessão; o nativo não sabe nada sobre
 * EEG, socket ou stream — só impede o sistema de suspender o processo.
 */
class CaptacaoForegroundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CaptacaoForeground")

    /** Sobe o serviço. Idempotente: chamar duas vezes não cria dois serviços. */
    Function("iniciar") {
      CaptacaoService.iniciar(appContext.reactContext ?: return@Function)
    }

    /** Derruba o serviço e a notificação junto. */
    Function("parar") {
      CaptacaoService.parar(appContext.reactContext ?: return@Function)
    }
  }
}
