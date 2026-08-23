import { LegalPage } from "../../src/components/LegalPage";
import { TERMOS_DE_USO } from "../../src/legal/documents";

/** Termos de Uso — rota **neutra**, como a Política de Privacidade. */
export default function TermosScreen() {
  return <LegalPage documento={TERMOS_DE_USO} />;
}
