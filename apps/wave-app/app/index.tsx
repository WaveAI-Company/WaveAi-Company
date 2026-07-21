import { useRouter } from "expo-router";

import { Button } from "../src/components/Button";
import { Disclaimer } from "../src/components/Disclaimer";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { ScreenHeading } from "../src/components/ScreenHeading";

/**
 * Tela inicial (pública). Quem já tem sessão é levado pela guarda de rota
 * direto para a área do seu papel.
 */
export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScreenHeading
        title="WaveAI"
        size="display"
        lead="Plataforma de captação e análise de EEG de consumo, com acompanhamento de bem-estar."
      />

      <Button label="Entrar" onPress={() => router.push("/login")} />
      <Button label="Criar conta" onPress={() => router.push("/register")} variant="secondary" />

      <Disclaimer />
    </ScreenContainer>
  );
}
