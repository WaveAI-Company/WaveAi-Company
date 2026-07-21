/**
 * Tema em tempo de execução, seguindo o sistema operacional (#18).
 *
 * As telas nunca importam cor literal: pedem tokens por `useTheme()`. É o que
 * permite claro e escuro conviverem sem duplicar tela — e o que faz a troca no
 * sistema refletir no app na hora, sem reiniciar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { loadThemePreference, saveThemePreference } from "./preference";
import {
  MIN_TOUCH,
  palettes,
  radius,
  spacing,
  typography,
  type Role,
  type ThemeName,
  type ThemePreference,
} from "./tokens";

export type Theme = {
  name: ThemeName;
  isDark: boolean;
  colors: (typeof palettes)["dark"];
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  minTouch: number;
  /** O que está escolhido: seguir o sistema, ou um tema fixo. */
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // `null` acontece enquanto o sistema não respondeu; escuro é o padrão do
  // produto, então serve de fallback sem piscar.
  const esquema = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // A escolha anterior é lida uma vez, na montagem.
  useEffect(() => {
    let ativo = true;
    void loadThemePreference().then((salva) => {
      if (ativo && salva) setPreferenceState(salva);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    // Estado primeiro: a troca é imediata, gravar é detalhe assíncrono.
    setPreferenceState(pref);
    void saveThemePreference(pref);
  }, []);

  const name: ThemeName =
    preference === "system" ? (esquema === "light" ? "light" : "dark") : preference;

  const valor = useMemo<Theme>(
    () => ({
      name,
      isDark: name === "dark",
      colors: palettes[name],
      typography,
      spacing,
      radius,
      minTouch: MIN_TOUCH,
      preference,
      setPreference,
    }),
    [name, preference, setPreference],
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  }
  return ctx;
}

export type RoleAccent = {
  /** Preenchimento (botões, barras, traço de gráfico). */
  accent: string;
  /** O mesmo destaque quando usado como **texto** sobre o fundo. */
  accentText: string;
  /** Cor do texto por cima do preenchimento. */
  onAccent: string;
};

/** Destaque de um papel específico. */
export function useAccentFor(role: Role): RoleAccent {
  const t = useTheme();
  return role === "doctor"
    ? {
        accent: t.colors.accentDoctor,
        accentText: t.colors.accentDoctorText,
        onAccent: t.colors.onAccent,
      }
    : {
        accent: t.colors.accentPatient,
        accentText: t.colors.accentPatientText,
        onAccent: t.colors.onAccent,
      };
}

/**
 * Destaque do papel de quem está logado — o "sotaque" por papel da #18.
 *
 * Sem sessão (telas públicas) cai no tom do paciente, que é a identidade
 * principal do produto.
 */
export function useRoleAccent(): RoleAccent {
  const { user } = useAuth();
  return useAccentFor(user?.role === "doctor" ? "doctor" : "patient");
}
