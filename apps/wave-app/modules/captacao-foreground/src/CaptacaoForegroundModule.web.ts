import { registerWebModule, NativeModule } from "expo";

/**
 * No web não existe serviço em primeiro plano — nem faz sentido: a captação
 * sequer é suportada ali (ADR-0038/P6-b). Os métodos existem só para o
 * `index.ts` ter o mesmo formato em todas as plataformas.
 */
class CaptacaoForegroundModule extends NativeModule {
  iniciar(): void {}
  parar(): void {}
}

export default registerWebModule(CaptacaoForegroundModule, "CaptacaoForeground");
