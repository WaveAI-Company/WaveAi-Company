import { useCallback, useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { Icon } from "../../src/components/Icon";
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
import { Switch } from "../../src/components/Switch";
import { setLiveSharing } from "../../src/api/liveWatch";
import { Disclaimer } from "../../src/components/Disclaimer";
import { GuidedProtocol, type ProtocolPhase } from "../../src/components/GuidedProtocol";
import { SIMULADOR_HABILITADO } from "../../src/capture/availability";
import { describeContact } from "../../src/device/contactQuality";
import { deviceConnection } from "../../src/device/connection";
import type { DeviceInfo, Esense } from "../../src/device/DeviceConnection";
import { mensagemBluetooth } from "../../src/device/mensagens";
import { SignalSimulator } from "../../src/mocks/signalSimulator";
import {
  larguras,
  useAccentFor,
  useFaixa,
  useInteracao,
  useRoleAccent,
  useTheme,
  type Theme,
} from "../../src/theme";

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
// `.grid` do mockup: `minmax(0,1fr) 360px` acima de 1199 e uma coluna
// abaixo — o trilho lateral não sobrevive à faixa média.

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
  const faixa = useFaixa();
  const emColunas = faixa === "largo";
  /** Tablet: o trilho vira linha e o trio vira duas colunas (`≤1199` do mockup). */
  const emMeio = faixa === "medio";

  const [ativo, setAtivo] = useState(false);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  /** eSense ao vivo relayado pelo gateway (ADR-0034), à parte das features. */
  const [esense, setEsense] = useState<LiveEsense | null>(null);
  const [janelas, setJanelas] = useState(0);
  /** Histórico de composição por banda para o gráfico ao vivo (P1-c). */
  const [bandHistory, setBandHistory] = useState<Array<Record<string, number>>>([]);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Falha do aparelho, mostrada **junto do botão** que a causou.
   *
   * Separada de `erro` porque o lugar importa: a mensagem de Bluetooth nascia
   * no topo da página, fora da dobra no celular, e quem tocava "Procurar" não
   * a via. Aqui ela fica no painel "Aparelho", ao alcance do olho.
   */
  const [erroAparelho, setErroAparelho] = useState<string | null>(null);
  /**
   * `null` enquanto não se sabe — e "não sei" não é "desligado". Antes de
   * responder, a tela não promete nem um botão nem o outro.
   */
  const [btLigado, setBtLigado] = useState<boolean | null>(null);
  /**
   * Id do aparelho em conexão, ou `null`. Guarda o **id** e não um booleano
   * porque a lista precisa saber *qual* item está ocupado: só ele mostra
   * "Conectando…", e os outros ficam inertes enquanto isso.
   */
  const [conectandoA, setConectandoA] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  /**
   * Compartilhamento ao vivo desta sessão (ADR-0045). Nasce DESLIGADO a cada
   * sessão — é o "aceite separado, sessão a sessão" que o produto promete.
   */
  const [compartilhando, setCompartilhando] = useState(false);
  const [erroCompartilhar, setErroCompartilhar] = useState<string | null>(null);

  /**
   * Sessão nova: o compartilhamento **volta a nascer desligado** (ADR-0045).
   * Sem este reset, a escolha de uma captação vazaria para a seguinte — e
   * "sessão a sessão" deixaria de ser verdade.
   */
  const aoAbrirSessao = useCallback((id: string) => {
    setSessionId(id);
    setCompartilhando(false);
    setErroCompartilhar(null);
  }, []);

  const alternarCompartilhamento = useCallback(
    async (proximo: boolean) => {
      if (!sessionId) return;
      // Otimista: o gesto responde na hora e volta atrás se o servidor recusar
      // — desligar é o caso urgente, e esperar a rede para ele seria pior.
      setCompartilhando(proximo);
      setErroCompartilhar(null);
      try {
        setCompartilhando(await setLiveSharing(sessionId, proximo));
      } catch {
        setCompartilhando(!proximo);
        setErroCompartilhar(
          "Não foi possível mudar o compartilhamento agora. Tente de novo.",
        );
      }
    },
    [sessionId],
  );

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

  /**
   * Zera o painel para uma sessão nova (os dois caminhos usam isto).
   *
   * **Descarta a sessão anterior antes de tudo.** `parar()` deixa o socket
   * aberto de propósito — é por ele que chega o relatório —, e só o handler
   * `onClosed` fecha. Entre um e outro existe uma janela em que a sessão velha
   * ainda está viva: quem clicasse em iniciar ali ganhava um `sessao.current`
   * novo por cima do antigo, e o `closed` atrasado da sessão velha caía no
   * `aoEncerrar`, que fecha **a sessão corrente** — ou seja, matava a captação
   * recém-iniciada e mostrava o relatório da anterior no lugar dela, sem saída
   * a não ser recarregar a página. O `encerrando` também precisa voltar: preso
   * em `true`, o painel "Encerrando a sessão…" acompanharia a sessão nova.
   *
   * Não reproduzi o erro em quatro caminhos (ciclo normal, reinício em 2s,
   * reinício com o protocolo guiado rodando e um terceiro ciclo seguido); o
   * mecanismo veio da leitura, e a guarda é barata o bastante para valer sem a
   * reprodução.
   */
  function limparParaNovaSessao() {
    sessao.current?.close();
    sessao.current = null;
    setEncerrando(false);
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

  /**
   * Nomes que aparecem mais de uma vez na lista.
   *
   * É o que decide se o endereço do aparelho precisa ser mostrado: com nomes
   * distintos ele é só ruído; com nomes iguais ("MindWave Mobile" duas vezes)
   * ele é a única forma de escolher o certo.
   */
  const nomesRepetidos = useMemo(() => {
    const vistos = new Set<string>();
    const repetidos = new Set<string>();
    for (const d of aparelhos) {
      if (vistos.has(d.name)) repetidos.add(d.name);
      vistos.add(d.name);
    }
    return repetidos;
  }, [aparelhos]);

  /** Relê o estado do rádio. Chamada ao abrir e depois de cada tentativa. */
  const conferirBluetooth = useCallback(async () => {
    if (!deviceConnection.supported) return false;
    try {
      const ligado = await deviceConnection.bluetoothLigado();
      setBtLigado(ligado);
      return ligado;
    } catch {
      // Não saber o estado não é motivo para travar a tela: deixa `null` e a
      // pessoa segue podendo tentar procurar.
      setBtLigado(null);
      return false;
    }
  }, []);

  useEffect(() => {
    void conferirBluetooth();
  }, [conferirBluetooth]);

  /**
   * Pede para ligar o rádio. No Android o sistema mostra o diálogo; no iOS
   * ninguém liga por fora, então a tela instrui em vez de fingir que tentou.
   */
  async function ligarBluetooth() {
    setErroAparelho(null);
    try {
      const ligou = await deviceConnection.pedirBluetooth();
      setBtLigado(ligou);
      if (ligou) {
        await procurarAparelhos();
      } else {
        setErroAparelho(
          "Ligue o Bluetooth pelas configurações do aparelho e toque em procurar.",
        );
      }
    } catch (e) {
      setErroAparelho(mensagemBluetooth(e));
    }
  }

  async function procurarAparelhos() {
    setErroAparelho(null);
    // Pergunta antes: com o rádio desligado, `listDevices` falharia com o
    // texto cru da biblioteca, e a tela já sabe fazer melhor que isso.
    if (deviceConnection.supported && !(await conferirBluetooth())) {
      setErroAparelho("O Bluetooth está desligado. Ligue-o para procurar o aparelho.");
      return;
    }
    try {
      setAparelhos(await deviceConnection.listDevices());
    } catch (e) {
      setErroAparelho(mensagemBluetooth(e));
      void conferirBluetooth();
    }
  }

  /** Captação real: o aparelho alimenta o mesmo stream do simulador. */
  async function iniciarComAparelho(device: DeviceInfo) {
    // **Um toque por vez.** Entre o toque e a primeira medida passam alguns
    // segundos em que a tela não mudava nada — e, sem sinal de que algo estava
    // acontecendo, o caminho natural era tocar de novo. Cada toque abriria
    // outra sessão e outra conexão com o mesmo aparelho.
    if (conectandoA) return;
    setConectandoA(device.id);
    limparParaNovaSessao();
    esensePendente.current = {};

    const stream = new StreamSession({
      onSession: aoAbrirSessao,
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
          if (status === "error") setErroAparelho(mensagemBluetooth(detalhe));
        },
      });
    } catch (e) {
      setErroAparelho(mensagemBluetooth(e));
      stream.close();
      setConectandoA(null);
      return;
    }

    sessao.current = stream;
    setAtivo(true);
    setUsandoAparelho(true);
    setConectandoA(null);
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
      onSession: aoAbrirSessao,
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

  /**
   * O relatório da sessão encerrada, montado aqui porque **muda de lugar**: no
   * desktop ele entra na linha do trio, ao lado da composição da última
   * janela; nas outras faixas segue no fluxo, abaixo dela. Montar uma vez é o
   * que impede as duas cópias de divergirem na primeira correção.
   *
   * Trocar de contêiner ao cruzar 1199 **remonta** o cartão — sem custo aqui,
   * porque não há nada digitado nele (a "Nota de contexto", que tem, não sai
   * do lugar).
   */
  const painelRelatorio = encerrada ? (
    <Panel
      title={
        typeof encerrada.report?.rel_alpha === "number"
          ? `Alfa relativa média: ${formatPercent(encerrada.report.rel_alpha)}`
          : "Sessão encerrada"
      }
      eyebrow={`${encerrada.sampleCount} amostras`}
      grow
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
  ) : null;

  return (
    <ScreenContainer largura="app">
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
      {/* O erro do aparelho saiu daqui: no celular esta linha fica acima da
          dobra, e quem tocava "Procurar" não via a mensagem que o próprio
          toque acabara de gerar. Agora ela mora ao lado do botão, no painel
          "Aparelho". Este ponto só mostra o que não tem dono na tela. */}
      {erro && !erroAparelho ? <Text style={styles.erro}>{erro}</Text> : null}

      {/* ===== herói + trilho lateral ===== */}
      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        <View style={[styles.colunaHeroi, emColunas && styles.colunaHeroiLinha]}>
          <Panel grow>
            {/**
             * `.hero-inner{position:relative; flex:1; min-height:320px}` com
             * `.hero-meta` no canto de cima à esquerda e `.hero-note` no de
             * baixo à direita, **os dois sobre a onda**.
             *
             * No desktop os dois estavam no fluxo, abaixo da onda: como os
             * controles são ancorados no fim (`marginTop:"auto"`), sobrava um
             * vão de 47px entre a nota e a linha de separação. Flutuando por
             * cima, os dois acompanham a caixa da onda e a nota encosta no
             * separador.
             *
             * **A onda continua com altura fixa**, centrada na caixa que
             * cresce. Deixá-la preencher (o `inset:0` do canvas no mockup)
             * esticou o desenho de 320 para 441px — e o `preserveAspectRatio=
             * "none"` amplia a amplitude junto com a altura, então o traço
             * saiu ampliado e deformado em vez de maior. O canvas do mockup
             * redesenha na altura real; o nosso SVG escala.
             *
             * Nas faixas menores eles seguem no fluxo: o texto é longo — bem
             * mais que o do mockup — e sobre uma onda estreita ele cobriria a
             * figura inteira.
             */}
            <View style={[styles.heroiInterno, emColunas && styles.heroiInternoLargo]}>
              <LiveWave
                accent={papel.accent}
                paused={!ativo}
                scale={ativo ? 1 : 0.35}
                // `.hero-inner{min-height:320px}`, e 260 abaixo de 1200 — a onda
                // era o que cedia altura para o vazio que sobrava sob o botão.
                height={emColunas ? 320 : 260}
              />
              <View style={[styles.heroiChips, emColunas && styles.heroiChipsSobre]}>
                <Chip
                  label={ativo ? "ritmo ao vivo" : "em repouso"}
                  variant={ativo ? "estado" : "neutro"}
                  accent={papel.accent}
                  dot
                />
                <Chip label="visualização estilizada — não é exame" variant="cautela" />
              </View>
              <Text style={[styles.heroiNota, emColunas && styles.heroiNotaSobre]}>
                A figura acima marca que a sessão está correndo; ela não desenha o seu
                sinal. As medidas são calculadas pelo WaveAI e aparecem rotuladas abaixo.
              </Text>
            </View>

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
                    /* "Encerrar e salvar" prometia a guarda antes de ela ser
                       possível: com o consentimento revogado (ADR-0026) a
                       sessão encerra e o resultado NÃO é gravado. Quem conta o
                       desfecho é o painel "Sessão guardada"/"Sessão não
                       guardada", que vem do `storage` do próprio servidor. */
                    label={
                      ativo
                        ? "Encerrar sessão"
                        : deviceConnection.supported
                          ? "Ou usar sinal simulado"
                          : "Iniciar captação simulada"
                    }
                    onPress={ativo ? parar : iniciar}
                    accent={ativo ? t.colors.warningText : papel.accent}
                  />
                </View>
              ) : null}
              <View style={styles.controleEspaco} />
              {/* Este par segue o compartilhamento (ADR-0045) porque ele fica
                  longe do interruptor, lá embaixo no painel: enquanto era fixo,
                  ligar o compartilhamento deixava um cadeado no topo dizendo
                  que ninguém mais via a sessão — a tela afirmando o contrário
                  do que acabara de acontecer. */}
              <View style={styles.controleNotaLinha}>
                <Icon
                  name={compartilhando ? "users" : "lock"}
                  size={13}
                  color={t.colors.textMuted}
                  strokeWidth={2}
                />
                <Text style={styles.controleNota}>
                  {compartilhando
                    ? "quem te acompanha pode ver esta sessão"
                    : "só você vê esta sessão"}
                </Text>
              </View>
            </View>
          </Panel>

          {!ativo && deviceConnection.supported ? (
            <Panel title="Aparelho" eyebrow="bluetooth">
              {/* Com o rádio desligado, o botão diz o que fazer AGORA. Antes
                  ele oferecia procurar, a busca falhava, e a explicação
                  aparecia fora da tela. `btLigado === false` e não `!btLigado`:
                  enquanto a resposta não chega o estado é `null`, e aí o botão
                  certo é o de procurar, não o de ligar. */}
              {btLigado === false ? (
                <Button
                  label="Ligar Bluetooth"
                  onPress={ligarBluetooth}
                  accent={aparelhoAccent.accent}
                />
              ) : (
                <Button
                  label="Procurar aparelhos pareados"
                  onPress={procurarAparelhos}
                  accent={aparelhoAccent.accent}
                />
              )}
              {erroAparelho ? <Text style={styles.erro}>{erroAparelho}</Text> : null}
              <View style={styles.listaAparelhos}>
                {aparelhos.map((d) => (
                  <ItemAparelho
                    key={d.id}
                    nome={d.name}
                    // O endereço só aparece quando o nome NÃO basta para
                    // distinguir: ele é ruído de hardware para quem lê, mas é
                    // a única saída quando dois aparelhos se chamam igual.
                    id={nomesRepetidos.has(d.name) ? d.id : undefined}
                    accent={aparelhoAccent.accent}
                    conectando={conectandoA === d.id}
                    // Enquanto um conecta, os outros não aceitam toque: duas
                    // conexões simultâneas abririam duas sessões.
                    desabilitado={conectandoA !== null && conectandoA !== d.id}
                    onPress={() => void iniciarComAparelho(d)}
                  />
                ))}
              </View>
            </Panel>
          ) : null}
        </View>

        {/* ===== trilho: contato do sensor + eSense ===== */}
        <View
          style={[
            styles.trilho,
            emColunas && styles.trilhoLateral,
            emMeio && styles.trilhoDuplo,
          ]}
        >
          <View style={emMeio ? styles.trilhoMetade : undefined}>
          <Panel
            title="Qualidade do sinal"
            headerAccessory={<InfoButton term="poor_signal" />}
            grow
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
          </View>

          {/* eSense (ADR-0034): complemento proprietário e não-validado, nunca
              fundamento. Cor neutra — nada de "bom/ruim". */}
          <View style={emMeio ? styles.trilhoMetade : undefined}>
          <Panel
            title="eSense"
            headerAccessory={<Chip label="proprietário · não validado" variant="cautela" />}
            grow
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

      {/* Gráfico ao vivo (P1-c): uma banda por vez, oscilando ao longo da
          sessão. Alimentado pelas features do servidor — sem DSP no cliente.
          **Linha inteira**: é a figura que mais ganha com largura, e era ela
          que dividia espaço enquanto o alfa esticava sozinho. */}
      {bandHistory.length > 0 ? (
        <Panel title="Ondas ao vivo" headerAccessory={<InfoButton term="live_band_trend" />}>
          <LiveBandTrend history={bandHistory} accent={papel.accent} />
        </Panel>
      ) : null}

      {/**
       * O trio do `.g-bands` — `1.35fr .9fr .9fr` no desktop, `1fr 1fr` no
       * tablet com o primeiro ocupando as duas colunas, empilhado no celular.
       *
       * Os três são condicionais (sem captação não há "Sessão guiada" nem
       * "Compartilhar"), e é por isso que a fila usa fração de largura em vez
       * de três colunas fixas: uma grade rígida deixaria buracos.
       *
       * **Encerrada, a linha muda de par**: saem a sessão guiada e o
       * compartilhar (que só valem em captação) e entra o relatório, meio a
       * meio com a composição. Sozinha, a composição esticava por uma tela de
       * 1440 para desenhar cinco barras, com o relatório repetindo o mesmo
       * desenho na linha de baixo. Só no desktop — abaixo dele o relatório
       * segue no seu lugar, mais abaixo na página.
       */}
      <View style={[styles.trio, emColunas && styles.trioLinha, emMeio && styles.trioMeio]}>
        {features?.relative_band_powers ? (
          <View
            style={
              emColunas
                ? encerrada
                  ? styles.trioMetade
                  : styles.trioLargo
                : emMeio
                  ? styles.trioCheio
                  : undefined
            }
          >
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

        {/* Protocolo guiado olhos abertos/fechados (P4-c): contraste de estado
            na mesma captação. Client-only — não persiste fase; contexto vai na
            anotação (P2). Some ao encerrar (desmonta e limpa o timer). */}
        {ativo ? (
          <View style={emColunas ? styles.trioEstreito : emMeio ? styles.trioMetade : undefined}>
            <Panel title="Sessão guiada" eyebrow="opcional" grow>
              <GuidedProtocol
                accent={papel.accent}
                onPhaseChange={aoMudarFaseProtocolo}
                embedded
              />
            </Panel>
          </View>
        ) : null}

        {/* Compartilhamento ao vivo (ADR-0045): o aceite separado que o design
            promete em quatro telas e não desenha em nenhuma. Só aparece com
            sessão em andamento — compartilhar captação encerrada não significa
            nada. A cópia diz o que a pessoa autoriza, sem prometer entrega. */}
        {ativo && sessionId ? (
          <View style={emColunas ? styles.trioEstreito : emMeio ? styles.trioMetade : undefined}>
            <Panel title="Compartilhar ao vivo" eyebrow="opcional · só esta sessão" grow>
              <Switch
                value={compartilhando}
                onChange={alternarCompartilhamento}
                label="Deixar quem me acompanha ver esta captação"
                description="Somente as medidas calculadas pelo WaveAI — nunca o sinal bruto."
              />
              <Text style={styles.notaPainel}>
                {compartilhando
                  ? "Quem você autorizou pode acompanhar esta sessão agora. Desligar interrompe na hora."
                  : "Ninguém acompanha esta captação. A escolha vale só para esta sessão — a próxima começa desligada."}
              </Text>
              {erroCompartilhar ? (
                <Text style={styles.notaPainel}>{erroCompartilhar}</Text>
              ) : null}
            </Panel>
          </View>
        ) : null}

        {encerrada && emColunas ? (
          <View style={styles.trioMetade}>{painelRelatorio}</View>
        ) : null}
      </View>

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

      {/* Relatório da sessão encerrada (#17): fecha a jornada captar → ver.
          No desktop ele já subiu para a linha do trio, ao lado da composição
          da última janela; aqui embaixo ele só aparece nas outras faixas. */}
      {encerrada ? (
        <>
          {emColunas ? null : painelRelatorio}

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
          "medidas calculadas pelo WaveAI",
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

/**
 * Um aparelho pareado na lista. Só reage ao toque: a lista aparece em captação
 * por Bluetooth, que é caminho de celular — não há ponteiro para pairar aqui.
 */
function ItemAparelho({
  nome,
  id,
  accent,
  conectando,
  desabilitado,
  onPress,
}: {
  nome: string;
  /** Endereço do aparelho — só quando o nome não distingue (ver chamador). */
  id?: string;
  accent: string;
  /** Este é o aparelho em conexão: mostra o progresso no lugar do endereço. */
  conectando?: boolean;
  /** Outro aparelho está conectando: este não aceita toque enquanto isso. */
  desabilitado?: boolean;
  onPress: () => void;
}) {
  const { estado, handlers } = useInteracao();
  const inerte = conectando || desabilitado;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inerte, busy: conectando }}
      disabled={inerte}
      onPress={onPress}
      {...handlers}
      style={[
        estado.pressed && !inerte ? { opacity: 0.85 } : null,
        // Quem não é o alvo esmaece: diz que a lista está ocupada sem precisar
        // de texto em cada linha.
        desabilitado ? { opacity: 0.45 } : null,
      ]}
    >
      {/* `contorno`: a lista é de itens escolhíveis, e sem borda fechada eles
          se fundiam num bloco só — via-se apenas a faixa colorida da esquerda,
          e não onde cada um começava. */}
      <Card
        title={nome}
        // O progresso ocupa a linha do subtítulo: é a resposta ao toque, e o
        // endereço (quando aparece) pode esperar a conexão terminar.
        subtitle={conectando ? "Conectando…" : id}
        accent={accent}
        contorno
      />
    </Pressable>
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
      color: t.colors.textSubtle,
    },
    grade: {
      gap: t.spacing.md,
    },
    gradeLinha: {
      alignItems: "stretch",
      flexDirection: "row",
    },
    colunaHeroi: {
      gap: t.spacing.md,
      // Sem isto, um filho largo (a onda) estica a coluna e estoura a linha.
      minWidth: 0,
    },
    // `flex` só quando a grade é uma LINHA. Empilhada no celular, o eixo
    // principal vira o vertical e o `flex: 1` (que o RN-web resolve como
    // `flex-basis: 0%`) reparte a ALTURA em partes iguais: sobra vazio no fim
    // da primeira coluna e a segunda transborda por cima do que vem depois.
    // Medido no perfil a 375px: 542px para cada coluna, 122px de vazio numa e
    // 121px de transbordo na outra — o "espaçamento muito grande" e a
    // "sobreposição" do pente fino eram a mesma causa.
    colunaHeroiLinha: {
      flex: 1,
    },
    trilho: {
      gap: t.spacing.md,
    },
    trilhoLateral: {
      flexGrow: 0,
      flexShrink: 0,
      width: larguras.trilhoLive,
    },
    // `@media (max-width:1199px){.g-rail{flex-direction:row} .g-rail>.card{flex:1}}`
    // — no tablet qualidade do sinal e eSense ficam lado a lado, em vez de
    // quebrarem direto para um por linha.
    trilhoDuplo: {
      flexDirection: "row",
    },
    trilhoMetade: {
      flex: 1,
      minWidth: 0,
    },

    // ---------- o trio da faixa inferior (`.g-bands`) ----------
    trio: {
      gap: 20,
    },
    trioLinha: {
      alignItems: "stretch",
      flexDirection: "row",
    },
    trioMeio: {
      alignItems: "stretch",
      flexDirection: "row",
      flexWrap: "wrap",
    },
    trioLargo: {
      flex: 1.35,
      minWidth: 0,
    },
    trioEstreito: {
      flex: 0.9,
      minWidth: 0,
    },
    /**
     * No tablet o primeiro card ocupa as duas colunas (`grid-column:1/-1`).
     *
     * Era `minWidth:"100%"`, e o cartão **saía da tela**: a célula herdava o
     * `flexShrink:0` do RN, então o `min-width` virava piso sem teto e ela
     * crescia até o `max-content` do texto longo lá dentro — 1126px medidos
     * numa faixa de 861, com 265px para fora da janela. Com `flexBasis:"100%"`
     * mais `flexShrink:1` e `minWidth:0`, a célula ocupa a linha e **encolhe**
     * com ela.
     */
    trioCheio: {
      flexBasis: "100%",
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    /**
     * As duas metades da segunda linha.
     *
     * A base é 45% e não 0: com base zero elas caberiam na *mesma* linha do
     * cartão de 100% (0 + 100 = 100) e a quebra que o `grid-column:1/-1`
     * garante nunca aconteceria — as duas ficariam com largura zero. Com 45%,
     * a linha estoura e elas descem juntas, e o `flexGrow` reparte o que sobra
     * igualmente entre as duas.
     */
    trioMetade: {
      flexBasis: "45%",
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    heroiInterno: {
      gap: t.spacing.sm,
    },
    // `.hero-inner{position:relative; flex:1; min-height:320px}` — a caixa
    // cresce e a onda, de altura fixa, fica centrada nela.
    heroiInternoLargo: {
      flex: 1,
      justifyContent: "center",
      minHeight: 320,
      position: "relative",
    },
    heroiChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    // `.hero-meta{position:absolute; left:20px; top:16px; z-index:2}`.
    heroiChipsSobre: {
      left: 20,
      position: "absolute",
      right: 20,
      top: 16,
      zIndex: 2,
    },
    heroiNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    // `.hero-note{position:absolute; right:20px; bottom:14px; text-align:right;
    // z-index:2}`. O teto de largura é nosso: a frase é bem mais longa que a do
    // mockup e sem ele atravessaria a onda de ponta a ponta.
    heroiNotaSobre: {
      bottom: 14,
      maxWidth: 460,
      position: "absolute",
      right: 20,
      textAlign: "right",
      zIndex: 2,
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
    /**
     * `.hero-controls{padding:16px 20px; border-top:1px solid}` — o rodapé do
     * cartão, e não uma linha solta no meio dele.
     *
     * `marginTop: "auto"` empurra o bloco para o fim do `Panel`: era daí que
     * vinha o "espaço vazio sem sentido abaixo do botão" do pente fino — o
     * respiro sobrava **depois** dos controles em vez de antes.
     */
    controles: {
      alignItems: "center",
      borderTopColor: t.colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      marginTop: "auto",
      paddingTop: t.spacing.md,
    },
    // Largura de conteúdo, como o `.btn` do mockup: com `flexGrow` o botão
    // atravessava o cartão inteiro.
    controlePrincipal: {
      alignSelf: "flex-start",
    },
    // O `.sp{flex:1}` do mockup: joga a nota do cadeado para a direita.
    controleEspaco: {
      flex: 1,
      minWidth: 0,
    },
    controleNotaLinha: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    controleNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      flexShrink: 1,
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
      color: t.colors.textSubtle,
    },
    notaPainel: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
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
      color: t.colors.textSubtle,
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
    // Respiro entre os aparelhos da lista: encostados, os cartões liam como um
    // bloco só. O `gap` do `Panel` cuida do espaço até o botão acima.
    listaAparelhos: {
      gap: t.spacing.sm,
    },
    rastro: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      marginTop: t.spacing.sm,
    },
  });
