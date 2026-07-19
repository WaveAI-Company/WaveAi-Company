/**
 * Vínculos médico-paciente e dados de paciente (ADR-0024).
 *
 * Reusa o cliente autenticado de `auth/api` — o access token vive em memória
 * lá, e a assimetria do refresh por plataforma já está tratada.
 */

import { request, type UserRole } from "../auth/api";

export type CareLinkStatus = "pending" | "active" | "revoked";

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
