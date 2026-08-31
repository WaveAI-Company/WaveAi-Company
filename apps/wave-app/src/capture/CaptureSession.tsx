/**
 * Sessão de captação — **estado da aplicação, não da tela** (ADR-0052, parte 1).
 *
 * Antes, tudo isto vivia dentro de `app/patient/live.tsx`, e a tela tinha um
 * `useEffect(() => () => descartar(), [])`: sair dela **encerrava a captação**.
 * Trocar de aba matava socket, cronômetro e stream, e a pessoa voltava para uma
 * sessão que não existia mais.
 *
 * Aqui a sessão vive acima das rotas. A tela passa a **ler e comandar** — não a
 * possuir. Isso resolve navegar dentro do app; sobreviver à **tela apagada** é a
 * parte 2 da mesma ADR e exige serviço em primeiro plano no Android.
 *
 * O que **não** mudou de propósito: nenhuma conta é feita aqui. As medidas
 * continuam vindo do servidor (ADR-0025) e o eSense continua repassado como veio
 * do aparelho, rotulado pela UI (ADR-0034).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  iniciarServicoCaptacao,
  pararServicoCaptacao,
} from "../../modules/captacao-foreground";
import { setLiveSharing } from "../api/liveWatch";
import {
  StreamSession,
  type LiveEsense,
  type LiveFeatures,
  type SessionClosed,
} from "../api/stream";
import { deviceConnection } from "../device/connection";
import type { DeviceInfo, Esense } from "../device/DeviceConnection";
import { mensagemBluetooth } from "../device/mensagens";
import { SignalSimulator } from "../mocks/signalSimulator";

export const SAMPLE_RATE = 512;
/** Cadência de envio: blocos de 256 amostras a cada 500 ms (≈ tempo real). */
const BLOCO = 256;
const INTERVALO_MS = 500;
/** Janelas mantidas no gráfico ao vivo (janela ~2 s → ~80 s de histórico). */
const MAX_PONTOS = 40;

type Sessao = {
  ativo: boolean;
  usandoAparelho: boolean;
  sessionId: string | null;
  features: LiveFeatures | null;
  esense: LiveEsense | null;
  janelas: number;
  bandHistory: Array<Record<string, number>>;
  poorSignal: number | null;
  duracao: number;
  inicio: Date | null;
  encerrada: SessionClosed | null;
  encerrando: boolean;
  compartilhando: boolean;
  erroCompartilhar: string | null;
  erro: string | null;
  /** Id do aparelho em conexão, ou `null` — a lista mostra o progresso nele. */
  conectandoA: string | null;
  /** Sessão simulada abrindo: impede dois toques abrirem duas. */
  abrindoSessao: boolean;

  iniciar: () => Promise<void>;
  iniciarComAparelho: (device: DeviceInfo) => Promise<void>;
  parar: () => void;
  alternarCompartilhamento: (proximo: boolean) => Promise<void>;
  /** Fase do protocolo guiado — só o simulador reage (ver abaixo). */
  aoMudarFaseProtocolo: (fase: "aberto" | "fechado" | null) => void;
};

const Contexto = createContext<Sessao | null>(null);

export function useCaptureSession(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useCaptureSession fora do CaptureSessionProvider");
  return s;
}

