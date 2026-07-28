import { useCallback, useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatPercent, type BandKey } from "../../src/api/results";
import {
  StreamSession,
  type LiveEsense,
  type LiveFeatures,
  type SessionClosed,
} from "../../src/api/stream";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { InfoButton } from "../../src/components/InfoButton";
import { BandBars } from "../../src/components/charts/BandBars";
import { LiveBandTrend } from "../../src/components/charts/LiveBandTrend";
import { SignalQuality } from "../../src/components/charts/SignalQuality";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { SensorPrepGuide } from "../../src/components/SensorPrepGuide";
import { SessionAnnotation } from "../../src/components/SessionAnnotation";
import { Disclaimer } from "../../src/components/Disclaimer";
import { describeContact } from "../../src/device/contactQuality";
import { deviceConnection } from "../../src/device/connection";
import type { DeviceInfo, Esense } from "../../src/device/DeviceConnection";
import { SignalSimulator } from "../../src/mocks/signalSimulator";
import { useAccentFor, useRoleAccent, useTheme, type Theme } from "../../src/theme";

/** Por que o relatório não foi guardado, em português para o titular. */
const MOTIVO_NAO_GUARDADO: Record<string, string> = {
  "sem consentimento":
    "Não guardamos: você ainda não autorizou o registro dos resultados.",
  "persistencia desligada":
    "Não guardamos: o registro de resultados está desligado neste ambiente.",
  "analise indisponivel": "A análise ficou indisponível ao encerrar.",
  "sem amostras": "A sessão terminou sem amostras suficientes.",
  indisponivel: "O registro de resultados não está disponível.",
};

const SAMPLE_RATE = 512;
/** Cadência de envio: blocos de 256 amostras a cada 500 ms (≈ tempo real). */
const BLOCO = 256;
const INTERVALO_MS = 500;
/** Janelas mantidas no gráfico ao vivo (janela ~2 s → ~80 s de histórico). */
const MAX_PONTOS = 40;

/**
 * Estado ao vivo a partir de um stream **simulado** (#14).
 *
 * Captação real (Android/SPP) e sinal simulado, atrás da mesma abstração. No web
 * a captura é indisponível e só o simulador aparece. As features vêm do
 * servidor — nada é calculado no cliente.
 */
