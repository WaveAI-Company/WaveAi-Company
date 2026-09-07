import { LegalPage } from "../../src/components/LegalPage";
import { EXCLUSAO_DE_CONTA } from "../../src/legal/documents";

/**
 * Exclusão de conta — rota **neutra**, como as outras duas de `legal/`.
 *
 * Existe porque a Play Store exige, de todo app que permite criar conta, um
 * endereço alcançável **sem instalar o app** onde se peça a exclusão. O
 * apagamento em si já existia dentro do aplicativo (ADR-0047) e não mudou; o
 * que faltava era o endereço público que o descreve.
 */
export default function ExcluirContaScreen() {
  return <LegalPage documento={EXCLUSAO_DE_CONTA} />;
}
