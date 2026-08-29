/**
 * Busca a foto de perfil de um alvo e devolve o data URI, recarregável.
 *
 * `alvo` é `"me"`, o id de um contraparte, ou `null`/`undefined` para "não
 * buscar" (o disco fica nas iniciais). 404 → `null`, sem erro: não ter foto é
 * um estado normal, não uma falha.
 */

import { useCallback, useEffect, useState } from "react";

import { fetchPhotoDataUri } from "../../api/profilePhoto";

export function useProfilePhoto(alvo: "me" | string | null | undefined) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!alvo) {
      setUri(null);
      return;
    }
    setLoading(true);
    try {
      setUri(await fetchPhotoDataUri(alvo));
    } catch {
      // Falha de rede não vira erro de tela aqui: o avatar cai nas iniciais, que
      // é um fallback honesto — não afirma que a pessoa não tem foto.
      setUri(null);
    } finally {
      setLoading(false);
    }
  }, [alvo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { uri, loading, reload: carregar };
}
