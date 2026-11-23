package expo.modules.captacaoforeground

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
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

    /**
     * Espera `ms` e resolve — **com a tela apagada também**.
     *
     * Existe porque timer de JS (`setTimeout`/`setInterval`) não dispara no
     * Android com a activity pausada: o relógio deles anda pelo Choreographer,
     * que para junto com a tela (medição da ADR-0052). Já a resolução de uma
     * promessa nativa chega ao JS como os eventos do Bluetooth, que seguem
     * chegando. O `Handler` do looper principal segue rodando porque o
     * serviço em primeiro plano mantém o processo vivo.
     */
    AsyncFunction("esperar") { ms: Int, promise: Promise ->
      Handler(Looper.getMainLooper()).postDelayed({ promise.resolve(null) }, ms.toLong())
    }
  }
}
