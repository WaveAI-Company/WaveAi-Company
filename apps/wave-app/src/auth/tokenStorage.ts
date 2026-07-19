/**
 * Contrato de armazenamento do refresh token (ADR-0021).
 *
 * A implementação é uma **capability por plataforma** — e as duas são
 * assimétricas de propósito:
 *
 * - **Mobile** (`tokenStorage.native.ts`): o refresh vive em `expo-secure-store`
 *   (Keychain no iOS, Keystore no Android) e o app o envia no corpo.
 * - **Web** (`tokenStorage.web.ts`): o refresh **nunca passa pelo JS**. O
 *   backend o entrega num cookie `httpOnly`, invisível para o script; salvar é
 *   um no-op e ler devolve `null`. O navegador anexa o cookie sozinho quando a
 *   requisição usa `credentials: "include"`.
 *
 * Em nenhuma plataforma o access token é persistido: ele vive só em memória.
 */

export type TokenStorage = {
  /** Guarda o refresh. No web é intencionalmente um no-op. */
  saveRefreshToken(token: string): Promise<void>;
  /** Lê o refresh. No web devolve `null` (o cookie é inacessível ao JS). */
  getRefreshToken(): Promise<string | null>;
  /** Descarta o refresh local. No web quem limpa o cookie é o backend. */
  clearRefreshToken(): Promise<void>;
  /** `true` quando o refresh trafega por cookie e não pelo corpo. */
  readonly usesHttpOnlyCookie: boolean;
};