export function CaptureSessionProvider({ children }: { children: ReactNode }) {
  const [ativo, setAtivo] = useState(false);
  const [usandoAparelho, setUsandoAparelho] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [features, setFeatures] = useState<LiveFeatures | null>(null);
  const [esense, setEsense] = useState<LiveEsense | null>(null);
  const [janelas, setJanelas] = useState(0);
  const [bandHistory, setBandHistory] = useState<Array<Record<string, number>>>([]);
  const [poorSignal, setPoorSignal] = useState<number | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [inicio, setInicio] = useState<Date | null>(null);
  const [encerrada, setEncerrada] = useState<SessionClosed | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [erroCompartilhar, setErroCompartilhar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conectandoA, setConectandoA] = useState<string | null>(null);
  const [abrindoSessao, setAbrindoSessao] = useState(false);

  const sessao = useRef<StreamSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cronometro = useRef<ReturnType<typeof setInterval> | null>(null);
  const simuladorRef = useRef<SignalSimulator | null>(null);
  const pendentes = useRef<number[]>([]);
  const esensePendente = useRef<Esense>({});
  const compartilhamentoEmVoo = useRef(false);
  const intencaoCompartilhar = useRef<boolean | null>(null);
  /**
   * `usandoAparelho` também como ref: `encerrarCaptacao` precisa saber se há
   * rádio a desconectar, e lê-lo do estado prenderia a função a um valor velho
   * quando chamada de dentro de um handler.
   */
  const usandoAparelhoRef = useRef(false);

  const encerrarCaptacao = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (cronometro.current) clearInterval(cronometro.current);
    cronometro.current = null;
    // O serviço cai junto com a captação, sempre — e por isso mora aqui, no
    // ponto por onde os dois caminhos de encerramento passam. Deixá-lo de pé
    // sem sessão seria uma notificação afirmando algo que não acontece mais
    // (ADR-0027).
    pararServicoCaptacao();
    if (usandoAparelhoRef.current) void deviceConnection.disconnect();
    pendentes.current = [];
    esensePendente.current = {};
    simuladorRef.current = null;
    usandoAparelhoRef.current = false;
    setAtivo(false);
    setUsandoAparelho(false);
    setConectandoA(null);
  }, []);

  /**
   * Para a captação e **aguarda** o relatório da sessão.
   *
   * O socket NÃO é fechado aqui: fechá-lo logo após o `stop` descartaria a
   * resposta `closed`, que é justamente onde vem o relatório. Quem fecha é o
   * handler `onClosed`.
   */
  const parar = useCallback(() => {
    encerrarCaptacao();
    if (sessao.current) {
      setEncerrando(true);
      sessao.current.stop();
    }
  }, [encerrarCaptacao]);

  /** Handler comum: chega o relatório, aí sim o socket pode fechar. */
  const aoEncerrar = useCallback((fim: SessionClosed) => {
    setEncerrada(fim);
    setEncerrando(false);
    sessao.current?.close();
    sessao.current = null;
  }, []);

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
   * ainda está viva: quem iniciasse ali ganhava um `sessao.current` novo por
   * cima do antigo, e o `closed` atrasado da velha caía no `aoEncerrar`, que
   * fecha **a sessão corrente** — matando a captação recém-iniciada.
   */
  const limparParaNovaSessao = useCallback(() => {
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
  }, []);

  const iniciarCronometro = useCallback(() => {
    cronometro.current = setInterval(() => setDuracao((s) => s + 1), 1000);
  }, []);

  const novoStream = useCallback(
    () =>
      new StreamSession({
        onSession: aoAbrirSessao,
        onFeatures: aoReceberFeatures,
        onEsense: setEsense,
        onClosed: aoEncerrar,
        onError: (detalhe) => {
          setErro(detalhe);
          parar();
        },
      }),
    [aoAbrirSessao, aoReceberFeatures, aoEncerrar, parar],
  );

  const iniciar = useCallback(async () => {
    if (abrindoSessao || ativo) return;
    setAbrindoSessao(true);
    limparParaNovaSessao();

    const stream = novoStream();
    try {
      await stream.connect("simulador", SAMPLE_RATE);
    } catch {
      setErro("Não foi possível iniciar a captação simulada.");
      setAbrindoSessao(false);
      return;
    }

    sessao.current = stream;
    setAtivo(true);
    setAbrindoSessao(false);
    // Só depois de a sessão existir: subir o serviço antes deixaria a
    // notificação no ar mesmo se o `connect` acima tivesse falhado.
    iniciarServicoCaptacao();
    iniciarCronometro();

    // O simulador emite eSense sintético para exercitar o caminho sem hardware
    // (o selo "simulado" da tela já avisa que nada aqui é medição de ninguém).
    const simulador = new SignalSimulator(SAMPLE_RATE);
    simuladorRef.current = simulador;
    timer.current = setInterval(() => {
      stream.sendSamples(simulador.nextBlock(BLOCO), simulador.nextEsense());
      setPoorSignal(simulador.nextPoorSignal());
    }, INTERVALO_MS);
  }, [abrindoSessao, ativo, limparParaNovaSessao, novoStream, iniciarCronometro]);

  const iniciarComAparelho = useCallback(
    async (device: DeviceInfo) => {
      // Um toque por vez. A guarda de verdade está no módulo de conexão
      // (`DeviceBusyError`); esta evita o caminho chegar até lá à toa.
      if (conectandoA || ativo) return;
      setConectandoA(device.id);
      limparParaNovaSessao();
      esensePendente.current = {};

      const stream = novoStream();
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
            if (status === "error") setErro(mensagemBluetooth(detalhe));
          },
        });
      } catch (e) {
        setErro(mensagemBluetooth(e));
        stream.close();
        setConectandoA(null);
        return;
      }

      sessao.current = stream;
      usandoAparelhoRef.current = true;
      setAtivo(true);
      setUsandoAparelho(true);
      setConectandoA(null);
      iniciarServicoCaptacao();
      iniciarCronometro();

      // Envia o que chegou do aparelho na cadência do stream. O eSense pendente
      // pega carona e é consumido (limpo) para não reenviar valor velho.
      timer.current = setInterval(() => {
        if (pendentes.current.length === 0) return;
        const esenseAgora = esensePendente.current;
        esensePendente.current = {};
        stream.sendSamples(pendentes.current.splice(0), esenseAgora);
      }, INTERVALO_MS);
    },
    [conectandoA, ativo, limparParaNovaSessao, novoStream, iniciarCronometro],
  );

  /**
   * Compartilhamento com **convergência para a última intenção**.
   *
   * Sem isto, tocar rápido disparava N requisições concorrentes e vencia a
   * última a RESPONDER — que não é a última tocada. Não usamos `disabled`
   * porque desligar é o caso urgente (ADR-0045, "corta na hora").
   */
  const alternarCompartilhamento = useCallback(
    async (proximo: boolean) => {
      if (!sessionId) return;
      setCompartilhando(proximo);
      setErroCompartilhar(null);

      intencaoCompartilhar.current = proximo;
      if (compartilhamentoEmVoo.current) return;
      compartilhamentoEmVoo.current = true;

      try {
        while (intencaoCompartilhar.current !== null) {
          const alvo = intencaoCompartilhar.current;
          intencaoCompartilhar.current = null;
          const confirmado = await setLiveSharing(sessionId, alvo);
          if (intencaoCompartilhar.current === null) setCompartilhando(confirmado);
        }
      } catch {
        setCompartilhando(!proximo);
        setErroCompartilhar(
          "Não foi possível mudar o compartilhamento agora. Tente de novo.",
        );
      } finally {
        compartilhamentoEmVoo.current = false;
        intencaoCompartilhar.current = null;
      }
    },
    [sessionId],
  );

  /**
   * Fase do protocolo guiado. No simulador, eleva o alfa de "olhos fechados"
   * para o contraste ficar visível; em aparelho real é só a guia — a fase não
   * chega ao servidor (ver a fatia C da ADR-0052, ainda por decidir).
   */
  const aoMudarFaseProtocolo = useCallback((fase: "aberto" | "fechado" | null) => {
    simuladorRef.current?.setAlphaAmplitude(fase === "fechado" ? 45 : 20);
  }, []);

  const valor = useMemo<Sessao>(
    () => ({
      ativo,
      usandoAparelho,
      sessionId,
      features,
      esense,
      janelas,
      bandHistory,
      poorSignal,
      duracao,
      inicio,
      encerrada,
      encerrando,
      compartilhando,
      erroCompartilhar,
      erro,
      conectandoA,
      abrindoSessao,
      iniciar,
      iniciarComAparelho,
      parar,
      alternarCompartilhamento,
      aoMudarFaseProtocolo,
    }),
    [
      ativo,
      usandoAparelho,
      sessionId,
      features,
      esense,
      janelas,
      bandHistory,
      poorSignal,
      duracao,
      inicio,
      encerrada,
      encerrando,
      compartilhando,
      erroCompartilhar,
      erro,
      conectandoA,
      abrindoSessao,
      iniciar,
      iniciarComAparelho,
      parar,
      alternarCompartilhamento,
      aoMudarFaseProtocolo,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