export default function PatientLiveScreen() {
  const t = useTheme();
  const papel = useRoleAccent();
  const aparelhoAccent = useAccentFor("doctor");
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [ativo, setAtivo] = useState(false);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  /** eSense ao vivo relayado pelo gateway (ADR-0034), à parte das features. */
  const [esense, setEsense] = useState<LiveEsense | null>(null);
  const [janelas, setJanelas] = useState(0);
  /** Histórico de composição por banda para o gráfico ao vivo (P1-c). */
  const [bandHistory, setBandHistory] = useState<Array<Record<string, number>>>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [aparelhos, setAparelhos] = useState<DeviceInfo[]>([]);
  const [poorSignal, setPoorSignal] = useState<number | null>(null);
  const [usandoAparelho, setUsandoAparelho] = useState(false);
  /** Relatório da sessão encerrada (#17) — fecha a jornada na própria tela. */
  const [encerrada, setEncerrada] = useState<SessionClosed | null>(null);
  /** `true` entre o "stop" e a chegada do relatório. */
  const [encerrando, setEncerrando] = useState(false);

  const sessao = useRef<StreamSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Amostras do aparelho acumuladas entre envios ao servidor. */
  const pendentes = useRef<number[]>([]);
  /** Último eSense do aparelho, aguardando pegar carona no próximo bloco. */
  const esensePendente = useRef<Esense>({});

  /** Encerra a captação local (timer + aparelho), sem tocar no socket. */
  const encerrarCaptacao = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (usandoAparelho) void deviceConnection.disconnect();
    pendentes.current = [];
    esensePendente.current = {};
    setAtivo(false);
    setUsandoAparelho(false);
  }, [usandoAparelho]);

  /**
   * Para a captação e **aguarda** o relatório da sessão.
   *
   * O socket NÃO é fechado aqui: fechá-lo logo após o `stop` descartaria a
   * resposta `closed`, que é justamente onde vem o relatório (#17). Quem fecha
   * é o handler `onClosed`.
   */
  const parar = useCallback(() => {
    encerrarCaptacao();
    if (sessao.current) {
      setEncerrando(true);
      sessao.current.stop();
    }
  }, [encerrarCaptacao]);

  /** Abandona a sessão sem esperar nada (usado ao sair da tela). */
  const descartar = useCallback(() => {
    encerrarCaptacao();
    sessao.current?.close();
    sessao.current = null;
  }, [encerrarCaptacao]);

  /** Handler comum: chega o relatório, aí sim o socket pode fechar. */
  const aoEncerrar = useCallback((fim: SessionClosed) => {
    setEncerrada(fim);
    setEncerrando(false);
    sessao.current?.close();
    sessao.current = null;
  }, []);

  /** Features de uma janela: atualiza o destaque e alimenta o gráfico ao vivo. */
  const aoReceberFeatures = useCallback((f: LiveFeatures) => {
    setFeatures(f);
    setJanelas((n) => n + 1);
    const rbp = f.relative_band_powers;
    if (rbp) setBandHistory((h) => [...h, rbp].slice(-MAX_PONTOS));
  }, []);

  async function procurarAparelhos() {
    setErro(null);
    try {
      setAparelhos(await deviceConnection.listDevices());
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "não foi possível listar os aparelhos",
      );
    }
  }

  /** Captação real: o aparelho alimenta o mesmo stream do simulador. */
  async function iniciarComAparelho(device: DeviceInfo) {
    setErro(null);
    setFeatures(null);
    setEsense(null);
    setJanelas(0);
    setBandHistory([]);
    setPoorSignal(null);
    setEncerrada(null);
    esensePendente.current = {};

    const stream = new StreamSession({
      onSession: setSessionId,
      onFeatures: aoReceberFeatures,
      onEsense: setEsense,
      onClosed: aoEncerrar,
      onError: (detalhe) => {
        setErro(detalhe);
        parar();
      },
    });

    try {
      await stream.connect(device.name || "mindwave", SAMPLE_RATE);
      await deviceConnection.connect(device.id, {
        onRawSample: ({ amplitude }) => pendentes.current.push(amplitude),
        onSignalQuality: ({ poorSignal: p }) => setPoorSignal(p),
        // eSense do aparelho: guarda o último para enviar junto do próximo
        // bloco. O que a UI exibe é o valor relayado de volta pelo gateway.
        onEsense: (e) => {
          esensePendente.current = e;
        },
        onStatus: (status, detalhe) => {
          if (status === "error") setErro(detalhe ?? "falha no aparelho");
        },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não foi possível conectar");
      stream.close();
      return;
    }

    sessao.current = stream;
    setAtivo(true);
    setUsandoAparelho(true);

    // Envia o que chegou do aparelho na cadência do stream. O eSense pendente
    // pega carona e é consumido (limpo) para não reenviar valor velho.
    timer.current = setInterval(() => {
      if (pendentes.current.length === 0) return;
      const esenseAgora = esensePendente.current;
      esensePendente.current = {};
      stream.sendSamples(
        pendentes.current.splice(0, pendentes.current.length),
        esenseAgora,
      );
    }, INTERVALO_MS);
  }

  // Encerra o stream **apenas ao sair da tela** — e aí descarta sem esperar
  // relatório, porque não há mais tela para exibi-lo.
  //
  // Via ref de propósito: com `useEffect(() => descartar, [descartar])`,
  // qualquer mudança de identidade de `descartar` (depende de `usandoAparelho`)
  // faria o React rodar a limpeza do efeito anterior — desconectando o aparelho
  // no instante seguinte ao connect. O simulador não sofria disso porque não
  // alterava a dependência.
  const descartarRef = useRef(descartar);
  descartarRef.current = descartar;
  useEffect(() => () => descartarRef.current(), []);

  async function iniciar() {
    setErro(null);
    setFeatures(null);
    setEsense(null);
    setJanelas(0);
    setBandHistory([]);
    setPoorSignal(null);
    setEncerrada(null);

    const stream = new StreamSession({
      onSession: setSessionId,
      onFeatures: aoReceberFeatures,
      onEsense: setEsense,
      onClosed: aoEncerrar,
      onError: (detalhe) => {
        setErro(detalhe);
        parar();
      },
    });

    try {
      await stream.connect("simulador", SAMPLE_RATE);
    } catch {
      setErro("Não foi possível iniciar a captação simulada.");
      return;
    }

    sessao.current = stream;
    setAtivo(true);

    // O simulador emite eSense sintético para exercitar o caminho sem hardware
    // (o selo "simulado" da tela já avisa que nada aqui é medição de ninguém).
    const simulador = new SignalSimulator(SAMPLE_RATE);
    timer.current = setInterval(() => {
      stream.sendSamples(simulador.nextBlock(BLOCO), simulador.nextEsense());
      // Contato simulado: exercita a leitura de bom contato (P4-a) sem aparelho.
      setPoorSignal(simulador.nextPoorSignal());
    }, INTERVALO_MS);
  }

  const alfa = features?.rel_alpha;

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Estado ao vivo"
        lead={
          deviceConnection.supported
            ? "Conecte o MindWave pareado, ou use o sinal simulado. As features são calculadas no servidor."
            : "Sinal simulado — a captação do aparelho existe no app do celular. As features são calculadas no servidor."
        }
      />
      {/* O selo vale só para o sinal simulado: exibi-lo sobre captação real
          rotularia dado verdadeiro como fictício — enganoso na direção
          oposta, e igualmente errado. */}
      {!usandoAparelho ? <MockBadge /> : null}

      {/* Preparação do sensor (P4-a): antes de captar, como conseguir bom
          contato — reduz "lixo entra, lixo sai". Some durante a captação e ao
          ver o relatório, para não competir com a leitura ao vivo. */}
      {!ativo && !encerrada ? <SensorPrepGuide accent={papel.accent} /> : null}

      {!ativo && deviceConnection.supported ? (
        <>
          <Text style={styles.secao}>Aparelho</Text>
          <Button
            label="Procurar aparelhos pareados"
            onPress={procurarAparelhos}
            accent={aparelhoAccent.accent}
          />
          {aparelhos.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              onPress={() => void iniciarComAparelho(d)}
            >
              <Card title={d.name} subtitle={d.id} accent={aparelhoAccent.accent} />
            </Pressable>
          ))}
        </>
      ) : null}

      {!ativo && !deviceConnection.supported ? (
        <Card
          title="Captura indisponível neste dispositivo"
          subtitle="A conexão com o MindWave existe no app do celular. Aqui você pode usar o sinal simulado."
          accent={t.colors.warningText}
        />
      ) : null}

      <Button
        label={
          ativo
            ? "Parar captação"
            : deviceConnection.supported
              ? "Ou usar sinal simulado"
              : "Iniciar captação simulada"
        }
        onPress={ativo ? parar : iniciar}
        accent={ativo ? t.colors.warningText : papel.accent}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {poorSignal !== null
        ? (() => {
            // Faixa em linguagem simples sobre o número cru (P4-a). Contato tem
            // valência legítima, então a cor de alerta aqui é honesta.
            const contato = describeContact(poorSignal);
            const cor =
              contato.level === "bom"
                ? papel.accent
                : contato.level === "solto"
                  ? t.colors.dangerText
                  : t.colors.warningText;
            return (
              <Card
                title={`${contato.label} · ${poorSignal}`}
                subtitle={`${contato.hint} (0 = bom contato · 200 = eletrodo solto, valor do aparelho)`}
                accent={cor}
                titleAccessory={<InfoButton term="poor_signal" />}
              />
            );
          })()
        : null}

      {features?.unavailable ? (
        <Card
          title="Análise indisponível"
          subtitle="A captação continua e a sessão está sendo registrada."
          accent={t.colors.warningText}
        />
      ) : null}

      {alfa !== undefined ? (
        <View style={styles.destaque}>
          <View style={styles.destaqueRotuloLinha}>
            <Text style={styles.destaqueRotulo}>Alfa relativa</Text>
            <InfoButton term="rel_alpha" accent={papel.accent} />
          </View>
          <Text style={styles.destaqueValor}>{(alfa * 100).toFixed(1)}%</Text>
          <Text style={styles.destaqueNota}>janelas analisadas: {janelas}</Text>
        </View>
      ) : ativo ? (
        <Card
          title="Coletando…"
          subtitle="A primeira leitura aparece quando a janela fecha (~2 s)."
          accent={papel.accent}
        />
      ) : null}

      {features?.relative_band_powers
        ? Object.entries(features.relative_band_powers).map(([banda, valor]) => (
            <Card
              key={banda}
              title={banda}
              subtitle={`${(valor * 100).toFixed(1)}% da potência total`}
              accent={papel.accent}
              titleAccessory={<InfoButton term={`rel_${banda}`} />}
            />
          ))
        : null}

      {/* Gráfico ao vivo (P1-c): uma banda por vez, oscilando ao longo da
          sessão. Alimentado pelas features do servidor — sem DSP no cliente. */}
      {bandHistory.length > 0 ? (
        <Card
          title="Ondas ao vivo"
          accent={papel.accent}
          titleAccessory={<InfoButton term="live_band_trend" />}
        >
          <LiveBandTrend history={bandHistory} accent={papel.accent} />
        </Card>
      ) : null}

      {/* eSense (ADR-0034): à parte das features transparentes, cor neutra
          (nada de "bom/ruim") e com o rótulo obrigatório. Complemento
          proprietário e não-validado — nunca fundamento. */}
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

      {encerrando ? (
        <Card
          title="Encerrando a sessão…"
          subtitle="Calculando o relatório sobre a sessão inteira."
          accent={papel.accent}
        />
      ) : null}

      {/* Relatório da sessão encerrada (#17): fecha a jornada captar → ver. */}
      {encerrada ? (
        <>
          <Text style={styles.secao}>Relatório da sessão</Text>
          <Card
            title={
              typeof encerrada.report?.rel_alpha === "number"
                ? `Alfa relativa média: ${formatPercent(encerrada.report.rel_alpha)}`
                : "Sessão encerrada"
            }
            subtitle={`${encerrada.sampleCount} amostras recebidas`}
            accent={papel.accent}
          >
            {encerrada.report?.relative_band_powers ? (
              <>
                <Text style={styles.subsecao}>Composição por banda</Text>
                <BandBars
                  relative={encerrada.report.relative_band_powers}
                  accent={papel.accent}
                />
              </>
            ) : null}

            {encerrada.report?.quality ? (
              <>
                <Text style={styles.subsecao}>Qualidade do sinal</Text>
                <SignalQuality quality={encerrada.report.quality} />
              </>
            ) : null}

            {encerrada.report?.engine_version ? (
              <Text style={styles.engine}>
                Motor de análise: {encerrada.report.engine_version}
              </Text>
            ) : null}
          </Card>

          {/* Ser explícito sobre guardar ou não é parte do consent-first. */}
          <Card
            title={
              encerrada.storage.persisted
                ? "Sessão guardada no seu histórico"
                : "Sessão não guardada"
            }
            subtitle={
              encerrada.storage.persisted
                ? "Você pode revê-la a qualquer momento em Histórico."
                : (encerrada.storage.reason
                    ? MOTIVO_NAO_GUARDADO[encerrada.storage.reason]
                    : undefined) ?? "O resultado desta sessão não foi registrado."
            }
            accent={encerrada.storage.persisted ? papel.accent : t.colors.warningText}
          />

          {/* Versão manual do "pop-up de contexto" (P2, ADR-0037): logo após
              captar, o paciente pode anotar o contexto da sessão. */}
          {sessionId ? (
            <SessionAnnotation sessionId={sessionId} mode="edit" accent={papel.accent} />
          ) : null}
        </>
      ) : null}

      {sessionId ? (
        <Text style={styles.footnote}>Sessão {sessionId.slice(0, 8)}…</Text>
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    secao: {
      ...t.typography.heading,
      color: t.colors.text,
      marginTop: t.spacing.sm,
    },
    subsecao: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "600",
      marginTop: t.spacing.xs,
    },
    engine: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
      marginTop: t.spacing.xs,
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
      // Tela do paciente: o número em destaque usa o tom dele, e o
      // `...Text` garante contraste também no tema claro.
      color: t.colors.accentPatientText,
      fontSize: 44,
      fontWeight: "700",
    },
    destaqueNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    footnote: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.sm,
    },
    // eSense: borda de cautela (não valência) e valores em cor neutra de texto
    // — deliberadamente sem o tom do papel, para não sugerir "bom/ruim".
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
