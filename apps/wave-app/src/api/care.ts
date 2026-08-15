/**
 * Vínculos médico-paciente e dados de paciente (ADR-0024).
 *
 * Reusa o cliente autenticado de `auth/api` — o access token vive em memória
 * lá, e a assimetria do refresh por plataforma já está tratada.
 */

import { request, type UserRole } from "../auth/api";

export type CareLinkStatus = "pending" | "active" | "declined" | "revoked";

export type CareLink = {
  id: string;
  status: CareLinkStatus;
  initiated_by: "doctor" | "patient";
  counterpart_user_id: string;
  counterpart_display_name: string | null;
  /**
   * E-mail da contraparte, **só enquanto o convite está `pending`** — depois o
   * servidor manda `null`.
   *
   * Enquanto pende ele tem função: quem recebeu decide olhando para quem é (o
   * nome de exibição qualquer um escolhe) e quem convidou confere o endereço
   * antes de lembrar a pessoa. Aceito o vínculo, nada mais depende dele.
   */
  counterpart_email: string | null;
  counterpart_role: UserRole;
  /**
   * Recado que a contraparte escreveu junto do convite (ADR-0043), decifrado
   * pelo servidor. `null` quando não houve.
   *
   * **A tela exibe como citação atribuída** — aspas e nome de quem escreveu —,
   * nunca como texto do sistema, e **sem autolink**: convite com texto de
   * terceiro é vetor clássico de phishing.
   */
  message: string | null;
  created_at: string;
  consented_at: string | null;
  /**
   * Contagens do titular — **só chegam ao profissional, e só em vínculo
   * ativo** (emenda à ADR-0037 de 2026-08-14).
   *
   * São `COUNT(*)` no servidor: nada é decifrado e nenhum evento de acesso é
   * gravado. O limite é a contagem — valor derivado do sinal continua só no
   * painel, pela rota auditada.
   */
  session_count?: number | null;
  annotation_count?: number | null;
};

/** Teto do recado, igual ao do servidor (ADR-0043). */
export const INVITE_MESSAGE_MAX_LENGTH = 500;

export type PatientSummary = {
  id: string;
  display_name: string | null;
};

/** Todos os vínculos vivos do usuário (pendentes e ativos). */
export async function listCareLinks(): Promise<CareLink[]> {
  return request<CareLink[]>("/care-links", { auth: true });
}

/**
 * Convida a contraparte por e-mail (médico→paciente ou paciente→médico).
 *
 * A resposta é **sempre a mesma** (202) exista ou não a conta — o backend não
 * revela quem tem WaveAI (ADR-0024). Por isso não devolvemos nada útil aqui.
 */
export async function inviteCareLink(email: string, message?: string): Promise<void> {
  const recado = message?.trim();
  await request("/care-links", {
    method: "POST",
    // Recado vazio é **ausência**, não string vazia: o servidor já poda, e
    // mandar `""` faria a tela da outra pessoa desenhar um balão em branco.
    body: recado ? { email, message: recado } : { email },
    auth: true,
  });
}

/** Convites que o paciente recebeu e ainda não respondeu. */
export async function listPendingInvites(): Promise<CareLink[]> {
  const links = await listCareLinks();
  return links.filter((link) => link.status === "pending");
}

/** Aceita um convite (→ `active`). Só o paciente do vínculo pode. */
export async function acceptCareLink(id: string): Promise<CareLink> {
  return request<CareLink>(`/care-links/${id}/accept`, { method: "POST", auth: true });
}

/** Recusa um convite (→ `declined`). Terminal: some da lista. */
export async function declineCareLink(id: string): Promise<CareLink> {
  return request<CareLink>(`/care-links/${id}/decline`, { method: "POST", auth: true });
}

/**
 * Lembra a contraparte de um convite ainda pendente.
 *
 * Só quem convidou pode, e o servidor recusa com **429** se o lembrete
 * anterior saiu há pouco — o e-mail cai na caixa de outra pessoa, que não
 * pediu nada. O recado do convite é imutável (ADR-0043): reenviar é cutucar,
 * não reescrever.
 */
export async function resendCareLink(id: string): Promise<CareLink> {
  return request<CareLink>(`/care-links/${id}/resend`, { method: "POST", auth: true });
}

/** Revoga um vínculo ativo (efeito imediato). Qualquer das partes pode. */
export async function revokeCareLink(id: string): Promise<CareLink> {
  return request<CareLink>(`/care-links/${id}/revoke`, { method: "POST", auth: true });
}

/**
 * Pacientes que o médico pode de fato acompanhar.
 *
 * Só vínculos `active` entram: um convite `pending` não concede acesso nenhum
 * (ADR-0024), então listá-lo aqui daria a impressão errada de que já há
 * acompanhamento. A caixa de convites é a #20.
 */
export async function listActivePatients(): Promise<CareLink[]> {
  const links = await listCareLinks();
  return links.filter((link) => link.status === "active");
}

/** Dados do paciente. A API devolve 403 se não houver vínculo ativo. */
export async function getPatient(patientId: string): Promise<PatientSummary> {
  return request<PatientSummary>(`/patients/${patientId}`, { auth: true });
}
