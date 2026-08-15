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

/**
 * Por qual porta a pessoa chegou à verificação (ADR-0044). Muda o que a tela
 * pode afirmar: vindo do **cadastro**, o produto não sabe se um código foi
 * emitido (a resposta é uniforme); vindo do **login**, o 403 já provou que a
 * conta existe e está por verificar — para quem acertou a senha.
 */
type OrigemVerificacao = "cadastro" | "login";

/**
 * Conta à espera do código de 6 dígitos.
 *
 * Vive **só em memória**, aqui: o e-mail não vai para a URL (seria dado
 * pessoal em histórico de navegador e em log de proxy) nem para disco. O preço
 * é recarregar a página no meio do passo 2 perder o passo — o código continua
 * valendo os 10 minutos e a volta é pelo login.
 */
type VerificacaoPendente = {
  email: string;
  origem: OrigemVerificacao;
  /**
   * Papel escolhido no passo 1, só para o destaque continuar o mesmo nos três
   * passos ("o sotaque começa já no cadastro"). Vindo do login não se sabe —
   * e aí vale o padrão.
   */
  role?: UserRole;
  /**
   * A senha que a pessoa acabou de digitar, guardada até o fim dos três
   * passos. É o que permite o "Entrar no WaveAI" do passo 3 entrar de verdade
   * (o `/auth/verify-email` responde 204 e não emite sessão). Mesma memória
   * que o formulário já ocupava — nada novo é persistido, e sai daqui assim
   * que o fluxo termina ou é cancelado.
   */
  senha?: string;
};

type AuthState = {
  user: AuthUser | null;
  /** `true` enquanto a tentativa de renovar a sessão do boot não terminou. */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  /**
   * Cria a conta e **para aí**: quem entra é o passo 3, depois do código.
   * Antes fazia login automático — não faz mais, porque conta não verificada
   * não entra (`email_verification_required`).
   */
  signUp(input: {
    email: string;
    password: string;
    role: UserRole;
    displayName: string;
  }): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Relê `GET /auth/me` e atualiza quem está em memória.
   *
   * Depois de editar o cadastro, o contexto ficaria com o nome antigo — e ele
   * alimenta a saudação, o cabeçalho do perfil e o avatar. Sem isto, a pessoa
   * salva e a tela continua chamando-a pelo nome anterior.
   */
  recarregarUsuario(): Promise<void>;

  // -- verificação de e-mail (ADR-0044) --------------------------------
  /** Cadastro à espera do código, ou `null`. A tela `/verify-email` depende disto. */
  verificacaoPendente: {
    email: string;
    role?: UserRole;
    origem: OrigemVerificacao;
  } | null;
  /** A outra porta: o login recebeu 403 e manda a pessoa verificar. */
  iniciarVerificacao(email: string, senha?: string): void;
  verificarEmail(codigo: string): Promise<void>;
  reenviarVerificacao(): Promise<void>;
  /**
   * Fecha o fluxo. Devolve `true` se conseguiu entrar com a credencial que já
   * estava em memória; `false` quer dizer "mande para o login".
   */
  concluirVerificacao(): Promise<boolean>;
  cancelarVerificacao(): void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendente, setPendente] = useState<VerificacaoPendente | null>(null);

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
      // O 202 é uniforme (ADR-0024): se o e-mail já tinha dono, nenhum código
      // foi emitido e quem soube disso foi a dona do endereço, por e-mail. A
      // pendência existe do mesmo jeito — a tela não pode distinguir os casos.
      setPendente({
        email: input.email,
        role: input.role,
        senha: input.password,
        origem: "cadastro",
      });
    },
    [],
  );

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const iniciarVerificacao = useCallback((email: string, senha?: string) => {
    setPendente({ email, senha, origem: "login" });
  }, []);

  const verificarEmail = useCallback(
    async (codigo: string) => {
      if (!pendente) throw new api.ApiError(400, "sem verificacao pendente");
      await api.verifyEmail(pendente.email, codigo);
    },
    [pendente],
  );

  const reenviarVerificacao = useCallback(async () => {
    if (!pendente) return;
    await api.resendVerification(pendente.email);
  }, [pendente]);

  const concluirVerificacao = useCallback(async () => {
    const atual = pendente;
    // A credencial sai da memória aqui, tenha o login dado certo ou não.
    setPendente(null);
    if (!atual?.senha) return false;
    try {
      setUser(await api.login(atual.email, atual.senha));
      return true;
    } catch {
      // A senha pode ter mudado por outro caminho (recuperação) enquanto o
      // código estava aberto. O login normal resolve.
      return false;
    }
  }, [pendente]);

  const cancelarVerificacao = useCallback(() => setPendente(null), []);

  const recarregarUsuario = useCallback(async () => {
    setUser(await api.me());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      recarregarUsuario,
      // Só o e-mail atravessa: a senha guardada não tem por que estar ao
      // alcance de nenhuma tela.
      verificacaoPendente: pendente
        ? { email: pendente.email, role: pendente.role, origem: pendente.origem }
        : null,
      iniciarVerificacao,
      verificarEmail,
      reenviarVerificacao,
      concluirVerificacao,
      cancelarVerificacao,
    }),
    [
      user,
      loading,
      signIn,
      signUp,
      signOut,
      pendente,
      iniciarVerificacao,
      verificarEmail,
      reenviarVerificacao,
      concluirVerificacao,
      cancelarVerificacao,
    ],
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
