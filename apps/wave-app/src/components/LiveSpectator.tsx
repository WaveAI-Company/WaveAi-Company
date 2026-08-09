import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { WatchHandlers } from "../api/liveWatch";
import type { LiveEsense, LiveFeatures } from "../api/stream";
import { useTheme, type Theme } from "../theme";
import { BandBars } from "./charts/BandBars";
import { LiveBandTrend } from "./charts/LiveBandTrend";
import { Card } from "./Card";
import { InfoButton } from "./InfoButton";

/** Janelas mantidas no gráfico ao vivo (mesma cadência da captação). */
const MAX_PONTOS = 40;

type Props = {
  /** Abre a assinatura SSE e devolve a função de encerrar (titular/profissional). */
  subscribe: (handlers: WatchHandlers) => () => void;
  accent: string;
  /** Texto quando não há captação — difere entre titular e profissional. */
  semCaptacaoTexto: string;
};

/**
 * View do espectador ao vivo (ADR-0039), compartilhada pelo titular e pelo
 * profissional — muda só a origem da assinatura (`subscribe`). Só consome o que
 * o servidor manda: features transparentes + eSense rotulado, **nunca raw**;
 * sem veredito (ADR-0027).
 */
export function LiveSpectator({ subscribe, accent, semCaptacaoTexto }: Props) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [live, setLive] = useState<boolean | null>(null);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  const [bandHistory, setBandHistory] = useState<Array<Record<string, number>>>([]);
  const [esense, setEsense] = useState<LiveEsense | null>(null);
  const [encerrou, setEncerrou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * O titular ligou o compartilhamento desta sessão (ADR-0045)? `null` = ainda
   * não sabemos, ou é o stream do próprio titular (que não depende da chave).
   */
  const [compartilhado, setCompartilhado] = useState<boolean | null>(null);

  const pararRef = useRef<(() => void) | null>(null);
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  useEffect(() => {
    setEncerrou(false);
    setErro(null);
    pararRef.current = subscribeRef.current({
      onStatus: (aoVivo, shared) => {
        setLive(aoVivo);
        if (shared !== undefined) setCompartilhado(shared);
      },
      // O titular mexeu na chave durante a transmissão. Ao desligar, o servidor
      // encerra o stream logo em seguida — aqui só trocamos o que a tela diz.
      onShare: setCompartilhado,
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
  //: Captando, mas sem autorização de acompanhar ao vivo. É estado próprio: não
  //: é "não está captando" nem erro — e dizer a coisa certa é o que impede a
  //: tela de afirmar o que não é verdade (ADR-0027).
  const semCompartilhamento = live === true && compartilhado === false;

  return (
    <View style={styles.wrapper}>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {live === null && !erro ? (
        <Card title="Conectando…" subtitle="Assinando a transmissão ao vivo." accent={accent} />
      ) : null}

      {semCaptacao ? (
        <Card title="Nenhuma captação ao vivo agora" subtitle={semCaptacaoTexto} accent={t.colors.warningText} />
      ) : null}

      {semCompartilhamento ? (
        <Card
          title="Esta pessoa não está compartilhando ao vivo"
          subtitle="Ela está captando agora, mas o acompanhamento ao vivo é um aceite separado, que ela liga e desliga na própria sessão. Suas tendências e resumos seguem disponíveis."
          accent={t.colors.warningText}
        />
      ) : null}

      {live && !semCompartilhamento && features === null && !encerrou ? (
        <Card
          title="Ao vivo — aguardando a primeira leitura…"
          subtitle="A primeira leitura aparece quando a janela fecha (~2 s)."
          accent={accent}
        />
      ) : null}

      {alfa !== undefined ? (
        <View style={styles.destaque}>
          <View style={styles.destaqueRotuloLinha}>
            <Text style={styles.destaqueRotulo}>Alfa relativa</Text>
            <InfoButton term="rel_alpha" accent={accent} />
          </View>
          <Text style={[styles.destaqueValor, { color: accent }]}>{(alfa * 100).toFixed(1)}%</Text>
        </View>
      ) : null}

      {features?.relative_band_powers ? (
        <Card
          title="Composição por banda"
          accent={accent}
          titleAccessory={<InfoButton term="band_composition" />}
        >
          <BandBars relative={features.relative_band_powers} accent={accent} />
        </Card>
      ) : null}

      {bandHistory.length > 1 ? (
        <Card
          title="Ondas ao vivo"
          accent={accent}
          titleAccessory={<InfoButton term="live_band_trend" />}
        >
          <LiveBandTrend history={bandHistory} accent={accent} />
        </Card>
      ) : null}

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
          subtitle="A sessão terminou. O relatório fica no histórico, se guardado."
          accent={accent}
        />
      ) : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: t.spacing.md,
    },
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
      fontSize: 44,
      fontWeight: "700",
    },
    esenseBox: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.warningText,
      borderWidth: 1,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
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
      color: t.colors.textSubtle,
    },
    esenseNota: {
      ...t.typography.caption,
      color: t.colors.warningText,
      marginTop: t.spacing.sm,
    },
  });
