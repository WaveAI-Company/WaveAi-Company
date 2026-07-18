import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "../src/theme";

/** Layout raiz: pilha de navegação compartilhada por web e mobile. */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "WaveAI" }} />
        <Stack.Screen name="patient/index" options={{ title: "Área do paciente" }} />
        <Stack.Screen name="doctor/index" options={{ title: "Área do médico" }} />
      </Stack>
    </>
  );
}
