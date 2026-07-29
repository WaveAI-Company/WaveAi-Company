import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAuth } from "../../auth/AuthContext";
import { activeHref, routeTitle } from "../../navigation/navItems";
import { useRoleAccent, useTheme, type Theme } from "../../theme";
import { Button } from "../Button";
import { NavList } from "./NavList";

/** A partir desta largura a navegação vira sidebar fixa; abaixo, drawer. */
const BREAKPOINT = 768;
const PAINEL_W = 280;
const HEADER_H = 56;

/**
 * Casca do app (P6-a): header persistente + navegação **lateral no web** e
 * **drawer + hambúrguer no mobile**, no lugar do fluxo empilhado com "voltar".
 *
 * Sem dependência nativa nova (ADR-0038): o layout responsivo usa
 * `useWindowDimensions` e o drawer desliza com `Animated` (built-in) — nada de
 * `@react-navigation/drawer`/reanimated. A guarda por papel segue em
 * `app/_layout.tsx`; aqui só se desenha a moldura.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();

  const lateral = width >= BREAKPOINT;
  const [aberto, setAberto] = useState(false);
  const tx = useRef(new Animated.Value(-PAINEL_W)).current;

  // Fecha o drawer ao alargar para sidebar (evita ficar "preso" aberto).
  useEffect(() => {
    if (lateral) setAberto(false);
  }, [lateral]);

  // Desliza o drawer conforme abre/fecha.
  useEffect(() => {
    Animated.timing(tx, {
      toValue: aberto ? 0 : -PAINEL_W,
      duration: 200,
      // No web não há módulo de animação nativo (só avisaria e cairia p/ JS).
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [aberto, tx]);

  // Sem usuário a casca não se aplica (a guarda cuida do redirect); rende só o
  // conteúdo para não montar navegação de um papel indefinido.
  if (!user) return <>{children}</>;

  const titulo = routeTitle(pathname, user.role);
  // Rota de detalhe (fora dos itens de navegação, ex.: consent, paciente/[id]):
  // ganha um "voltar", já que o header empilhado com back saiu.
  const onVoltar =
    activeHref(pathname, user.role) === null && router.canGoBack()
      ? () => router.back()
      : undefined;
  const painel = <PainelLateral onNavigate={() => setAberto(false)} pathname={pathname} />;

  if (lateral) {
    return (
      <View style={styles.rootRow}>
        <View style={styles.sidebar}>{painel}</View>
        <View style={styles.principal}>
          <Header titulo={titulo} onBack={onVoltar} />
          <View style={styles.conteudo}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootCol}>
      <Header titulo={titulo} onMenu={() => setAberto(true)} onBack={onVoltar} />
      <View style={styles.conteudo}>{children}</View>

      {aberto ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu"
          style={styles.backdrop}
          onPress={() => setAberto(false)}
        />
      ) : null}
      <Animated.View
        style={[styles.drawer, { width: PAINEL_W, transform: [{ translateX: tx }] }]}
        // Fora da tela, não deve capturar toque nem foco.
        pointerEvents={aberto ? "auto" : "none"}
      >
        {painel}
      </Animated.View>
    </View>
  );
}

/** Marca + navegação + rodapé (usuário e sair). Compartilhado sidebar/drawer. */
function PainelLateral({
  onNavigate,
  pathname,
}: {
  onNavigate: () => void;
  pathname: string;
}) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { user, signOut } = useAuth();
  if (!user) return null;

  const papel = user.role === "doctor" ? "profissional de bem-estar" : "paciente";

  return (
    <View style={styles.painel}>
      <View style={styles.marca}>
        <View style={[styles.marcaGlifo, { backgroundColor: accent }]}>
          <Text style={styles.marcaGlifoTexto}>◠</Text>
        </View>
        <View style={styles.marcaTextos}>
          <Text style={styles.marcaNome}>WaveAI</Text>
          <Text style={styles.marcaSub}>análise de bem-estar</Text>
        </View>
      </View>

      <NavList role={user.role} pathname={pathname} onNavigate={onNavigate} />

      <View style={styles.rodape}>
        <Text style={styles.rodapeNome} numberOfLines={1}>
          {user.display_name}
        </Text>
        <Text style={styles.rodapePapel}>{papel}</Text>
        <Button label="Sair" onPress={signOut} variant="secondary" />
      </View>
    </View>
  );
}

/** Barra superior: voltar (detalhe) + hambúrguer (estreito) + título da seção. */
function Header({
  titulo,
  onMenu,
  onBack,
}: {
  titulo: string;
  onMenu?: () => void;
  onBack?: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onBack}
          style={styles.hamburger}
        >
          <Text style={styles.hamburgerTexto}>‹</Text>
        </Pressable>
      ) : null}
      {onMenu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir menu"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onMenu}
          style={styles.hamburger}
        >
          <Text style={styles.hamburgerTexto}>☰</Text>
        </Pressable>
      ) : null}
      <Text style={styles.headerTitulo} numberOfLines={1}>
        {titulo}
      </Text>
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    rootRow: {
      backgroundColor: t.colors.background,
      flex: 1,
      flexDirection: "row",
    },
    rootCol: {
      backgroundColor: t.colors.background,
      flex: 1,
    },
    sidebar: {
      backgroundColor: t.colors.surface,
      borderRightColor: t.colors.border,
      borderRightWidth: 1,
      width: PAINEL_W,
    },
    principal: {
      flex: 1,
    },
    conteudo: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderBottomColor: t.colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: t.spacing.sm,
      height: HEADER_H,
      paddingHorizontal: t.spacing.md,
    },
    hamburger: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: t.minTouch,
      minWidth: t.minTouch,
    },
    hamburgerTexto: {
      color: t.colors.text,
      fontSize: 22,
    },
    headerTitulo: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
    },
    // Painel (sidebar ou conteúdo do drawer).
    painel: {
      flex: 1,
      gap: t.spacing.md,
      padding: t.spacing.md,
    },
    marca: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.xs,
    },
    marcaGlifo: {
      alignItems: "center",
      borderRadius: t.radius.md,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    marcaGlifoTexto: {
      color: t.colors.onAccent,
      fontSize: 20,
      fontWeight: "700",
    },
    marcaTextos: {
      flexShrink: 1,
    },
    marcaNome: {
      ...t.typography.heading,
      color: t.colors.text,
    },
    marcaSub: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    rodape: {
      borderTopColor: t.colors.border,
      borderTopWidth: 1,
      gap: t.spacing.xs,
      marginTop: "auto",
      paddingTop: t.spacing.md,
    },
    rodapeNome: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    rodapePapel: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginBottom: t.spacing.xs,
    },
    backdrop: {
      backgroundColor: "rgba(0,0,0,0.45)",
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 1,
    },
    drawer: {
      backgroundColor: t.colors.surface,
      borderRightColor: t.colors.border,
      borderRightWidth: 1,
      bottom: 0,
      left: 0,
      position: "absolute",
      top: 0,
      zIndex: 2,
    },
  });
