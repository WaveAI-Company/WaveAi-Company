/**
 * Envio e remoção da própria foto, com estado de progresso e erro.
 *
 * O gesto de **escolher** a imagem é por plataforma (`PhotoField.web` /
 * `PhotoField`); este hook cuida do que é igual nos dois: mandar os bytes,
 * recarregar o avatar e traduzir a falha do servidor em mensagem — sem afirmar
 * sucesso antes do 204 (ADR-0027).
 */

import { useCallback, useState } from "react";

import { ApiError } from "../../auth/api";
import { deleteMyPhoto, uploadMyPhoto } from "../../api/profilePhoto";

export function usePhotoEditor(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useCallback(
    async (imagem: Blob) => {
      setBusy(true);
      setErro(null);
      try {
        await uploadMyPhoto(imagem);
        reload();
      } catch (e) {
        setErro(
          e instanceof ApiError && e.message
            ? e.message
            : "nao foi possivel enviar a foto",
        );
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const remover = useCallback(async () => {
    setBusy(true);
    setErro(null);
    try {
      await deleteMyPhoto();
      reload();
    } catch {
      setErro("nao foi possivel remover a foto");
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return { enviar, remover, busy, erro, limparErro: () => setErro(null) };
}
