import { useCallback, useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { formatPercent } from "../../src/api/results";
import {
  StreamSession,
  type LiveEsense,
  type LiveFeatures,
  type SessionClosed,
} from "../../src/api/stream";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { InfoButton } from "../../src/components/InfoButton";
import { LiveReadingConfidence } from "../../src/components/LiveReadingConfidence";
import { Meter } from "../../src/components/Meter";
import { Panel } from "../../src/components/Panel";
import { BandBars } from "../../src/components/charts/BandBars";
import { LiveBandTrend } from "../../src/components/charts/LiveBandTrend";
import { SignalQuality } from "../../src/components/charts/SignalQuality";
import { LiveWave } from "../../src/components/live/LiveWave";
import { MockBadge } from "../../src/components/MockBadge";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SensorPrepGuide } from "../../src/components/SensorPrepGuide";
import { SessionAnnotation } from "../../src/components/SessionAnnotation";
import { Disclaimer } from "../../src/components/Disclaimer";
import { GuidedProtocol, type ProtocolPhase } from "../../src/components/GuidedProtocol";
import { SIMULADOR_HABILITADO } from "../../src/capture/availability";
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
/** Pior contato possível relatado pelo aparelho (0 = bom, 200 = solto). */
const POOR_SIGNAL_MAX = 200;
/** A partir daqui a tela se organiza em colunas. */
const LARGURA_COLUNAS = 900;

