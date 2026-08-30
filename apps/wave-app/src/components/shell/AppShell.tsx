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
import {
  anelFoco,
  larguras,
  motion,
  semContornoNativo,
  transicao,
  useFaixa,
  useInteracao,
  useRoleAccent,
  useTheme,
  withAlpha,
  type Theme,
} from "../../theme";
import { Avatar } from "../Avatar";
import { MyPhotoProvider, useMyPhoto } from "../profile/MyPhotoContext";
import { Chip } from "../Chip";
import { Disclaimer } from "../Disclaimer";
import { Logo } from "../brand/Logo";
import { Icon, type IconName } from "../Icon";
import { Button } from "../Button";
import { NavList } from "./NavList";

const PAINEL_W = larguras.navegacao;
const RAIL_W = larguras.navegacaoRail;
const HEADER_H = 56;

/**
 * Casca do app (P6-a): header persistente + navegação **lateral no web** e
 * **drawer + hambúrguer no mobile**, no lugar do fluxo empilhado com "voltar".
 *
 * **Três estados de largura desde a P8-d**, como no mockup: navegação completa
 * de 240px acima de 1199, **recolhida a ícones em 76px** entre 768 e 1199, e
 * gaveta abaixo disso. O estado do meio não existia — a coluna de 280px
 * seguia inteira até 768px e sufocava o conteúdo justamente onde a tela já
 * era apertada.
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

  const faixa = useFaixa();
  const lateral = faixa !== "movel";
  const rail = faixa === "medio";
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
  const painel = (
    <PainelLateral onNavigate={() => setAberto(false)} pathname={pathname} rail={rail} />
  );

  // **Uma árvore só para as duas faixas.** Antes havia dois `return` com
  // estruturas diferentes, e `children` mudava de posição ao cruzar 767px:
  // na sidebar ele era `raiz > principal > conteúdo`, no celular
  // `raiz > conteúdo`. O React reconcilia por posição, então a travessia
  // **desmontava e remontava a tela inteira** — e junto o estado dela. Quem
  // pagava era a captação: arrastar a janela para estreito no meio de uma
  // sessão matava o `useRef` do socket e a limpeza fechava o stream. Formulário
  // meio preenchido morria pelo mesmo motivo.
  //
  // Aqui cada posição é um lugar fixo: a sidebar aparece ou vira `null`, mas o
  // caminho até `children` (`raiz > principal > conteúdo`) é o mesmo dos dois
  // lados da quebra. Trocar de faixa passa a ser mudança de estilo e de props.
  return (
    <MyPhotoProvider>
    <View style={styles.rootRow}>
      {lateral ? (
        <View style={[styles.sidebar, rail && styles.sidebarRail]}>{painel}</View>
      ) : null}

      <View style={styles.principal}>
        <Header
          titulo={titulo}
          onMenu={lateral ? undefined : () => setAberto(true)}
          onBack={onVoltar}
        />
        <View style={styles.conteudo}>{children}</View>
      </View>

      {!lateral && aberto ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu"
          style={styles.backdrop}
          onPress={() => setAberto(false)}
        />
      ) : null}

      {!lateral ? (
        <Animated.View
          style={[
            styles.drawer,
            {
              width: PAINEL_W,
              transform: [{ translateX: tx }],
              // Fora da tela, não deve capturar toque nem foco. Vai no estilo, e
              // não como prop: a prop está depreciada e avisa no console.
              pointerEvents: aberto ? "auto" : "none",
            },
          ]}
        >
          {painel}
        </Animated.View>
      ) : null}
    </View>
    </MyPhotoProvider>
  );
}

/** Marca + navegação + rodapé (usuário e sair). Compartilhado sidebar/drawer. */
function PainelLateral({
  onNavigate,
  pathname,
  rail,
}: {
  onNavigate: () => void;
  pathname: string;
  rail?: boolean;
}) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { user, signOut } = useAuth();
  if (!user) return null;

  // Duas formas do mesmo papel: a pílula do mockup traz o rótulo curto
  // ("Paciente"), e o rodapé, onde há largura, traz o nome do papel por extenso.
  const papelCurto = user.role === "doctor" ? "Profissional" : "Paciente";

  return (
    <View style={[styles.painel, rail && styles.painelRail]}>
      <View style={[styles.marca, rail && styles.marcaRail]}>
        {/* No rail cabe o ladrilho, não o letreiro. */}
        <Logo size={rail ? 32 : 36} forma="completa" tint={accent} withWordmark={!rail} tagline={rail ? undefined : "análise de bem-estar"} />
      </View>

      {/* `role-chip` do mockup: pílula neutra com o ponto no tom do papel, logo
          abaixo da marca. Sai no rail, como no mockup (`.role-chip{display:none}`
          em 768–1199) — lá não cabe texto. Diz de quem é a sessão sem gastar a
          linha do rodapé com isso. */}
      {rail ? null : (
        <View style={styles.papelChip}>
          <Chip label={papelCurto} dot corPonto={accent} />
        </View>
      )}

      <NavList role={user.role} pathname={pathname} onNavigate={onNavigate} rail={rail} />

      {/* O texto de identidade sai no rail — é o que o mockup esconde lá
          (`.side-foot { display:none }`). A **saída não sai**: escondê-la
          junto deixaria o profissional sem como encerrar a sessão sem antes
          voltar ao início. Ela vira ícone e continua no mesmo canto. */}
      {rail ? (
        <View style={styles.rodapeRail}>
          <BotaoIcone
            label="Sair"
            icone="logOut"
            onPress={signOut}
            styles={styles}
          />
        </View>
      ) : (
        <View style={styles.rodape}>
          <Text style={styles.rodapeNome} numberOfLines={1}>
            {user.display_name}
          </Text>
          {/* O papel por extenso saiu daqui: agora ele é a pílula do topo, e
              repetir "paciente" duas vezes na mesma coluna era ruído. */}
          <Button label="Sair" onPress={signOut} variant="secondary" largura="bloco" />
          {/* `.side-foot` do mockup: o posicionamento fecha a coluna de
              navegação. A redação vem do `Disclaimer` porque ela é regra de
              produto (Medical/71), não texto de tela. */}
          <View style={styles.rodapeAviso}>
            <Disclaimer placement="sidebar" />
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Barra superior — o `.app-head` do mockup:
 * `[voltar/menu] [título] [espaçador] [tema] [avatar]`.
 *
 * O tema e o avatar entraram na P8-d. Antes, trocar o tema exigia ir ao perfil
 * (e nas telas de autenticação havia um botão que a casca não tinha).
 */
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
  const router = useRouter();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { user } = useAuth();
  const { accent } = useRoleAccent();

  // Os dois papéis têm perfil desde a B'; o avatar leva ao do papel de quem
  // está logado. Antes ele só aparecia para o paciente, porque o profissional
  // não tinha destino.
  const perfil = user?.role === "doctor" ? "/doctor/profile" : "/patient/profile";

  return (
    <View style={styles.header}>
      {onBack ? (
        <BotaoIcone label="Voltar" icone="chevronLeft" onPress={onBack} styles={styles} />
      ) : null}
      {onMenu ? (
        <BotaoIcone label="Abrir menu" icone="menu" onPress={onMenu} styles={styles} />
      ) : null}
      <Text style={styles.headerTitulo} numberOfLines={1}>
        {titulo}
      </Text>
      <View style={styles.headerEspaco} />
      <BotaoIcone
        label={`Mudar para o tema ${t.isDark ? "claro" : "escuro"}`}
        icone={t.isDark ? "sun" : "moon"}
        onPress={() => t.setPreference(t.isDark ? "light" : "dark")}
        styles={styles}
      />
      {user ? (
        <AvatarPerfil
          nome={user.display_name}
          accent={accent}
          styles={styles}
          onPress={() => router.navigate(perfil as never)}
        />
      ) : null}
    </View>
  );
}

/** Avatar do header — atalho para o perfil (o `.avatar` do mockup). */
function AvatarPerfil({
  nome,
  accent,
  onPress,
  styles,
}: {
  nome: string | null | undefined;
  accent: string;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const t = useTheme();
  const { estado, handlers } = useInteracao();
  const { uri } = useMyPhoto();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Abrir perfil"
      onPress={onPress}
      {...handlers}
      style={[
        styles.avatarAlvo,
        // `.avatar:hover{box-shadow:0 0 0 3px var(--accent-soft)}`.
        estado.hovered && !estado.focoVisivel
          ? { boxShadow: `0px 0px 0px 3px ${withAlpha(accent, t.isDark ? 0.12 : 0.1)}` }
          : null,
        estado.focoVisivel ? { boxShadow: anelFoco(accent, t.colors.surface) } : null,
      ]}
    >
      {/* 44 e não 36: o mockup tem `.avatar{36px}` no geral e
          `.app-head .avatar{width:44px;height:44px}` na barra superior — o
          nosso usava o tamanho geral no header, e ficava menor que o botão de
          tema ao lado. */}
      <Avatar name={nome} size={44} tone={accent} photoUri={uri} />
    </Pressable>
  );
}

/** Botão só-ícone da barra superior — o `.iconbtn` do mockup. */
function BotaoIcone({
  label,
  icone,
  onPress,
  styles,
}: {
  label: string;
  icone: IconName;
  onPress: () => void;
  styles: ReturnType<typeof criarEstilos>;
}) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const { estado, handlers } = useInteracao();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={onPress}
      {...handlers}
      style={[
        styles.iconbtn,
        estado.hovered && { backgroundColor: t.colors.surfaceAlt },
        estado.focoVisivel ? { boxShadow: anelFoco(accent, t.colors.surface) } : null,
      ]}
    >
      {/* `.iconbtn{color:var(--ink-2)}` e `:hover{color:var(--ink)}`: em repouso
          o ícone é o traço secundário e só acende ao ponteiro. */}
      <Icon
        name={icone}
        size={20}
        color={estado.hovered ? t.colors.text : t.colors.textMuted}
      />
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    // Raiz única das duas faixas. No celular a linha tem um filho só (a coluna
    // principal), porque a sidebar vira `null` e o drawer é absoluto — o que
    // dá o mesmo resultado visual da coluna que existia aqui antes.
    rootRow: {
      backgroundColor: t.colors.background,
      flex: 1,
      flexDirection: "row",
    },
    sidebar: {
      backgroundColor: t.colors.surface,
      borderRightColor: t.colors.border,
      borderRightWidth: 1,
      width: PAINEL_W,
    },
    sidebarRail: {
      width: RAIL_W,
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
    // O `.iconbtn` do mockup: círculo de 44 com contorno e fundo de superfície.
    // O nosso era um ícone nu — sem borda nem fundo, ele lia como menor do que
    // os 44px que de fato tinha, e foi assim que o pente fino o descreveu
    // ("não tem o contorno e parece bem pequeno").
    //
    // **Divergência medida:** o mockup usa `--line` na borda; nós usamos
    // `borderStrong`, porque limite de controle precisa de 3:1 — o mesmo que o
    // `Button` delineado já faz. Medido pelo `check:contrast`: `borderStrong`
    // sobre `surface` dá **3,41:1 no escuro** e **4,45:1 no claro**. A `border`
    // comum é a de alfa, sem requisito de 3:1: serve para separar, não para
    // desenhar o limite de um controle.
    iconbtn: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      height: t.minTouch,
      justifyContent: "center",
      width: t.minTouch,
      ...transicao("background-color, box-shadow, border-color", motion.media),
      ...semContornoNativo(),
    },

    headerTitulo: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
    },
    // Empurra tema e avatar para a direita — o `.sp` do mockup.
    headerEspaco: {
      flex: 1,
    },
    avatarAlvo: {
      // Acompanha o avatar (44/2): com 18 o halo de foco saía retangular nos
      // cantos de um círculo de 44.
      borderRadius: 22,
      ...transicao("box-shadow", motion.media),
      ...semContornoNativo(),
    },
    // Painel (sidebar ou conteúdo do drawer).
    painel: {
      flex: 1,
      gap: t.spacing.md,
      padding: t.spacing.md,
    },
    painelRail: {
      alignItems: "stretch",
      paddingHorizontal: t.spacing.sm + 2,
    },
    marca: {
      paddingVertical: t.spacing.xs,
    },
    marcaRail: {
      alignItems: "center",
    },
    rodapeRail: {
      alignItems: "center",
      borderTopColor: t.colors.border,
      borderTopWidth: 1,
      marginTop: "auto",
      paddingTop: t.spacing.md,
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
      marginBottom: t.spacing.xs,
    },
    // O `Disclaimer` já traz `marginTop`; aqui só o respiro da linha, para o
    // texto fechar a coluna como o `.side-foot` (11,5px/1.45 no mockup).
    rodapeAviso: {
      paddingTop: t.spacing.xs,
    },
    papelChip: {
      paddingHorizontal: t.spacing.xs,
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
