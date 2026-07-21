import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatPercent } from "../../src/api/results";
import {
  StreamSession,
  type LiveFeatures,
  type SessionClosed,
} from "../../src/api/stream";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { BandBars } from "../../src/components/charts/BandBars";
import { SignalQuality } from "../../src/components/charts/SignalQuality";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { deviceConnection } from "../../src/device/connection";
import type { DeviceInfo } from "../../src/device/DeviceConnection";
import { SignalSimulator } from "../../src/mocks/signalSimulator";
import { colors, radius, spacing } from "../../src/theme";

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

/**
 * Estado ao vivo a partir de um stream **simulado** (#14).
 *
 * Captação real (Android/SPP) e sinal simulado, atrás da mesma abstração. No web
 * a captura é indisponível e só o simulador aparece. As features vêm do
 * servidor — nada é calculado no cliente.
 */
export default function PatientLiveScreen() {
  const [ativo, setAtivo] = useState(false);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  const [janelas, setJanelas] = useState(0);
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

  /** Encerra a captação local (timer + aparelho), sem tocar no socket. */
  const encerrarCaptacao = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (usandoAparelho) void deviceConnection.disconnect();
    pendentes.current = [];
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
    setJanelas(0);
    setPoorSignal(null);
    setEncerrada(null);

    const stream = new StreamSession({
      onSession: setSessionId,
      onFeatures: (f) => {
        setFeatures(f);
        setJanelas((n) => n + 1);
      },
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

    // Envia o que chegou do aparelho na cadência do stream.
    timer.current = setInterval(() => {
      if (pendentes.current.length === 0) return;
      stream.sendSamples(pendentes.current.splice(0, pendentes.current.length));
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
    setJanelas(0);
    setEncerrada(null);

    const stream = new StreamSession({
      onSession: setSessionId,
      onFeatures: (f) => {
        setFeatures(f);
        setJanelas((n) => n + 1);
      },
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

    const simulador = new SignalSimulator(SAMPLE_RATE);
    timer.current = setInterval(() => {
      stream.sendSamples(simulador.nextBlock(BLOCO));
    }, INTERVALO_MS);
  }

  const alfa = features?.rel_alpha;

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Estado ao vivo</Text>
      {/* O selo vale só para o sinal simulado: exibi-lo sobre captação real
          rotularia dado verdadeiro como fictício — enganoso na direção
          oposta, e igualmente errado. */}
      {!usandoAparelho ? <MockBadge /> : null}
      <Text style={styles.lead}>
        {deviceConnection.supported
          ? "Conecte o MindWave pareado, ou use o sinal simulado. As features são calculadas no servidor."
          : "Sinal simulado — a captação do aparelho existe no app do celular. As features são calculadas no servidor."}
      </Text>

      {!ativo && deviceConnection.supported ? (
        <>
          <Text style={styles.secao}>Aparelho</Text>
          <Button
            label="Procurar aparelhos pareados"
            onPress={procurarAparelhos}
            accent={colors.doctor}
          />
          {aparelhos.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              onPress={() => void iniciarComAparelho(d)}
            >
              <Card title={d.name} subtitle={d.id} accent={colors.doctor} />
            </Pressable>
          ))}
        </>
      ) : null}

      {!ativo && !deviceConnection.supported ? (
        <Card
          title="Captura indisponível neste dispositivo"
          subtitle="A conexão com o MindWave existe no app do celular. Aqui você pode usar o sinal simulado."
          accent={colors.warning}
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
        accent={ativo ? colors.warning : colors.patient}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {poorSignal !== null ? (
        <Card
          title={`Contato do sensor: ${poorSignal}`}
          subtitle="0 = bom contato · 200 = eletrodo solto (valor reportado pelo aparelho)"
          accent={poorSignal === 0 ? colors.patient : colors.warning}
        />
      ) : null}

      {features?.unavailable ? (
        <Card
          title="Análise indisponível"
          subtitle="A captação continua e a sessão está sendo registrada."
          accent={colors.warning}
        />
      ) : null}

      {alfa !== undefined ? (
        <View style={styles.destaque}>
          <Text style={styles.destaqueRotulo}>Alfa relativa</Text>
          <Text style={styles.destaqueValor}>{(alfa * 100).toFixed(1)}%</Text>
          <Text style={styles.destaqueNota}>janelas analisadas: {janelas}</Text>
        </View>
      ) : ativo ? (
        <Card
          title="Coletando…"
          subtitle="A primeira leitura aparece quando a janela fecha (~2 s)."
          accent={colors.patient}
        />
      ) : null}

      {features?.relative_band_powers
        ? Object.entries(features.relative_band_powers).map(([banda, valor]) => (
            <Card
              key={banda}
              title={banda}
              subtitle={`${(valor * 100).toFixed(1)}% da potência total`}
              accent={colors.patient}
            />
          ))
        : null}

      {encerrando ? (
        <Card
          title="Encerrando a sessão…"
          subtitle="Calculando o relatório sobre a sessão inteira."
          accent={colors.patient}
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
            accent={colors.patient}
          >
            {encerrada.report?.relative_band_powers ? (
              <>
                <Text style={styles.subsecao}>Composição por banda</Text>
                <BandBars
                  relative={encerrada.report.relative_band_powers}
                  accent={colors.patient}
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
            accent={encerrada.storage.persisted ? colors.patient : colors.warning}
          />
        </>
      ) : null}

      {sessionId ? (
        <Text style={styles.footnote}>Sessão {sessionId.slice(0, 8)}…</Text>
      ) : null}

      <Text style={styles.footnote}>
        Uso exploratório de bem-estar — não-clínico e não-diagnóstico. Estes
        números não indicam diagnóstico.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  lead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  secao: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  subsecao: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.sm / 2,
  },
  engine: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm / 2,
  },
  erro: {
    color: colors.warning,
    fontSize: 14,
  },
  destaque: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  destaqueRotulo: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  destaqueValor: {
    color: colors.patient,
    fontSize: 44,
    fontWeight: "700",
  },
  destaqueNota: {
    color: colors.textMuted,
    fontSize: 12,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
