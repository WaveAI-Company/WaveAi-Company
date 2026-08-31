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

    // `?.let` e não `?: return@Function`: o lambda de `Function` tem retorno
    // `Any?`, e um `return@Function` SEM valor implica `Unit` — que não casa com
    // a assinatura. Foi o erro que reprovou o primeiro build
    // ("Return type mismatch: expected 'Any?', actual 'Unit'"). O `let` devolve
    // `Unit?`, que é `Any?`, e ainda dispensa o early-return.

    /** Sobe o serviço. Idempotente: chamar duas vezes não cria dois serviços. */
    Function("iniciar") {
      appContext.reactContext?.let { CaptacaoService.iniciar(it) }
    }

    /** Derruba o serviço e a notificação junto. */
    Function("parar") {
      appContext.reactContext?.let { CaptacaoService.parar(it) }
    }
  }
}
