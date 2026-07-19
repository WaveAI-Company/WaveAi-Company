/**
 * Estado de autenticação do app.
 *
 * No boot tentamos renovar a sessão: no web isso funciona só com o cookie
 * httpOnly (o app não guarda nada); no mobile usa o refresh do secure-store.
 * Falhar é o caso normal de "ninguém logado" — não é erro.
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

import * as api from "./api";
import type { AuthUser, UserRole } from "./api";

type AuthState = {
  user: AuthUser | null;
  /** `true` enquanto a tentativa de renovar a sessão do boot não terminou. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: {
    email: string;
    password: string;
    role: UserRole;
    displayName: string;
  }): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const atual = await api.refresh();
        if (ativo) setUser(atual);
      } catch {
        // Sem sessão válida: segue deslogado.
        if (ativo) setUser(null);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password));
  }, []);

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      role: UserRole;
      displayName: string;
    }) => {
      await api.register(input);
      setUser(await api.login(input.email, input.password));
    },
    [],
  );

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  }
  return ctx;
}

/** Rota inicial de cada papel. */
export function homeForRole(role: UserRole): "/patient" | "/doctor" {
  return role === "doctor" ? "/doctor" : "/patient";
}
