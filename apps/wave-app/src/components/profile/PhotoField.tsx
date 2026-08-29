/**
 * Editor da própria foto — **iOS/Android**. Escolhe a imagem pela galeria com
 * `expo-image-picker` (emenda à ADR-0050, dependência nativa registrada).
 *
 * O URI devolvido pelo picker vira `Blob` e é enviado direto: o servidor
 * re-codifica e limpa EXIF (ADR-0050), então não redimensionamos aqui — o
 * cliente só escolhe e envia.
 *
 * O par web deste arquivo (`PhotoField.web.tsx`) usa `<input file>`; o Metro
 * escolhe um por plataforma.
 */

import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

import { useProfilePhoto } from "./useProfilePhoto";
import { usePhotoEditor } from "./usePhotoEditor";
import { AvatarEditorView } from "./AvatarEditorView";

export function PhotoField({
  name,
  size = 64,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const { uri, loading, reload } = useProfilePhoto("me");
  const { enviar, remover, busy, erro, limparErro } = usePhotoEditor(reload);
  const [erroPermissao, setErroPermissao] = useState<string | null>(null);

  const escolher = async () => {
    setErroPermissao(null);
    limparErro();
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      setErroPermissao("Sem acesso às fotos. Autorize nas configurações do aparelho.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (resultado.canceled || resultado.assets.length === 0) return;
    const asset = resultado.assets[0];
    // `fetch(uri).blob()` lê o arquivo local escolhido como binário — o mesmo
    // corpo que o `<input file>` do web produz.
    const blob = await (await fetch(asset.uri)).blob();
    void enviar(blob);
  };

  return (
    <AvatarEditorView
      name={name}
      size={size}
      uri={uri}
      loading={loading}
      busy={busy}
      erro={erroPermissao ?? erro}
      onPick={escolher}
      onRemove={remover}
    />
  );
}
