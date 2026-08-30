/**
 * A foto do **usuário logado**, compartilhada por toda a casca.
 *
 * Sem isto, cada avatar buscava a própria cópia: a foto aparecia no cabeçalho do
 * perfil mas **não** no avatar do header, e um upload não se propagava (cada
 * `useProfilePhoto("me")` era um estado à parte). O provider carrega uma vez e
 * o `reload` do editor atualiza **todos** os consumidores de uma vez — header e
 * perfil refletem juntos.
 */

import { createContext, useContext, type ReactNode } from "react";

import { useAuth } from "../../auth/AuthContext";
import { useProfilePhoto } from "./useProfilePhoto";

type MyPhoto = ReturnType<typeof useProfilePhoto>;

const MyPhotoContext = createContext<MyPhoto | null>(null);

export function MyPhotoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Só busca havendo usuário; ao trocar de conta, o alvo muda e recarrega.
  const estado = useProfilePhoto(user ? "me" : null);
  return <MyPhotoContext.Provider value={estado}>{children}</MyPhotoContext.Provider>;
}

export function useMyPhoto(): MyPhoto {
  const ctx = useContext(MyPhotoContext);
  // Fora do provider (não deveria ocorrer sob a casca) cai num vazio inerte, em
  // vez de estourar — o avatar simplesmente fica nas iniciais.
  return ctx ?? { uri: null, loading: false, reload: () => Promise.resolve() };
}
