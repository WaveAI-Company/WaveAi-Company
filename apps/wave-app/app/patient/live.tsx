import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { StreamSession, type LiveFeatures } from "../../src/api/stream";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SignalSimulator } from "../../src/mocks/signalSimulator";
import { colors, radius, spacing } from "../../src/theme";

const SAMPLE_RATE = 512;
/** Cadência de envio: blocos de 256 amostras a cada 500 ms (≈ tempo real). */
const BLOCO = 256;
const INTERVALO_MS = 500;

/**
 * Estado ao vivo a partir de um stream **simulado** (#14).
 *
 * A captação real do MindWave é uma capability de mobile (#12); aqui o sinal
 * vem de um simulador, e a tela deixa isso explícito. As features vêm do
 * servidor — nada é calculado no cliente.
 */
export default function PatientLiveScreen() {
  const [ativo, setAtivo] = useState(false);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  const [janelas, setJanelas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sessao = useRef<StreamSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const parar = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    sessao.current?.stop();
    sessao.current?.close();
    sessao.current = null;
    setAtivo(false);
  }, []);

  // Encerra o stream se a tela sair — sessão órfã fica `aborted` no servidor,
  // mas fechar aqui evita segurar conexão à toa.
  useEffect(() => parar, [parar]);

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
      <MockBadge />
      <Text style={styles.lead}>
        Sinal simulado para exercitar o fluxo ponta a ponta. A captação real do
        aparelho chega na issue #12. As features são calculadas no servidor.
      </Text>

      <Button
        label={ativo ? "Parar captação" : "Iniciar captação simulada"}
        onPress={ativo ? parar : iniciar}
        accent={ativo ? colors.warning : colors.patient}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

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
