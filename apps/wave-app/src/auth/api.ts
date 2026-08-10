/**
 * Cliente HTTP da API de autenticação.
 *
 * O access token **não é persistido** em nenhuma plataforma: vive só em
 * memória, neste módulo. O refresh segue a assimetria da ADR-0021 — cookie
 * httpOnly no web (enviado pelo navegador com `credentials: "include"`) e
 * corpo da requisição no mobile.
 */

import { Platform } from "react-native";

import { tokenStorage } from "./storage";

/** Base da API. Em produção o MVP assume same-origin (app e API no mesmo domínio). */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/** `web` faz o backend usar cookie; `mobile` devolve o refresh no corpo. */
const CLIENT: "web" | "mobile" = Platform.OS === "web" ? "web" : "mobile";

export type UserRole = "patient" | "doctor";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Access token em memória — nunca em disco, nunca em localStorage. */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string | null;
};

/**
 * Chamada HTTP à API. Exportada para os demais módulos reusarem o mesmo
 * tratamento de erro, o access token em memória e o `credentials: "include"`
 * (sem o qual o cookie do refresh não trafega no web).
 */
export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // Necessário para o cookie httpOnly do refresh ir e voltar no web.
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : "nao foi possivel completar a operacao";
    throw new ApiError(response.status, detail);
  }
  return data as T;
}

/** Guarda o par de tokens conforme a plataforma. */
async function aceitarTokens(tokens: TokenResponse): Promise<void> {
  setAccessToken(tokens.access_token);
  // No web `refresh_token` vem nulo (foi para o cookie) e salvar é no-op.
  if (tokens.refresh_token) {
    await tokenStorage.saveRefreshToken(tokens.refresh_token);
  }
}

export async function register(input: {
  email: string;
  password: string;
  role: UserRole;
  displayName: string;
}): Promise<void> {
  await request("/auth/register", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      role: input.role,
      display_name: input.displayName,
    },
  });
}

/**
 * Confirma a posse do endereço pelo código de 6 dígitos. Responde 204 e **não
 * emite sessão** — quem entra é o login de sempre (ADR-0044).
 *
 * O 400 é único de propósito: código errado, expirado, já usado e e-mail sem
 * conta chegam com a mesma mensagem. A tela não deve inventar a diferença.
 */
export async function verifyEmail(email: string, code: string): Promise<void> {
  await request("/auth/verify-email", { method: "POST", body: { email, code } });
}

/** Reemite o código. Responde igual exista ou não a conta (ADR-0024). */
export async function resendVerification(email: string): Promise<void> {
  await request("/auth/resend-verification", { method: "POST", body: { email } });
}

/**
 * Pede a recuperação de senha. Manda **link e código** — as duas formas do
 * mesmo segredo. Responde igual exista ou não a conta (ADR-0024), então quem
 * chama não pode concluir nada da resposta.
 */
export async function forgotPassword(email: string): Promise<void> {
  await request("/auth/forgot-password", { method: "POST", body: { email } });
}

/**
 * Redefine a senha por **uma** das duas formas: o código digitado (com o
 * e-mail) ou o token do link (que vale sozinho — o link não carrega endereço).
 * Mandar as duas é recusado pela API, de propósito.
 *
 * Não emite sessão: o design manda de volta ao login, e a redefinição derruba
 * todas as sessões abertas.
 */
export async function resetPassword(
  segredo: { email: string; code: string } | { token: string },
  newPassword: string,
): Promise<void> {
  await request("/auth/reset-password", {
    method: "POST",
    body: { ...segredo, new_password: newPassword },
  });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const tokens = await request<TokenResponse>("/auth/login", {
    method: "POST",
    body: { email, password, client: CLIENT },
  });
  await aceitarTokens(tokens);
  return me();
}

/**
 * Renova a sessão. No web não enviamos nada: o navegador anexa o cookie.
 * No mobile mandamos o refresh guardado no secure-store.
 */
export async function refresh(): Promise<AuthUser> {
  const body: { client: string; refresh_token?: string } = { client: CLIENT };

  if (!tokenStorage.usesHttpOnlyCookie) {
    const guardado = await tokenStorage.getRefreshToken();
    if (!guardado) {
      throw new ApiError(401, "sem sessao");
    }
    body.refresh_token = guardado;
  }

  const tokens = await request<TokenResponse>("/auth/refresh", {
    method: "POST",
    body,
  });
  await aceitarTokens(tokens);
  return me();
}

export async function logout(): Promise<void> {
  const body: { client: string; refresh_token?: string } = { client: CLIENT };
  if (!tokenStorage.usesHttpOnlyCookie) {
    const guardado = await tokenStorage.getRefreshToken();
    if (guardado) {
      body.refresh_token = guardado;
    }
  }

  try {
    await request("/auth/logout", { method: "POST", body });
  } finally {
    // Mesmo se a chamada falhar, a sessão local tem de sumir.
    setAccessToken(null);
    await tokenStorage.clearRefreshToken();
  }
}

export async function me(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me", { auth: true });
}
