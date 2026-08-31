import { NativeModule, requireNativeModule } from "expo";

declare class CaptacaoForegroundModule extends NativeModule {
  /** Sobe o serviço em primeiro plano e a notificação. Idempotente. */
  iniciar(): void;
  /** Derruba o serviço e a notificação. */
  parar(): void;
}

export default requireNativeModule<CaptacaoForegroundModule>("CaptacaoForeground");
