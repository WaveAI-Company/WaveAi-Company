import { NativeModule, requireNativeModule } from "expo";

declare class CaptacaoForegroundModule extends NativeModule {
  /** Sobe o serviço em primeiro plano e a notificação. Idempotente. */
  iniciar(): void;
  /** Derruba o serviço e a notificação. */
  parar(): void;
  /** Espera `ms` pelo relógio nativo — dispara com a tela apagada. */
  esperar(ms: number): Promise<void>;
}

export default requireNativeModule<CaptacaoForegroundModule>("CaptacaoForeground");
