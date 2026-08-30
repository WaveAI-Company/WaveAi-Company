/**
 * Editor da própria foto — **web**. Escolhe o arquivo por um `<input file>`.
 *
 * O input é criado por DOM imperativo (`document.createElement`), não em JSX:
 * o React Native Web não renderiza tags HTML cruas como componentes. O arquivo
 * escolhido é um `Blob`, enviado direto — o servidor re-codifica (ADR-0050),
 * então não há nada a redimensionar aqui.
 */

import { useMyPhoto } from "./MyPhotoContext";
import { usePhotoEditor } from "./usePhotoEditor";
import { AvatarEditorView } from "./AvatarEditorView";

const TIPOS_ACEITOS = "image/png,image/jpeg,image/webp";

export function PhotoField({
  name,
  size = 64,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const { uri, loading, reload } = useMyPhoto();
  const { enviar, remover, busy, erro } = usePhotoEditor(reload);

  const escolher = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = TIPOS_ACEITOS;
    input.onchange = () => {
      const arquivo = input.files?.[0];
      if (arquivo) void enviar(arquivo);
    };
    input.click();
  };

  return (
    <AvatarEditorView
      name={name}
      size={size}
      uri={uri}
      loading={loading}
      busy={busy}
      erro={erro}
      onPick={escolher}
      onRemove={remover}
    />
  );
}