function relogio(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Estado ao vivo — porte do herói do design "Maré"
 * (`Design/round1/estado-ao-vivo.html`, ADR-0042).
 *
 * Captação real (Android/SPP, iOS/BLE) e sinal simulado atrás da mesma
 * abstração; no web a captura é indisponível e só o simulador aparece. **As
 * features vêm do servidor — nada é calculado no cliente.**
 *
 * A composição segue o design: herói com a onda, trilho lateral com contato e
 * eSense, faixa inferior com composição por banda, sessão guiada e nota. O que
 * o mockup não tinha, porque supunha uma sessão sempre em curso, são as duas
 * outras fases reais da tela — escolher o aparelho e ler o relatório do fim —
 * e elas continuam aqui.
 */
export default function PatientLiveScreen() {
  const t = useTheme();
  const papel = useRoleAccent();
  const aparelhoAccent = useAccentFor("doctor");
  const styles = useMemo(() => criarEstilos(t), [t]);
  const emColunas = useWindowDimensions().width >= LARGURA_COLUNAS;

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
  /** Cronômetro da sessão, em segundos, e a hora em que ela começou. */
  const [duracao, setDuracao] = useState(0);
  const [inicio, setInicio] = useState<Date | null>(null);

  const sessao = useRef<StreamSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cronometro = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Simulador ativo (só no caminho web/simulado) — o protocolo guiado o usa
   *  para tornar visível o contraste olhos abertos/fechados. */
  const simuladorRef = useRef<SignalSimulator | null>(null);
  /** Amostras do aparelho acumuladas entre envios ao servidor. */
  const pendentes = useRef<number[]>([]);
  /** Último eSense do aparelho, aguardando pegar carona no próximo bloco. */
  const esensePendente = useRef<Esense>({});

  /** Encerra a captação local (timer + aparelho), sem tocar no socket. */
  const encerrarCaptacao = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (cronometro.current) clearInterval(cronometro.current);
    cronometro.current = null;
    if (usandoAparelho) void deviceConnection.disconnect();
    pendentes.current = [];
    esensePendente.current = {};
    simuladorRef.current = null;
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

  /**
   * Fase do protocolo guiado (P4-c). No simulador, eleva o alfa de "olhos
   * fechados" para o contraste ficar visível; em aparelho real é só a guia
   * (não há simulador, então isto não toca no sinal).
   */
  const aoMudarFaseProtocolo = useCallback((fase: ProtocolPhase | null) => {
    simuladorRef.current?.setAlphaAmplitude(fase === "fechado" ? 45 : 20);
  }, []);

  /** Features de uma janela: atualiza o destaque e alimenta o gráfico ao vivo. */
  const aoReceberFeatures = useCallback((f: LiveFeatures) => {
    setFeatures(f);
    setJanelas((n) => n + 1);
    const rbp = f.relative_band_powers;
    if (rbp) setBandHistory((h) => [...h, rbp].slice(-MAX_PONTOS));
  }, []);

  /** Zera o painel para uma sessão nova (os dois caminhos usam isto). */
  function limparParaNovaSessao() {
    setErro(null);
    setFeatures(null);
    setEsense(null);
    setJanelas(0);
    setBandHistory([]);
    setPoorSignal(null);
    setEncerrada(null);
    setDuracao(0);
    setInicio(new Date());
  }

  /** Começa a contar o tempo de sessão (parado junto da captação). */
  function iniciarCronometro() {
    cronometro.current = setInterval(() => setDuracao((s) => s + 1), 1000);
  }

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
    limparParaNovaSessao();
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
    iniciarCronometro();

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
    limparParaNovaSessao();

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
    iniciarCronometro();

    // O simulador emite eSense sintético para exercitar o caminho sem hardware
    // (o selo "simulado" da tela já avisa que nada aqui é medição de ninguém).
    const simulador = new SignalSimulator(SAMPLE_RATE);
    simuladorRef.current = simulador;
    timer.current = setInterval(() => {
      stream.sendSamples(simulador.nextBlock(BLOCO), simulador.nextEsense());
      // Contato simulado: exercita a leitura de bom contato (P4-a) sem aparelho.
      setPoorSignal(simulador.nextPoorSignal());
    }, INTERVALO_MS);
  }

  const alfa = features?.rel_alpha;
  const contato = poorSignal !== null ? describeContact(poorSignal) : null;
  const corContato =
    contato === null
      ? t.colors.textMuted
      : contato.level === "bom"
        ? papel.accent
        : contato.level === "solto"
          ? t.colors.dangerText
          : t.colors.warningText;

  return (
    <ScreenContainer wide>
      {/* ===== faixa superior: cronômetro e situação da sessão ===== */}
      <View style={styles.topo}>
        {ativo || encerrando ? (
          <Text style={styles.cronometro} accessibilityLabel="Duração da sessão">
            {relogio(duracao)}
          </Text>
        ) : null}
        <Chip
          label={ativo ? "AO VIVO" : encerrada ? "Sessão encerrada" : "Sem captação"}
          variant={ativo ? "estado" : "neutro"}
          accent={papel.accent}
          dot
        />
        <View style={styles.espacador} />
        {inicio && (ativo || encerrada) ? (
          <Text style={styles.topoNota}>
            iniciada às{" "}
            {inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}
      </View>

      {/* O selo vale só para o sinal simulado (dev): exibi-lo sobre captação
          real rotularia dado verdadeiro como fictício — enganoso na direção
          oposta, e igualmente errado. */}
      {SIMULADOR_HABILITADO && !usandoAparelho ? <MockBadge /> : null}
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {/* ===== herói + trilho lateral ===== */}
      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        <View style={styles.colunaHeroi}>
          <Panel grow>
            <LiveWave
              accent={papel.accent}
              paused={!ativo}
              scale={ativo ? 1 : 0.35}
              height={emColunas ? 260 : 180}
            />
            <View style={styles.heroiChips}>
              <Chip
                label={ativo ? "ritmo ao vivo" : "em repouso"}
                variant={ativo ? "estado" : "neutro"}
                accent={papel.accent}
                dot
              />
              <Chip label="visualização estilizada — não é exame" variant="cautela" />
            </View>
            <Text style={styles.heroiNota}>
              A figura acima marca que a sessão está correndo; ela não desenha o seu
              sinal. As medidas são calculadas no servidor e aparecem rotuladas abaixo.
            </Text>

            {/* Fase ociosa: o mockup supõe sessão em curso, mas aqui é onde se
                escolhe a fonte do sinal. */}
            {!ativo && !encerrada ? (
              <View style={styles.veu}>
                <Text style={styles.veuTitulo}>
                  {deviceConnection.supported
                    ? "Pronto para captar"
                    : "Captação no app do celular"}
                </Text>
                <Text style={styles.veuTexto}>
                  {deviceConnection.supported
                    ? "Ligue o MindWave e escolha-o na lista. A sessão começa assim que o contato ficar bom."
                    : SIMULADOR_HABILITADO
                      ? "A conexão com o MindWave existe no app do celular. Aqui você pode usar o sinal simulado."
                      : "A conexão com o MindWave existe no app do celular. Neste dispositivo você acompanha seu histórico e suas tendências."}
                </Text>
              </View>
            ) : null}

            {/* ===== controles da sessão ===== */}
            <View style={styles.controles}>
              {ativo || SIMULADOR_HABILITADO ? (
                <View style={styles.controlePrincipal}>
                  <Button
                    label={
                      ativo
                        ? "Encerrar e salvar sessão"
                        : deviceConnection.supported
                          ? "Ou usar sinal simulado"
                          : "Iniciar captação simulada"
                    }
                    onPress={ativo ? parar : iniciar}
                    accent={ativo ? t.colors.warningText : papel.accent}
                  />
                </View>
              ) : null}
              <Text style={styles.controleNota}>🔒 só você vê esta sessão</Text>
            </View>
          </Panel>

          {!ativo && deviceConnection.supported ? (
            <Panel title="Aparelho" eyebrow="bluetooth">
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
            </Panel>
          ) : null}
        </View>

        {/* ===== trilho: contato do sensor + eSense ===== */}
        <View style={[styles.trilho, emColunas && styles.trilhoLateral]}>
          <Panel
            title="Qualidade do sinal"
            headerAccessory={<InfoButton term="poor_signal" />}
          >
            {contato && poorSignal !== null ? (
              <>
                <View style={styles.valorLinha}>
                  <Text style={[styles.valorGrande, { color: corContato }]}>
                    {poorSignal}
                  </Text>
                  <Text style={styles.valorUnidade}>poorSignal (0–200)</Text>
                </View>
                {/* O aparelho relata 0 = bom contato e 200 = eletrodo solto; a
                    barra inverte isso só para encher à direita quando está bom.
                    O número cru fica à vista para ninguém precisar confiar na
                    barra — e não inventamos um "% de contato", que seria uma
                    unidade que o aparelho não dá. */}
                <Meter
                  value={1 - poorSignal / POOR_SIGNAL_MAX}
                  color={corContato}
                  accessibilityLabel={`Contato do sensor: ${contato.label}, poorSignal ${poorSignal} de ${POOR_SIGNAL_MAX}`}
                />
                <Chip label={contato.label} variant="estado" accent={corContato} dot />
                <Text style={styles.notaPainel}>{contato.hint}</Text>
              </>
            ) : (
              <Text style={styles.notaPainel}>
                Sem leitura de contato. O valor aparece quando a captação começa.
              </Text>
            )}

            {/* Quando confiar na leitura (P4-b): elo entre o contato acima e as
                features abaixo. Qualificador de confiabilidade, não juízo de
                estado. */}
            {ativo && poorSignal !== null ? (
              <LiveReadingConfidence poorSignal={poorSignal} accent={papel.accent} />
            ) : null}
          </Panel>

          {/* eSense (ADR-0034): complemento proprietário e não-validado, nunca
              fundamento. Cor neutra — nada de "bom/ruim". */}
          <Panel
            title="eSense"
            headerAccessory={<Chip label="proprietário · não validado" variant="cautela" />}
          >
            {esense && (esense.attention !== undefined || esense.meditation !== undefined) ? (
              <>
                {esense.attention !== undefined ? (
                  <View style={styles.esenseLinha}>
                    <View style={styles.esenseRotuloLinha}>
                      <Text style={styles.esenseRotulo}>Atenção</Text>
                      <Text style={styles.esenseValor}>{esense.attention}</Text>
                    </View>
                    <Meter
                      value={esense.attention / 100}
                      color={t.colors.textMuted}
                      accessibilityLabel={`Atenção eSense: ${esense.attention} de 100`}
                    />
                  </View>
                ) : null}
                {esense.meditation !== undefined ? (
                  <View style={styles.esenseLinha}>
                    <View style={styles.esenseRotuloLinha}>
                      <Text style={styles.esenseRotulo}>Meditação</Text>
                      <Text style={styles.esenseValor}>{esense.meditation}</Text>
                    </View>
                    <Meter
                      value={esense.meditation / 100}
                      color={t.colors.textMuted}
                      accessibilityLabel={`Meditação eSense: ${esense.meditation} de 100`}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.notaPainel}>
                Sem índices no momento. Eles chegam junto do sinal do aparelho.
              </Text>
            )}
            <View style={styles.esenseNotaLinha}>
              <Text style={styles.notaCautela}>
                Índices 0–100 do algoritmo proprietário do sensor, sem validação
                científica independente. Complemento exploratório — a leitura principal
                é a composição por banda.
              </Text>
              <InfoButton term="esense" />
            </View>
          </Panel>
        </View>
      </View>

      {/* ===== destaque de alfa + análise indisponível ===== */}
      {features?.unavailable ? (
        <Panel title="Análise indisponível" eyebrow="a captação segue">
          <Text style={styles.notaPainel}>
            A captação continua e a sessão está sendo registrada.
          </Text>
        </Panel>
      ) : null}

      {alfa !== undefined ? (
        <Panel>
          <View style={styles.destaque}>
            <View style={styles.destaqueRotuloLinha}>
              <Text style={styles.destaqueRotulo}>Alfa relativa</Text>
              <InfoButton term="rel_alpha" accent={papel.accent} />
            </View>
            <Text style={styles.destaqueValor}>{(alfa * 100).toFixed(1)}%</Text>
            <Text style={styles.destaqueNota}>janelas analisadas: {janelas}</Text>
          </View>
        </Panel>
      ) : ativo ? (
        <Panel title="Coletando…">
          <Text style={styles.notaPainel}>
            A primeira leitura aparece quando a janela fecha (~2 s). É normal os valores
            oscilarem no começo — eles se acomodam conforme a captação segue.
          </Text>
        </Panel>
      ) : null}

      {/* ===== faixa inferior: bandas, sessão guiada e nota ===== */}
      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        {features?.relative_band_powers ? (
          <View style={styles.colunaHeroi}>
            <Panel
              title="Composição por banda"
              eyebrow="% do espectro · potência relativa"
              grow
            >
              <BandBars relative={features.relative_band_powers} />
              <Text style={styles.notaPainel}>
                Potência relativa de cada banda no espectro da última janela. As bandas
                não têm valência — nenhuma é “boa” ou “ruim”; o interesse está em como a
                composição muda entre estados e ao longo das sessões.
              </Text>
            </Panel>
          </View>
        ) : null}

        {/* Gráfico ao vivo (P1-c): uma banda por vez, oscilando ao longo da
            sessão. Alimentado pelas features do servidor — sem DSP no cliente. */}
        {bandHistory.length > 0 ? (
          <View style={styles.colunaHeroi}>
            <Panel
              title="Ondas ao vivo"
              headerAccessory={<InfoButton term="live_band_trend" />}
              grow
            >
              <LiveBandTrend history={bandHistory} accent={papel.accent} />
            </Panel>
          </View>
        ) : null}
      </View>

      {/* Protocolo guiado olhos abertos/fechados (P4-c): contraste de estado na
          mesma captação. Client-only — não persiste fase; contexto vai na
          anotação (P2). Some ao encerrar (desmonta e limpa o timer). */}
      {ativo ? (
        <Panel title="Sessão guiada" eyebrow="opcional">
          <GuidedProtocol
            accent={papel.accent}
            onPhaseChange={aoMudarFaseProtocolo}
            embedded
          />
        </Panel>
      ) : null}

      {/* Preparação do sensor (P4-a): antes de captar, como conseguir bom
          contato — reduz "lixo entra, lixo sai". Some durante a captação e ao
          ver o relatório, para não competir com a leitura ao vivo. */}
      {!ativo && !encerrada ? <SensorPrepGuide accent={papel.accent} /> : null}

      {encerrando ? (
        <Panel title="Encerrando a sessão…">
          <Text style={styles.notaPainel}>
            Calculando o relatório sobre a sessão inteira.
          </Text>
        </Panel>
      ) : null}

      {/* Relatório da sessão encerrada (#17): fecha a jornada captar → ver. */}
      {encerrada ? (
        <>
          <Panel
            title={
              typeof encerrada.report?.rel_alpha === "number"
                ? `Alfa relativa média: ${formatPercent(encerrada.report.rel_alpha)}`
                : "Sessão encerrada"
            }
            eyebrow={`${encerrada.sampleCount} amostras`}
          >
            {encerrada.report?.relative_band_powers ? (
              <>
                <Text style={styles.subsecao}>Composição por banda</Text>
                <BandBars relative={encerrada.report.relative_band_powers} />
              </>
            ) : null}

            {encerrada.report?.quality ? (
              <>
                <Text style={styles.subsecao}>Qualidade do sinal</Text>
                <SignalQuality quality={encerrada.report.quality} />
              </>
            ) : null}
          </Panel>

          {/* Ser explícito sobre guardar ou não é parte do consent-first. */}
          <Panel title={encerrada.storage.persisted ? "Sessão guardada" : "Sessão não guardada"}>
            <Text style={styles.notaPainel}>
              {encerrada.storage.persisted
                ? "Você pode revê-la a qualquer momento em Histórico."
                : (encerrada.storage.reason
                    ? MOTIVO_NAO_GUARDADO[encerrada.storage.reason]
                    : undefined) ?? "O resultado desta sessão não foi registrado."}
            </Text>
          </Panel>

          {/* Versão manual do "pop-up de contexto" (P2, ADR-0037): logo após
              captar, o paciente pode anotar o contexto da sessão. */}
          {sessionId ? (
            <Panel title="Nota de contexto" eyebrow="autorrelato">
              <SessionAnnotation
                sessionId={sessionId}
                mode="edit"
                accent={papel.accent}
                embedded
              />
            </Panel>
          ) : null}
        </>
      ) : null}

      {/* Rastro de proveniência: de onde vem cada número desta tela. */}
      <Text style={styles.rastro}>
        {[
          encerrada?.report?.engine_version
            ? `motor ${encerrada.report.engine_version}`
            : "motor wave_eeg",
          "métricas calculadas no servidor WaveAI",
          "janela de 2 s · 512 Hz · canal FP1",
          sessionId ? `sessão ${sessionId.slice(0, 8)}…` : null,
        ]
          .filter(Boolean)
          .join("  ·  ")}
      </Text>

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    topo: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    cronometro: {
      ...t.typography.title,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    espacador: {
      flex: 1,
    },
    topoNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    grade: {
      gap: t.spacing.md,
    },
    gradeLinha: {
      alignItems: "stretch",
      flexDirection: "row",
    },
    colunaHeroi: {
      flex: 1,
      gap: t.spacing.md,
      // Sem isto, um filho largo (a onda) estica a coluna e estoura a linha.
      minWidth: 0,
    },
    trilho: {
      gap: t.spacing.md,
    },
    trilhoLateral: {
      width: 320,
    },
    heroiChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    heroiNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    veu: {
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      gap: t.spacing.xs,
      padding: t.spacing.md,
    },
    veuTitulo: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    veuTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
    },
    controles: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    controlePrincipal: {
      flexGrow: 1,
      minWidth: 220,
    },
    controleNota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    valorLinha: {
      alignItems: "baseline",
      flexDirection: "row",
      gap: t.spacing.sm,
    },
    valorGrande: {
      fontSize: 34,
      fontWeight: "700",
    },
    valorUnidade: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
    notaPainel: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      lineHeight: 18,
    },
    notaCautela: {
      ...t.typography.caption,
      color: t.colors.warningText,
      flexShrink: 1,
      lineHeight: 18,
    },
    esenseLinha: {
      gap: t.spacing.xs,
    },
    esenseRotuloLinha: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    esenseRotulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
    },
    esenseValor: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    esenseNotaLinha: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: t.spacing.xs,
    },
    destaque: {
      alignItems: "center",
    },
    destaqueRotuloLinha: {
      alignItems: "center",
      flexDirection: "row",
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
    subsecao: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "600",
      marginTop: t.spacing.xs,
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
      fontSize: 14,
    },
    rastro: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      fontSize: 11,
      marginTop: t.spacing.sm,
    },
  });
