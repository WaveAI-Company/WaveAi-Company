import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { listPendingInvites } from "../api/care";
import { useAuth } from "../auth/AuthContext";

/** Rota onde a contagem pode mudar — é lá que se aceita ou recusa. */
const ROTA_CONVITES = "/patient/invites";

/**
 * Quantos convites esperam resposta — o número do `.nav .badge` do mockup.
 *
 * **Quando busca, e por quê.** Ao montar a casca e ao **sair** da tela de
 * convites. Não a cada navegação: a contagem só muda quando a pessoa responde
 * um convite (na tela de convites) ou quando chega um novo, que é evento de
 * servidor e exigiria polling — e ficar consultando a cada troca de tela
 * gastaria uma requisição por clique para um número que quase nunca muda.
 *
 * Ler vínculo **não é acesso auditado**: a trilha registra leitura de dado do
 * titular (resultado, anotação, transmissão ao vivo). `/care-links` devolve a
 * lista de quem se relaciona com quem, que é o próprio dado de quem pergunta.
 *
 * Falha em silêncio de propósito: um badge é enfeite de navegação, e nenhuma
 * tela deve mostrar erro porque um contador não carregou.
 */
export function useConvitesPendentes(): number {
  const { user } = useAuth();
  const pathname = usePathname();
  const [quantos, setQuantos] = useState(0);
  const anterior = useRef(pathname);

  const ehPaciente = user?.role === "patient";

  useEffect(() => {
    const saiuDosConvites =
      anterior.current.startsWith(ROTA_CONVITES) && !pathname.startsWith(ROTA_CONVITES);
    const primeiraVez = anterior.current === pathname;
    anterior.current = pathname;

    if (!ehPaciente) {
      setQuantos(0);
      return;
    }
    if (!primeiraVez && !saiuDosConvites) return;

    let vivo = true;
    listPendingInvites()
      .then((convites) => {
        if (vivo) setQuantos(convites.length);
      })
      .catch(() => {
        if (vivo) setQuantos(0);
      });
    return () => {
      vivo = false;
    };
  }, [ehPaciente, pathname]);

  return ehPaciente ? quantos : 0;
}
