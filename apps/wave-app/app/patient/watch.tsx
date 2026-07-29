import { watchMyLive } from "../../src/api/liveWatch";
import { Disclaimer } from "../../src/components/Disclaimer";
import { LiveSpectator } from "../../src/components/LiveSpectator";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { useRoleAccent } from "../../src/theme";

/**
 * Espectador ao vivo do titular (ADR-0039): acompanha, pelo navegador, a
 * captação que acontece no **celular**. A view é o `LiveSpectator`
 * compartilhado; aqui só se escolhe a origem (a própria transmissão).
 */
export default function PatientWatchScreen() {
  const papel = useRoleAccent();
  return (
    <ScreenContainer>
      <ScreenHeading
        title="Assistir ao vivo"
        lead="Acompanhe, pelo navegador, a captação que está acontecendo no seu celular. As features são calculadas no servidor."
      />
      <LiveSpectator
        subscribe={watchMyLive}
        accent={papel.accent}
        semCaptacaoTexto="Abra a captação no app do celular para acompanhar por aqui em tempo real."
      />
      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}
