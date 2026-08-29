/**
 * Foto de perfil (ADR-0050): cliente de upload, remoção e leitura.
 *
 * O `request` de `auth/api` é só-JSON; a foto é binária, então este módulo usa
 * `fetch` direto, reusando o access token em memória e a base da API de lá.
 *
 * A leitura devolve um **data URI** (base64), que serve tanto ao `<img>` do web
 * quanto ao `<Image>` do React Native — e dispensa mandar o header de
 * autorização de dentro de uma tag de imagem, que nenhuma das duas pontas faz
 * bem. Avatar tem dezenas de KB, então o base64 é barato.
 */

import { API_URL, ApiError, getAccessToken } from "../auth/api";

function autorizacao(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function blobParaDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Foto de um usuário — `"me"` para a própria, ou o id do contraparte de um
 * vínculo ativo. `null` quando não há foto (ou não há vínculo): o servidor
 * responde 404 uniforme nos dois casos (ADR-0050), sem oráculo.
 */
export async function fetchPhotoDataUri(alvo: "me" | string): Promise<string | null> {
  const path = alvo === "me" ? "/me/photo" : `/users/${alvo}/photo`;
  const resp = await fetch(`${API_URL}${path}`, {
    headers: autorizacao(),
    credentials: "include",
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new ApiError(resp.status, "nao foi possivel carregar a foto");
  return blobParaDataUri(await resp.blob());
}

/** Envia a própria foto (bytes crus). O servidor re-codifica e limpa EXIF. */
export async function uploadMyPhoto(imagem: Blob): Promise<void> {
  const resp = await fetch(`${API_URL}/me/photo`, {
    method: "PUT",
    headers: {
      "Content-Type": imagem.type || "application/octet-stream",
      ...autorizacao(),
    },
    body: imagem,
    credentials: "include",
  });
  if (resp.status === 204) return;
  const data = (await resp.json().catch(() => ({}))) as { detail?: unknown };
  throw new ApiError(
    resp.status,
    typeof data.detail === "string" ? data.detail : "falha ao enviar a foto",
  );
}

export async function deleteMyPhoto(): Promise<void> {
  const resp = await fetch(`${API_URL}/me/photo`, {
    method: "DELETE",
    headers: autorizacao(),
    credentials: "include",
  });
  if (resp.status !== 204) {
    throw new ApiError(resp.status, "falha ao remover a foto");
  }
}
