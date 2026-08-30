/**
 * Editor da própria foto — **web**. Escolhe o arquivo por um `<input file>` e
 * abre o recorte (`CropModal`) antes de enviar.
 *
 * O input é criado por DOM imperativo (`document.createElement`), não em JSX: o
 * React Native Web não renderiza tags HTML cruas como componentes. O recorte é
 * conveniência de enquadramento; o servidor ainda re-codifica e limpa EXIF
 * (ADR-0050).
 */

import { useState } from "react";

import { AvatarEditorView } from "./AvatarEditorView";
import { CropModal } from "./CropModal";
import { useMyPhoto } from "./MyPhotoContext";
import { usePhotoEditor } from "./usePhotoEditor";

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
  //: URL de objeto da imagem escolhida, enquanto o recorte está aberto.
  const [recorte, setRecorte] = useState<string | null>(null);

  const escolher = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = TIPOS_ACEITOS;
    input.onchange = () => {
      const arquivo = input.files?.[0];
      if (arquivo) setRecorte(URL.createObjectURL(arquivo));
    };
    input.click();
  };

  const fecharRecorte = () => {
    if (recorte) URL.revokeObjectURL(recorte);
    setRecorte(null);
  };

  return (
    <>
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
      {recorte ? (
        <CropModal
          sourceUri={recorte}
          onCancel={fecharRecorte}
          onConfirm={(blob) => {
            fecharRecorte();
            void enviar(blob);
          }}
        />
      ) : null}
    </>
  );
}
