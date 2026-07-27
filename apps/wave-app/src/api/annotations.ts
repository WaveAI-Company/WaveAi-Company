/**
 * Anotações de contexto de sessão (ADR-0037).
 *
 * O titular escreve/edita/apaga a nota da própria sessão; o profissional só
 * **lê**, via CareLink (a autorização é do servidor). O texto é autorrelato do
 * paciente — a UI do profissional é read-only.
 */

import { request } from "../auth/api";

export type Annotation = {
  session_id: string;
  note: string;
  created_at: string;
  updated_at: string;
};

/** Nota da própria sessão do titular (`null` se ainda não anotou). */
export async function getMyAnnotation(sessionId: string): Promise<Annotation | null> {
  const r = await request<{ annotation: Annotation | null }>(
    `/sessions/${sessionId}/annotation`,
    { auth: true },
  );
  return r.annotation;
}

/** Cria ou atualiza a nota da própria sessão (upsert). */
export async function putMyAnnotation(sessionId: string, note: string): Promise<Annotation> {
  return request<Annotation>(`/sessions/${sessionId}/annotation`, {
    method: "PUT",
    body: { note },
    auth: true,
  });
}

/** Apaga a nota da própria sessão. */
export async function deleteMyAnnotation(sessionId: string): Promise<void> {
  await request(`/sessions/${sessionId}/annotation`, { method: "DELETE", auth: true });
}

/** Nota de uma sessão de um paciente (profissional). A API exige CareLink ativo. */
export async function getPatientAnnotation(
  patientId: string,
  sessionId: string,
): Promise<Annotation | null> {
  const r = await request<{ annotation: Annotation | null }>(
    `/patients/${patientId}/sessions/${sessionId}/annotation`,
    { auth: true },
  );
  return r.annotation;
}
