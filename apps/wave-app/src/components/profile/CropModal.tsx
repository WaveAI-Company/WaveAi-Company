/**
 * Recorte da foto de perfil — **web** (ADR-0050 + emenda).
 *
 * O fundador pediu um "reajuste básico" estilo WhatsApp. No mobile o
 * `expo-image-picker` faz o recorte nativo; no web não existe esse editor, então
 * é este. Recorte **quadrado** (o avatar é redondo e o disco recorta em
 * círculo), com **arraste** para posicionar e **zoom** por slider ou roda do
 * mouse. A saída é desenhada num `canvas` e volta como `Blob` JPEG — o servidor
 * ainda re-codifica e limpa EXIF, então isto é conveniência de enquadramento,
 * não a normalização de segurança.
 *
 * Web-only de propósito: usa `canvas`/`Image` do DOM. O par nativo não importa
 * este arquivo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../Button";
import { useRoleAccent, useTheme, type Theme } from "../../theme";

const V = 260; // lado do visor (px de tela)
const OUT = 512; // lado da imagem de saída (px)
const MAX_ZOOM = 4;

export function CropModal({
  sourceUri,
  onConfirm,
  onCancel,
}: {
  sourceUri: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const pos = useRef({ x: 0, y: 0 }); // offset do canto sup-esq da imagem no visor
  const [, forcar] = useState(0); // re-render após mexer em `pos` (que é ref)
  const trilhaW = useRef(0);

  // Carrega a imagem no DOM: precisamos do tamanho natural e do próprio elemento
  // para o `drawImage`.
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = sourceUri;
  }, [sourceUri]);

  const baseScale = nat ? V / Math.min(nat.w, nat.h) : 1;
  const effScale = baseScale * zoom;
  const dispW = nat ? nat.w * effScale : V;
  const dispH = nat ? nat.h * effScale : V;

  function clampar(x: number, y: number) {
    return {
      x: Math.min(0, Math.max(V - dispW, x)),
      y: Math.min(0, Math.max(V - dispH, y)),
    };
  }

  // Centraliza ao carregar e a cada mudança de zoom.
  useEffect(() => {
    if (!nat) return;
    pos.current = clampar((V - dispW) / 2, (V - dispH) / 2);
    forcar((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, zoom]);

  // PanResponder entrega deslocamento ACUMULADO (dx/dy desde o toque); guardamos
  // o ponto inicial e aplicamos o delta absoluto para não somar em dobro.
  const inicio = useRef({ x: 0, y: 0 });
  const arrasteImagem = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          inicio.current = { ...pos.current };
        },
        onPanResponderMove: (_e, g) => {
          pos.current = clampar(inicio.current.x + g.dx, inicio.current.y + g.dy);
          forcar((n) => n + 1);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispW, dispH],
  );

  const zoomSlider = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => aplicarZoomPorX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => aplicarZoomPorX(e.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function aplicarZoomPorX(x: number) {
    const w = trilhaW.current || 1;
    const frac = Math.min(1, Math.max(0, x / w));
    setZoom(1 + frac * (MAX_ZOOM - 1));
  }

  function onWheel(e: { deltaY: number; preventDefault?: () => void }) {
    e.preventDefault?.();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * 0.002)));
  }

  function confirmar() {
    const img = imgRef.current;
    if (!img || !nat) return;
    const sSize = V / effScale;
    const sx = -pos.current.x / effScale;
    const sy = -pos.current.y / effScale;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  const fracZoom = (zoom - 1) / (MAX_ZOOM - 1);

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.fundo}>
        <View style={styles.cartao}>
          <Text style={styles.titulo}>Ajustar foto</Text>
          <Text style={styles.dica}>Arraste para posicionar · role ou use a barra para o zoom</Text>

          <View style={styles.visorMoldura}>
            {/* @ts-expect-error onWheel é do react-native-web, fora do tipo RN */}
            <View style={styles.visor} onWheel={onWheel} {...arrasteImagem.panHandlers}>
              {nat ? (
                <Image
                  source={{ uri: sourceUri }}
                  style={{
                    height: dispH,
                    left: pos.current.x,
                    position: "absolute",
                    top: pos.current.y,
                    width: dispW,
                  }}
                />
              ) : null}
            </View>
            {/* Anel do recorte por cima, sem capturar o toque. */}
            <View pointerEvents="none" style={styles.anel} />
          </View>

          <View
            style={styles.trilha}
            onLayout={(e: LayoutChangeEvent) => {
              trilhaW.current = e.nativeEvent.layout.width;
            }}
            {...zoomSlider.panHandlers}
          >
            <View style={styles.trilhaPreenchida} />
            <View style={[styles.polegar, { backgroundColor: papel.accent, left: `${fracZoom * 100}%` }]} />
          </View>

          <View style={styles.acoes}>
            <View style={styles.acaoBotao}>
              <Button label="Cancelar" onPress={onCancel} variant="secondary" largura="bloco" />
            </View>
            <View style={styles.acaoBotao}>
              <Button label="Usar foto" onPress={confirmar} largura="bloco" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    fundo: {
      alignItems: "center",
      backgroundColor: "rgba(7, 12, 22, 0.72)",
      flex: 1,
      justifyContent: "center",
      padding: t.spacing.md,
    },
    cartao: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: t.spacing.sm,
      maxWidth: 360,
      padding: t.spacing.lg,
      width: "100%",
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    dica: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    visorMoldura: {
      alignItems: "center",
      alignSelf: "center",
      height: V,
      justifyContent: "center",
      marginVertical: t.spacing.sm,
      width: V,
    },
    visor: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: V / 2,
      height: V,
      overflow: "hidden",
      width: V,
    },
    anel: {
      borderColor: "rgba(255,255,255,0.85)",
      borderRadius: V / 2,
      borderWidth: 2,
      height: V,
      position: "absolute",
      width: V,
    },
    trilha: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: 3,
      height: 6,
      justifyContent: "center",
      marginVertical: t.spacing.sm,
    },
    trilhaPreenchida: {
      backgroundColor: t.colors.border,
      borderRadius: 3,
      height: 6,
    },
    polegar: {
      borderRadius: 9,
      height: 18,
      marginLeft: -9,
      position: "absolute",
      top: -6,
      width: 18,
    },
    acoes: {
      flexDirection: "row",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    acaoBotao: {
      flex: 1,
    },
  });
