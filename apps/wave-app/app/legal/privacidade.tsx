import { LegalPage } from "../../src/components/LegalPage";
import { POLITICA_DE_PRIVACIDADE } from "../../src/legal/documents";

/**
 * Política de Privacidade — rota **neutra**: acessível sem sessão (a Play Store
 * exige URL pública) e sem expulsar quem já entrou (o link do rodapé precisa
 * funcionar para quem está logado).
 */
export default function PrivacidadeScreen() {
  return <LegalPage documento={POLITICA_DE_PRIVACIDADE} />;
}
