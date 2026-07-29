import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, homeForRole, useAuth } from "../src/auth/AuthContext";
import { AppShell } from "../src/components/shell/AppShell";
import { ThemeProvider, useRoleAccent, useTheme } from "../src/theme";

/** Rotas acessíveis sem sessão. */
const ROTAS_PUBLICAS = new Set(["login", "register"]);

/**
 * Guarda de rota: manda quem não tem sessão para o login e leva quem tem para
 * a área do seu papel — inclusive se tentar abrir a área do outro papel.
 */
function RouteGuard() {
  const { user, loading } = useAuth();
  const t = useTheme();
  const { accent } = useRoleAccent();
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
      <View style={[styles.carregando, { backgroundColor: t.colors.background }]}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  // Rotas públicas (login/registro/landing) rodam **sem** a casca; a área
  // logada de cada papel ganha o AppShell (header + navegação lateral/drawer).
  const raiz = segments[0];
  const emRotaPublica = raiz === undefined || ROTAS_PUBLICAS.has(raiz);
  const comCasca = Boolean(user) && !emRotaPublica;

  return comCasca ? (
    <AppShell>
      <Slot />
    </AppShell>
  ) : (
    <Slot />
  );
}

/** A barra de status acompanha o tema — clara no escuro, escura no claro. */
function BarraDeStatus() {
  const t = useTheme();
  return <StatusBar style={t.isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* ThemeProvider depende de useAuth (sotaque por papel), então fica dentro. */}
      <ThemeProvider>
        <BarraDeStatus />
        <RouteGuard />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  carregando: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
