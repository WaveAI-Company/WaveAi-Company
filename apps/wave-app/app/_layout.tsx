import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, homeForRole, useAuth } from "../src/auth/AuthContext";
import { colors } from "../src/theme";

/** Rotas acessíveis sem sessão. */
const ROTAS_PUBLICAS = new Set(["login", "register"]);

/**
 * Guarda de rota: manda quem não tem sessão para o login e leva quem tem para
 * a área do seu papel — inclusive se tentar abrir a área do outro papel.
 */
function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const raiz = segments[0];
    const emRotaPublica = raiz === undefined || ROTAS_PUBLICAS.has(raiz);

    if (!user) {
      if (!emRotaPublica) router.replace("/login");
      return;
    }

    const destino = homeForRole(user.role);
    // Logado em rota pública, ou tentando a área do outro papel -> vai para a sua.
    if (emRotaPublica || `/${raiz}` !== destino) {
      router.replace(destino);
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator color={colors.patient} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "WaveAI" }} />
      <Stack.Screen name="login" options={{ title: "Entrar" }} />
      <Stack.Screen name="register" options={{ title: "Criar conta" }} />
      <Stack.Screen name="patient/index" options={{ title: "Área do paciente" }} />
      <Stack.Screen name="patient/live" options={{ title: "Estado ao vivo" }} />
      <Stack.Screen name="patient/history" options={{ title: "Histórico" }} />
      <Stack.Screen name="patient/profile" options={{ title: "Meu perfil" }} />
      <Stack.Screen name="doctor/index" options={{ title: "Área do médico" }} />
      <Stack.Screen name="doctor/patient/[id]" options={{ title: "Paciente" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RouteGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  carregando: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
});
