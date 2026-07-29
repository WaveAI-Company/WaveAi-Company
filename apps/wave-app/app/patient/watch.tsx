import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { watchMyLive } from "../../src/api/liveWatch";
import type { LiveEsense, LiveFeatures } from "../../src/api/stream";
import { Card } from "../../src/components/Card";
import { Disclaimer } from "../../src/components/Disclaimer";
import { InfoButton } from "../../src/components/InfoButton";
import { BandBars } from "../../src/components/charts/BandBars";
import { LiveBandTrend } from "../../src/components/charts/LiveBandTrend";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { useRoleAccent, useTheme, type Theme } from "../../src/theme";

/** Janelas mantidas no gráfico ao vivo (mesma cadência da captação). */
const MAX_PONTOS = 40;

/**
 * Espectador ao vivo do titular (ADR-0039): acompanha, pelo navegador, a
 * captação que acontece no **celular**. Só consome o que o servidor manda pelo
 * SSE — features transparentes e eSense rotulado, nunca raw; sem veredito.
 */
export default function PatientWatchScreen() {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [live, setLive] = useState<boolean | null>(null);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  const [bandHistory, setBandHistory] = useState<Array<Record<string, number>>>([]);
  const [esense, setEsense] = useState<LiveEsense | null>(null);
  const [encerrou, setEncerrou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Assina no monte; encerra a assinatura ao sair da tela (ref evita reconectar
  // a cada render).
  const pararRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    setEncerrou(false);
    setErro(null);
    pararRef.current = watchMyLive({
      onStatus: setLive,
      onFeatures: (f) => {
        setFeatures(f);
        setEncerrou(false);
        if (f.relative_band_powers) {
          setBandHistory((h) => [...h, f.relative_band_powers!].slice(-MAX_PONTOS));
        }
      },
      onEsense: setEsense,
      onClosed: () => setEncerrou(true),
      onEnded: () => {
        setLive(false);
        setEncerrou(true);
      },
      onError: setErro,
    });
    return () => pararRef.current?.();
  }, []);

  const alfa = features?.rel_alpha;
  const semCaptacao = live === false && features === null;

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Assistir ao vivo"
        lead="Acompanhe, pelo navegador, a captação que está acontecendo no seu celular. As features são calculadas no servidor."
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {live === null && !erro ? (
        <Card title="Conectando…" subtitle="Assinando a transmissão ao vivo." accent={papel.accent} />
      ) : null}

      {semCaptacao ? (
        <Card
          title="Nenhuma captação ao vivo agora"
          subtitle="Abra a captação no app do celular para acompanhar por aqui em tempo real."
          accent={t.colors.warningText}
        />
      ) : null}

      {live && features === null && !encerrou ? (
        <Card
          title="Ao vivo — aguardando a primeira leitura…"
          subtitle="A primeira leitura aparece quando a janela fecha (~2 s)."
          accent={papel.accent}
        />
      ) : null}

      {alfa !== undefined ? (
        <View style={styles.destaque}>
          <View style={styles.destaqueRotuloLinha}>
            <Text style={styles.destaqueRotulo}>Alfa relativa</Text>
            <InfoButton term="rel_alpha" accent={papel.accent} />
          </View>
          <Text style={styles.destaqueValor}>{(alfa * 100).toFixed(1)}%</Text>
        </View>
      ) : null}

      {features?.relative_band_powers ? (
        <Card
          title="Composição por banda"
          accent={papel.accent}
          titleAccessory={<InfoButton term="band_composition" />}
        >
          <BandBars relative={features.relative_band_powers} accent={papel.accent} />
        </Card>
      ) : null}

      {bandHistory.length > 1 ? (
        <Card
          title="Ondas ao vivo"
          accent={papel.accent}
          titleAccessory={<InfoButton term="live_band_trend" />}
        >
          <LiveBandTrend history={bandHistory} accent={papel.accent} />
        </Card>
      ) : null}

      {/* eSense (ADR-0034): à parte das features, cor neutra e com o rótulo
          obrigatório — complemento proprietário, nunca fundamento. */}
      {esense && (esense.attention !== undefined || esense.meditation !== undefined) ? (
        <View style={styles.esenseBox}>
          <View style={styles.esenseCabecalho}>
            <Text style={styles.esenseTitulo}>eSense (NeuroSky)</Text>
            <InfoButton term="esense" />
          </View>
          <View style={styles.esenseLinha}>
            {esense.attention !== undefined ? (
              <View style={styles.esenseItem}>
                <Text style={styles.esenseValor}>{esense.attention}</Text>
                <Text style={styles.esenseRotulo}>Atenção</Text>
              </View>
            ) : null}
            {esense.meditation !== undefined ? (
              <View style={styles.esenseItem}>
                <Text style={styles.esenseValor}>{esense.meditation}</Text>
                <Text style={styles.esenseRotulo}>Meditação</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.esenseNota}>
            Métrica proprietária da NeuroSky (0–100), sem validação científica
            independente. Exploratória e não-clínica: complemento, nunca base de
            conclusão.
          </Text>
        </View>
      ) : null}

      {encerrou ? (
        <Card
          title="Captação encerrada"
          subtitle="A sessão terminou no celular. O relatório fica no Histórico, se guardado."
          accent={papel.accent}
        />
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
      fontSize: 14,
    },
    destaque: {
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      paddingVertical: t.spacing.lg,
    },
    destaqueRotuloLinha: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
    },
    destaqueRotulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    destaqueValor: {
      color: t.colors.accentPatientText,
      fontSize: 44,
      fontWeight: "700",
    },
    esenseBox: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.warningText,
      borderWidth: 1,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
      marginTop: t.spacing.sm,
    },
    esenseCabecalho: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
    },
    esenseTitulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    esenseLinha: {
      flexDirection: "row",
      gap: t.spacing.xl,
      marginTop: t.spacing.xs,
    },
    esenseItem: {
      alignItems: "center",
    },
    esenseValor: {
      color: t.colors.text,
      fontSize: 32,
      fontWeight: "700",
    },
    esenseRotulo: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    esenseNota: {
      ...t.typography.caption,
      color: t.colors.warningText,
      marginTop: t.spacing.sm,
    },
  });
