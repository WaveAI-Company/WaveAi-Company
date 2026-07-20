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
  counterpart_role: UserRole;
  created_at: string;
  consented_at: string | null;
};

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
export async function inviteCareLink(email: string): Promise<void> {
  await request("/care-links", { method: "POST", body: { email }, auth: true });
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
