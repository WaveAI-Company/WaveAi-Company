/**
 * Avatar de outra pessoa que **busca a própria foto** (ADR-0050).
 *
 * Para usar em lista: como não se pode chamar hook dentro de um `.map`, cada
 * linha usa este componente, que faz o `useProfilePhoto` do contraparte e cai
 * nas iniciais quando não há foto (ou não há vínculo ativo → 404).
 *
 * `userId` nulo/ausente = não buscar (ex.: convite ainda pendente, sem vínculo
 * ativo, onde o servidor devolveria 404 à toa).
 */

import { Avatar } from "../Avatar";
import { useProfilePhoto } from "./useProfilePhoto";

export function PersonAvatar({
  name,
  size,
  tone,
  userId,
}: {
  name: string | null | undefined;
  size?: number;
  tone?: string;
  userId?: string | null;
}) {
  const { uri } = useProfilePhoto(userId ?? null);
  return <Avatar name={name} size={size} tone={tone} photoUri={uri} />;
}
