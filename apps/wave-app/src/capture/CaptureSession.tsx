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
 * parte 2 da mesma ADR.
 *
 * O serviço em primeiro plano (Android) é **necessário e não suficiente** para a
 * parte 2, e isso custou uma medição para descobrir: com o serviço de pé, o
 * processo, o rádio e o socket sobreviveram à tela apagada — mas o **envio**
 * parou, porque dependia de `setInterval`, e timer de RN no Android não dispara
 * com a activity pausada. O buffer enchia sem ninguém drenar e, ao voltar, ia
 * inteiro num frame só; passados 8 s (4096 amostras ÷ 512 Hz) o servidor
 * recusava com "bloco grande demais" e derrubava a sessão. Daí as duas regras
 * abaixo: **quem dispara o envio é a chegada da amostra, não o relógio**, e
 * **nenhum frame passa de `BLOCO` amostras**.
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
  pedirPermissaoDeAviso,
} from "../../modules/captacao-foreground";
import { setLiveSharing } from "../api/liveWatch";
import type { PhaseComparison } from "../api/results";
import {
  StreamSession,
  type LiveEsense,
  type LiveFeatures,
  type SessionClosed,
  type StreamPhase,
} from "../api/stream";
import { deviceConnection } from "../device/connection";
import type { DeviceInfo, Esense } from "../device/DeviceConnection";
import { mensagemBluetooth } from "../device/mensagens";
import { SignalSimulator } from "../mocks/signalSimulator";

export const SAMPLE_RATE = 512;
/**
 * Tamanho do bloco enviado ao servidor — e **teto de um frame**.
 *
 * A 512 Hz, 256 amostras fecham a cada 500 ms, que é a cadência de sempre. O
 * papel novo é ser limite: o gateway recusa blocos acima de
 * `stream_max_block_samples` (4096) fechando a conexão, então fatiar sempre em
 * 256 deixa 16× de folga. Deliberadamente **não** replicamos o 4096 aqui — duas
 * constantes em serviços diferentes saem de sincronia sem ninguém notar.
 */
