import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { DIAGNOSTICO_BLE_HABILITADO } from "../../src/capture/availability";
import { bleDiagnostics } from "../../src/device/bleDiagnostics";
import type {
  BleCharInfo,
  BleDeviceInfo,
  BleInspection,
} from "../../src/device/bleDiagnostics.types";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { StateView } from "../../src/components/StateView";
import { useRoleAccent, useTheme, type Theme } from "../../src/theme";

/**
 * Diagnóstico BLE — ferramenta de **dev** (fatia iOS da ADR-0040).
 *
 * O GATT do MindWave Mobile 2 no iOS não é documentado; esta tela enumera
 * serviços/características do headset físico para o dev **ler os UUIDs** e travá-
 * los depois no `connection.ios.ts`. Não é função do produto — gated por
 * `DIAGNOSTICO_BLE_HABILITADO` (nativo + dev) e não aparece na navegação.
 */
export default function BleDiagScreen() {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = criarEstilos(t);

  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [inspection, setInspection] = useState<BleInspection | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Libera o gerenciador nativo ao sair da tela.
  useEffect(() => () => bleDiagnostics.destroy(), []);

  const parar = useCallback(() => {
    bleDiagnostics.stopScan();
    setScanning(false);
  }, []);

  const procurar = useCallback(() => {
    setErro(null);
    setInspection(null);
    setDevices([]);
    setScanning(true);
    bleDiagnostics.scan(
      (device) =>
        setDevices((atual) => {
          const proximos = [...atual, device];
          // MindWave primeiro; depois por sinal (rssi) mais forte.
          return proximos.sort(
            (a, b) =>
              Number(b.provavel) - Number(a.provavel) || (b.rssi ?? -999) - (a.rssi ?? -999),
          );
        }),
      (mensagem) => {
        setErro(mensagem);
        setScanning(false);
      },
    );
  }, []);

  const inspecionar = useCallback(
    async (id: string) => {
      parar();
      setErro(null);
      setInspecting(id);
      setInspection(null);
      try {
        const resultado = await bleDiagnostics.inspect(id);
        setInspection(resultado);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao inspecionar o aparelho.");
      } finally {
        setInspecting(null);
        await bleDiagnostics.disconnect(id);
      }
    },
    [parar],
  );

  if (!DIAGNOSTICO_BLE_HABILITADO || !bleDiagnostics.supported) {
    return (
      <ScreenContainer>
        <ScreenHeading title="Diagnóstico BLE" />
        <Card
          title="Indisponível aqui"
          subtitle="Esta ferramenta de desenvolvimento roda só no app nativo (Android/iOS), em build de dev."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Diagnóstico BLE"
        lead="Ferramenta de desenvolvimento (ADR-0040). Procure o MindWave, toque para inspecionar e anote o UUID da característica marcada como notify — é a candidata ao stream do sinal."
      />

      {scanning ? (
        <Button label="Parar busca" onPress={parar} variant="secondary" />
      ) : (
        <Button label="Procurar aparelhos" onPress={procurar} />
      )}

      {scanning ? <StateView loading /> : null}
      {erro ? <StateView error={erro} /> : null}

      {devices.map((d) => (
        <Pressable
          key={d.id}
          accessibilityRole="button"
          accessibilityLabel={`Inspecionar ${d.name}`}
          onPress={() => inspecionar(d.id)}
          disabled={inspecting !== null}
        >
          <Card
            title={d.name}
            subtitle={`${d.id}${d.rssi !== null ? ` · ${d.rssi} dBm` : ""}`}
            accent={d.provavel ? accent : undefined}
          >
            {inspecting === d.id ? <StateView loading /> : null}
          </Card>
        </Pressable>
      ))}

      {inspection ? (
        <>
          <ScreenHeading title={`Serviços — ${inspection.name}`} />
          {inspection.services.length === 0 ? (
            <Card title="Nenhum serviço descoberto" />
          ) : null}
          {inspection.services.map((s) => (
            <Card key={s.uuid} title="Serviço">
              <Text selectable style={styles.uuid}>
                {s.uuid}
              </Text>
              {s.characteristics.map((c) => (
                <CharacteristicRow key={c.uuid} char={c} styles={styles} accent={accent} />
              ))}
            </Card>
          ))}
        </>
      ) : null}
    </ScreenContainer>
  );
}

function propriedades(c: BleCharInfo): string {
  const flags: string[] = [];
  if (c.notifiable) flags.push("notify");
  if (c.indicatable) flags.push("indicate");
  if (c.readable) flags.push("read");
  if (c.writableWithResponse) flags.push("write");
  if (c.writableWithoutResponse) flags.push("writeNR");
  return flags.length ? flags.join(" · ") : "sem propriedades";
}

function CharacteristicRow({
  char,
  styles,
  accent,
}: {
  char: BleCharInfo;
  styles: ReturnType<typeof criarEstilos>;
  accent: string;
}) {
  return (
    <View style={[styles.charRow, char.notifiable ? { borderLeftColor: accent } : null]}>
      <Text selectable style={styles.uuid}>
        {char.uuid}
      </Text>
      <Text style={[styles.props, char.notifiable ? { color: accent } : null]}>
        {propriedades(char)}
      </Text>
    </View>
  );
}

// Monoespaçada por plataforma: UUIDs longos ficam legíveis e alinhados.
const MONOSPACE = Platform.OS === "ios" ? "Menlo" : "monospace";

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    uuid: {
      ...t.typography.body,
      color: t.colors.text,
      fontFamily: MONOSPACE,
      fontSize: 13,
    },
    charRow: {
      borderLeftColor: t.colors.border,
      borderLeftWidth: 2,
      gap: 2,
      marginTop: t.spacing.sm,
      paddingLeft: t.spacing.sm,
    },
    props: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 12,
    },
  });
