import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StreamSession, type LiveFeatures } from "../../src/api/stream";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { deviceConnection } from "../../src/device/connection";
import type { DeviceInfo } from "../../src/device/DeviceConnection";
import { SignalSimulator } from "../../src/mocks/signalSimulator";
import { colors, radius, spacing } from "../../src/theme";

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

  const sessao = useRef<StreamSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Amostras do aparelho acumuladas entre envios ao servidor. */
  const pendentes = useRef<number[]>([]);

  const parar = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (usandoAparelho) void deviceConnection.disconnect();
    sessao.current?.stop();
    sessao.current?.close();
    sessao.current = null;
    pendentes.current = [];
    setAtivo(false);
    setUsandoAparelho(false);
  }, [usandoAparelho]);

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

    const stream = new StreamSession({
      onSession: setSessionId,
      onFeatures: (f) => {
        setFeatures(f);
        setJanelas((n) => n + 1);
      },
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

  // Encerra o stream **apenas ao sair da tela**.
  //
  // Via ref de propósito: com `useEffect(() => parar, [parar])`, qualquer
  // mudança de identidade de `parar` (ela depende de `usandoAparelho`) fazia o
  // React rodar a limpeza do efeito anterior — desconectando o aparelho no
  // instante seguinte ao connect. O simulador não sofria disso porque não
  // alterava a dependência.
  const pararRef = useRef(parar);
  pararRef.current = parar;
  useEffect(() => () => pararRef.current(), []);

  async function iniciar() {
    setErro(null);
    setFeatures(null);
    setJanelas(0);

    const stream = new StreamSession({
      onSession: setSessionId,
      onFeatures: (f) => {
        setFeatures(f);
        setJanelas((n) => n + 1);
      },
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