const BLOCO = 256;
/** Rede de arrasto: leva o resto (< `BLOCO`) que o envio por volume não fecha. */
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
  /**
   * O aviso de captação **vai aparecer** na barra do sistema?
   *
   * `null` = não se aplica (plataforma sem serviço em primeiro plano), e aí a
   * tela não fala do assunto. `false` só acontece quando a pessoa recusou a
   * permissão: a captação corre igual, mas em silêncio — e dizer isso é
   * obrigação, porque a ADR-0052 escolheu a notificação como o preço visível de
   * captar fora da tela (ADR-0027).
   */
  avisoVisivel: boolean | null;

  iniciar: () => Promise<void>;
  iniciarComAparelho: (device: DeviceInfo) => Promise<void>;
  parar: () => void;
  alternarCompartilhamento: (proximo: boolean) => Promise<void>;
  /** Fase do protocolo guiado — só o simulador reage (ver abaixo). */
  aoMudarFaseProtocolo: (fase: "aberto" | "fechado" | null) => void;
  /**
   * O roteiro terminou: pede o contraste ao servidor **sem encerrar a sessão**
   * (emenda à ADR-0053). `incompleto` diz se ele foi pulado ou interrompido —
   * isso o cliente sabe sozinho, e o servidor não tem como saber.
   */
  concluirProtocolo: (incompleto: boolean) => void;
  /** Contraste devolvido pelo servidor ao fim do roteiro, ou `null`. */
  contraste: PhaseComparison | null;
  /** O roteiro foi pulado ou interrompido nesta sessão? */
  roteiroIncompleto: boolean;
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
  const [avisoVisivel, setAvisoVisivel] = useState<boolean | null>(null);
  const [contraste, setContraste] = useState<PhaseComparison | null>(null);
  const [roteiroIncompleto, setRoteiroIncompleto] = useState(false);

  const sessao = useRef<StreamSession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cronometro = useRef<ReturnType<typeof setInterval> | null>(null);
  const simuladorRef = useRef<SignalSimulator | null>(null);
  const pendentes = useRef<number[]>([]);
  const esensePendente = useRef<Esense>({});
  /**
   * Instante de início, em ms. O cronômetro **lê o relógio** em vez de contar
   * tiques: um `setDuracao(s => s + 1)` só avança quando o timer dispara, e com
   * a tela apagada ele não dispara — a duração exibida viraria "segundos com a
   * tela acesa", que não é o que a tela diz estar mostrando (ADR-0027). Ref, e
   * não o estado `inicio`, porque o callback do intervalo prenderia o valor da
   * renderização em que foi criado.
   */
  const comecoMs = useRef(0);
  /** Fase vigente do protocolo guiado, ou `null` fora dele (ADR-0053). */
  const faseAtual = useRef<StreamPhase | null>(null);
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
    // Sem isto, uma sessão nova nasceria marcada com a fase em que a anterior
    // parou — e o contraste seria calculado sobre sinal que ninguém rotulou.
    faseAtual.current = null;
    simuladorRef.current = null;
    usandoAparelhoRef.current = false;
    setAtivo(false);
    setUsandoAparelho(false);
    setConectandoA(null);
    // Sem captação não há aviso a prometer nem a desmentir.
    setAvisoVisivel(null);
  }, []);

  /**
   * Sobe o serviço e resolve, em paralelo, a permissão do aviso.
   *
   * **O serviço sobe primeiro e sem esperar.** Ele é o que protege a captação;
   * segurá-lo pelo tempo de um diálogo do sistema deixaria a sessão exposta
   * justo no instante em que a pessoa sai da tela — que é quando ela toca no
   * diálogo. A permissão é sobre *ver* a captação, não sobre mantê-la.
   *
   * Concedida depois, o serviço é reiniciado para repostar a notificação.
   * `iniciar()` é idempotente (não cria um segundo serviço), e isto é
   * conservador de propósito: **não medi** se o Android passa a exibir
   * retroativamente uma notificação que já estava postada sob
   * `importance=NONE`.
   */
  const subirServico = useCallback(() => {
    iniciarServicoCaptacao();
    void pedirPermissaoDeAviso().then((visivel) => {
      setAvisoVisivel(visivel);
      if (visivel) iniciarServicoCaptacao();
    });
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
    comecoMs.current = Date.now();
    // Veredito é por sessão: sem isto, o resultado de uma captação apareceria
    // no relatório da seguinte, que nem rodou o roteiro.
    setContraste(null);
    setRoteiroIncompleto(false);
  }, []);

  const iniciarCronometro = useCallback(() => {
    // Ao voltar do segundo plano o intervalo volta a disparar e o número se
    // corrige sozinho no primeiro tique, porque vem de uma subtração de datas.
    cronometro.current = setInterval(() => {
      setDuracao(Math.floor((Date.now() - comecoMs.current) / 1000));
    }, 1000);
  }, []);

  /**
   * Drena o buffer em frames de no máximo `BLOCO` amostras.
   *
   * `parcial` distingue os dois gatilhos: a **chegada de amostra** só fecha
   * bloco cheio (é o caminho que funciona com a tela apagada), e o **intervalo**
   * varre o resto para o fim da captação não ficar preso no buffer. O eSense
   * pega carona no primeiro frame e é limpo, para não repetir valor velho nos
   * seguintes (ADR-0034).
   */
  const drenarPendentes = useCallback(
    (stream: StreamSession, parcial: boolean) => {
      const minimo = parcial ? 1 : BLOCO;
      while (pendentes.current.length >= minimo) {
        const bloco = pendentes.current.splice(0, BLOCO);
        const esenseAgora = esensePendente.current;
        esensePendente.current = {};
        // A fase é lida AGORA, no envio, e não guardada junto da amostra: o
        // bloco tem 500 ms e a fase dura 60 s, então o pior erro possível é meio
        // segundo de sinal na fronteira entre as duas — irrelevante para épocas
        // de 4 s, e muito mais barato que marcar amostra a amostra.
        stream.sendSamples(bloco, esenseAgora, faseAtual.current ?? undefined);
      }
    },
    [],
  );

  const novoStream = useCallback(
    () =>
      new StreamSession({
        onSession: aoAbrirSessao,
        onFeatures: aoReceberFeatures,
        onEsense: setEsense,
        onContrast: setContraste,
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
    subirServico();
    iniciarCronometro();

    // O simulador emite eSense sintético para exercitar o caminho sem hardware
    // (o selo "simulado" da tela já avisa que nada aqui é medição de ninguém).
    const simulador = new SignalSimulator(SAMPLE_RATE);
    simuladorRef.current = simulador;
    timer.current = setInterval(() => {
      stream.sendSamples(
        simulador.nextBlock(BLOCO),
        simulador.nextEsense(),
        faseAtual.current ?? undefined,
      );
      setPoorSignal(simulador.nextPoorSignal());
    }, INTERVALO_MS);
  }, [
    abrindoSessao,
    ativo,
    limparParaNovaSessao,
    novoStream,
    iniciarCronometro,
    subirServico,
  ]);

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
          // **O envio nasce aqui, não no relógio.** Este callback vem de evento
          // do módulo nativo, que segue sendo entregue com a activity pausada —
          // ao contrário do `setInterval`, que para. Fechou 256 amostras, vai.
          onRawSample: ({ amplitude }) => {
            pendentes.current.push(amplitude);
            drenarPendentes(stream, false);
          },
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
      subirServico();
      iniciarCronometro();

      // Só o resto: o bloco cheio já saiu no `onRawSample`. Este intervalo
      // existe para o pedaço final (< 256) não ficar parado no buffer quando o
      // aparelho para de emitir — e, por ser timer, é o único trecho daqui que
      // não roda com a tela apagada. Tudo bem: em background não sobra resto,
      // porque o rádio segue enchendo até fechar bloco.
      timer.current = setInterval(() => {
        drenarPendentes(stream, true);
      }, INTERVALO_MS);
    },
    [
      conectandoA,
      ativo,
      limparParaNovaSessao,
      novoStream,
      iniciarCronometro,
      drenarPendentes,
      subirServico,
    ],
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
   * Fase do protocolo guiado. **Agora ela chega ao servidor** (ADR-0053): fica
   * num ref, e cada bloco enviado leva a fase vigente no instante do envio.
   *
   * Ref, e não estado: quem lê é o envio, que roda dentro de `onRawSample` e de
   * um intervalo — os dois prenderiam o valor da renderização em que foram
   * criados. E a marcação precisa acompanhar o sinal, não o ciclo de render.
   *
   * O efeito no simulador continua: elevar o alfa de "olhos fechados" é o que
   * torna o contraste visível sem aparelho.
   */
  /**
   * O roteiro acabou. Pede o contraste e guarda se ele foi abreviado.
   *
   * A marca de "incompleto" mora aqui, e não na tela do protocolo, porque
   * precisa **sobreviver ao fim do roteiro**: o cartão do encerramento aparece
   * bem depois, e é ele que tem de continuar dizendo que a verificação não vale.
   */
  const concluirProtocolo = useCallback((incompleto: boolean) => {
    setRoteiroIncompleto(incompleto);
    sessao.current?.protocolDone();
  }, []);

  const aoMudarFaseProtocolo = useCallback((fase: "aberto" | "fechado" | null) => {
    faseAtual.current =
      fase === "fechado" ? "eyes_closed" : fase === "aberto" ? "eyes_open" : null;
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
      avisoVisivel,
      iniciar,
      iniciarComAparelho,
      parar,
      alternarCompartilhamento,
      aoMudarFaseProtocolo,
      concluirProtocolo,
      contraste,
      roteiroIncompleto,
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
      avisoVisivel,
      iniciar,
      iniciarComAparelho,
      parar,
      alternarCompartilhamento,
      aoMudarFaseProtocolo,
      concluirProtocolo,
      contraste,
      roteiroIncompleto,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
