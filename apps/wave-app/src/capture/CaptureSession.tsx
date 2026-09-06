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
import type { DeviceHandlers, DeviceInfo, Esense } from "../device/DeviceConnection";
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

/**
 * Teto da reconexão automática (ADR-0055, decisão 1).
 *
 * **Por que existe um teto, e não reconexão sem limite:** reconectar costura um
 * buraco invisível no sinal. As amostras de antes e depois são concatenadas como
 * se fossem contínuas, e o servidor não tem como saber. Um tropeço de 2–3 s (a
 * pessoa virou a cabeça, o rádio oscilou) não deve custar uma sessão de dez
 * minutos; um buraco de 40 s não pode ser costurado em silêncio.
 */
const TETO_RECONEXAO_MS = 10_000;
/**
 * Espera entre tentativas dentro do teto. **Calibragem, não decisão de ADR** — a
 * ADR-0055 fixou só o teto. Dá ~5 tentativas, e a primeira sai na hora.
 */
const INTERVALO_RECONEXAO_MS = 2_000;

/**
 * O que a tela diz quando a queda venceu o teto.
 *
 * Fala do que aconteceu **e** do que foi feito com o sinal: encerrar sem dizer
 * que o captado foi aproveitado deixaria a pessoa supondo que perdeu tudo
 * (ADR-0027 — a tela não afirma o que não é verdade, e omitir o desfecho é
 * deixá-la adivinhar).
 */
const MOTIVO_QUEDA =
  "A conexão com o aparelho caiu e não voltou. A sessão foi encerrada com o sinal que já havia sido captado.";

/**
 * Quanto se espera pelo relatório depois do `stop`, antes de a tela desistir.
 *
 * **30 s e não 15** porque o servidor de análise pode estar escalado a zero em
 * produção: o cold start medido é de ~21–26 s, e um teto curto acusaria de
 * silêncio uma resposta que estava a caminho. Aqui errar para o lado da espera
 * é barato — errar para o outro faz a tela chamar de falha o funcionamento
 * normal.
 *
 * Desistir é só da **espera**: o `closed` atrasado ainda é aceito e mostrado.
 */
const TETO_RELATORIO_MS = 30_000;

/** `setTimeout` como promessa, para a reconexão ser um laço e não uma recursão. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  /**
   * A conexão com o aparelho caiu e o app está tentando trazê-la de volta
   * (ADR-0055). Enquanto isto for `true`, **não está entrando sinal** — e a tela
   * não pode continuar dizendo "AO VIVO".
   */
  reconectando: boolean;
  /**
   * Por que a sessão terminou, quando não foi a pessoa que encerrou. `null` no
   * encerramento comum: aí o motivo é óbvio e a tela não precisa explicar nada.
   */
  motivoDoFim: string | null;
  /**
   * O `stop` foi enviado (ou a sessão acabou) e o relatório **não chegou**: o
   * canal caiu, ou a resposta demorou mais que o teto.
   *
   * Existe porque a tela dizia "Calculando o relatório sobre a sessão inteira"
   * enquanto isso — uma afirmação sobre trabalho que ninguém está fazendo
   * (ADR-0027). Volta a `false` se o `closed` chegar atrasado.
   */
  relatorioNaoChegou: boolean;
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
  const [reconectando, setReconectando] = useState(false);
  const [motivoDoFim, setMotivoDoFim] = useState<string | null>(null);
  const [relatorioNaoChegou, setRelatorioNaoChegou] = useState(false);

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

  /**
   * Aparelho e handlers da captação em curso — o que a reconexão precisa para
   * refazer exatamente a mesma ligação (ADR-0055).
   *
   * Os handlers guardam a closure sobre o `stream` desta sessão, e é isso que se
   * quer: reconectar **continua a sessão**, não abre outra. Abrir uma sessão
   * nova ao reconectar foi considerado e recusado na ADR — fragmentaria o
   * histórico e quebraria o roteiro guiado no meio.
   */
  const aparelhoAtual = useRef<DeviceInfo | null>(null);
  const handlersAparelho = useRef<DeviceHandlers | null>(null);
  /**
   * Token de geração da captação — a guarda de reentrância desta fatia.
   *
   * É a mesma classe de problema da PR #219: a reconexão é assíncrona e leva
   * segundos, e nesse meio-tempo a pessoa pode encerrar, ou começar outra
   * sessão. O laço confere o token depois de **cada** `await`; encerrar
   * incrementa o número e, com isso, invalida toda tentativa em voo — inclusive
   * uma que tenha acabado de conectar com sucesso (essa é desfeita na hora).
   */
  const geracao = useRef(0);
  /**
   * Espelho de `reconectando` em ref: o evento de queda chega por callback do
   * módulo nativo, que leria o estado da renderização em que foi criado. Sem
   * isto, dois eventos seguidos abririam dois laços de reconexão.
   */
  const reconectandoRef = useRef(false);
  /**
   * Espelhos de `encerrando` e `ativo` em ref. Quem os lê são handlers do
   * socket e um `setTimeout`, que prenderiam o valor da renderização em que
   * foram criados — o mesmo motivo de `usandoAparelhoRef`.
   */
  const encerrandoRef = useRef(false);
  const ativoRef = useRef(false);
  /** Teto da espera pelo relatório; cancelado quando o `closed` chega. */
  const esperaDoRelatorio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pararDeReconectar = useCallback(() => {
    reconectandoRef.current = false;
    setReconectando(false);
  }, []);

  const encerrarCaptacao = useCallback(() => {
    // Primeiro de tudo, e de forma SÍNCRONA: invalida qualquer reconexão em voo
    // antes que ela tenha chance de ressuscitar a captação que está acabando.
    geracao.current += 1;
    pararDeReconectar();
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
    ativoRef.current = false;
    setAtivo(false);
    setUsandoAparelho(false);
    setConectandoA(null);
    // Sem captação não há aviso a prometer nem a desmentir.
    setAvisoVisivel(null);
  }, [pararDeReconectar]);

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
   * Desiste de esperar o relatório — sem desistir de recebê-lo.
   *
   * Só mexe no que a tela mostra: se o `closed` chegar atrasado, `aoEncerrar`
   * roda normalmente e o relatório aparece. O que isto impede é a tela ficar
   * afirmando que está calculando algo que ninguém está calculando.
   */
  const desistirDeEsperarRelatorio = useCallback(() => {
    if (esperaDoRelatorio.current) clearTimeout(esperaDoRelatorio.current);
    esperaDoRelatorio.current = null;
    if (!encerrandoRef.current) return;
    encerrandoRef.current = false;
    setEncerrando(false);
    setRelatorioNaoChegou(true);
  }, []);

  /**
   * Para a captação e **aguarda** o relatório da sessão.
   *
   * O socket NÃO é fechado aqui: fechá-lo logo após o `stop` descartaria a
   * resposta `closed`, que é justamente onde vem o relatório. Quem fecha é o
   * handler `onClosed`.
   *
   * A espera é **limitada**. `stop()` não faz nada quando o socket já morreu (e
   * morrer sem avisar era o caso comum: o gateway manda `error` e fecha), então
   * sem teto o "Encerrando a sessão…" ficava na tela para sempre.
   */
  const parar = useCallback(() => {
    encerrarCaptacao();
    if (sessao.current) {
      encerrandoRef.current = true;
      setEncerrando(true);
      sessao.current.stop();
      if (esperaDoRelatorio.current) clearTimeout(esperaDoRelatorio.current);
      esperaDoRelatorio.current = setTimeout(
        desistirDeEsperarRelatorio,
        TETO_RELATORIO_MS,
      );
    }
  }, [encerrarCaptacao, desistirDeEsperarRelatorio]);

  /**
   * O canal caiu sem `closed` (novo `onDisconnected` do `StreamSession`).
   *
   * Não espera o teto: já se sabe que a resposta não vem, e fingir que ainda
   * pode vir é mentir por mais 30 s. Se havia captação em curso, ela também
   * acaba aqui — o socket era o único caminho do sinal.
   */
  const aoCairOCanal = useCallback((qual: StreamSession) => {
    // **Só o socket da sessão corrente fala por ela.** Um stream abandonado (um
    // `connect` que falhou, por exemplo) fecha depois, e sem esta conferência o
    // `onclose` atrasado dele mataria a captação que acabou de começar — a mesma
    // armadilha descrita em `limparParaNovaSessao`.
    if (sessao.current !== qual) return;
    sessao.current = null;
    // Nada em curso: um socket fechando sem sessão não é notícia para a tela.
    if (!encerrandoRef.current && !ativoRef.current) return;
    encerrarCaptacao();
    if (esperaDoRelatorio.current) clearTimeout(esperaDoRelatorio.current);
    esperaDoRelatorio.current = null;
    // Vale igual para quem ainda estava captando: ali a espera nem chegou a
    // começar, e o desfecho é o mesmo — sessão acabada, relatório sem chegar.
    encerrandoRef.current = false;
    setEncerrando(false);
    setRelatorioNaoChegou(true);
  }, [encerrarCaptacao]);

  /**
   * A queda venceu o teto: encerra **pelo caminho normal** (ADR-0055).
   *
   * `parar()` e não algo especial, de propósito: é o `stop` que traz o relatório
   * do que foi captado até a queda. O caminho do `abortar()` no servidor (que
   * também gera `Result` desde a ADR-0055) é a rede de segurança para quando nem
   * o WebSocket sobreviveu — aqui, com o socket de pé, dá para encerrar direito
   * e mostrar o relatório na tela.
   */
  const encerrarPorQueda = useCallback(() => {
    setMotivoDoFim(MOTIVO_QUEDA);
    parar();
  }, [parar]);

  /**
   * Tenta trazer a conexão de volta até o teto de 10 s (ADR-0055, decisão 1).
   *
   * Laço, e não recursão em `setTimeout`, para o cancelamento ser uma conferência
   * de token depois de cada `await` — e não uma coleção de temporizadores para
   * limpar. `minhaGeracao` é o token: se ele mudou, esta tentativa pertence a uma
   * captação que já acabou e tudo o que ela conseguir tem de ser desfeito.
   *
   * ⚠️ **Com a tela apagada só a primeira tentativa acontece.** Ela é disparada
   * pelo evento de queda, que o módulo nativo entrega mesmo com a activity
   * pausada — mas a espera entre as tentativas seguintes é `setTimeout`, e timer
   * de RN no Android não dispara nesse estado (é a mesma medição da ADR-0052 que
   * fez o envio deixar de depender do relógio). Na prática: falhou a primeira, a
   * sessão fica parada até a tela voltar, e aí o teto já venceu e ela encerra com
   * a explicação. Corrigir isso exigiria a contagem dentro do serviço em primeiro
   * plano, em Kotlin — fora do escopo desta fatia.
   */
  const reconectar = useCallback(
    async (minhaGeracao: number) => {
      const device = aparelhoAtual.current;
      const handlers = handlersAparelho.current;
      if (!device || !handlers) return;
      const inicio = Date.now();

      while (geracao.current === minhaGeracao) {
        // Solta o rádio antes de cada tentativa: a trava de `connect`
        // (`DeviceBusyError`) recusa enquanto houver conexão de pé, e uma
        // tentativa que falhou pela metade pode ter deixado uma.
        await deviceConnection.disconnect().catch(() => undefined);
        if (geracao.current !== minhaGeracao) return;

        let conectou = false;
        try {
          await deviceConnection.connect(device.id, handlers);
          conectou = true;
        } catch {
          // Falhar é o caso esperado enquanto o rádio não volta; quem decide o
          // desfecho é o teto, logo abaixo.
        }

        if (geracao.current !== minhaGeracao) {
          // A pessoa encerrou enquanto esta tentativa estava em voo. Se ela
          // chegou a conectar, a conexão é órfã — ninguém mais a fecharia.
          if (conectou) void deviceConnection.disconnect();
          return;
        }
        if (conectou) {
          pararDeReconectar();
          setErro(null);
          return;
        }
        if (Date.now() - inicio >= TETO_RECONEXAO_MS) {
          pararDeReconectar();
          encerrarPorQueda();
          return;
        }
        await esperar(INTERVALO_RECONEXAO_MS);
      }
    },
    [pararDeReconectar, encerrarPorQueda],
  );

  /**
   * O aparelho caiu. Antes da ADR-0055 isto era um `setErro(...)` e nada mais: a
   * sessão seguia ativa, o cronômetro contava e a notificação dizia "Captação em
   * andamento" — duas afirmações falsas ao mesmo tempo (ADR-0027).
   */
  const aoCairAConexao = useCallback(() => {
    if (!usandoAparelhoRef.current || reconectandoRef.current) return;
    // Queda **dentro** do roteiro invalida a verificação (ADR-0055, decisão 2):
    // houve buraco dentro de uma fase, e isso não é medição válida. Vale mesmo
    // que a reconexão dê certo em dois segundos — o buraco existiu, e "não foi
    // medido direito" não é a mesma frase que "foi medido e não deu".
    if (faseAtual.current !== null) setRoteiroIncompleto(true);
    reconectandoRef.current = true;
    setReconectando(true);
    void reconectar(geracao.current);
  }, [reconectar]);

  /** Handler comum: chega o relatório, aí sim o socket pode fechar. */
  const aoEncerrar = useCallback((fim: SessionClosed) => {
    if (esperaDoRelatorio.current) clearTimeout(esperaDoRelatorio.current);
    esperaDoRelatorio.current = null;
    encerrandoRef.current = false;
    setEncerrada(fim);
    setEncerrando(false);
    // Chegou atrasado, depois de a tela ter desistido: o aviso sai, porque
    // agora há relatório de verdade para mostrar.
    setRelatorioNaoChegou(false);
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
    if (esperaDoRelatorio.current) clearTimeout(esperaDoRelatorio.current);
    esperaDoRelatorio.current = null;
    encerrandoRef.current = false;
    setEncerrando(false);
    setRelatorioNaoChegou(false);
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
    // O motivo é da sessão que acabou; deixá-lo de pé faria a captação nova
    // nascer explicando o fim da anterior.
    setMotivoDoFim(null);
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

  const novoStream = useCallback(() => {
    const stream: StreamSession = new StreamSession({
      onSession: aoAbrirSessao,
      onFeatures: aoReceberFeatures,
      onEsense: setEsense,
      onContrast: setContraste,
      onClosed: aoEncerrar,
      onError: (detalhe) => {
        setErro(detalhe);
        parar();
      },
      // O gateway manda `error` e **fecha** logo em seguida: sem isto, o
      // `parar()` acima ficava esperando um `closed` que o socket já não podia
      // trazer. Passa a si mesmo para o handler saber se ainda é a sessão da vez.
      onDisconnected: () => aoCairOCanal(stream),
    });
    return stream;
  }, [aoAbrirSessao, aoReceberFeatures, aoEncerrar, parar, aoCairOCanal]);

  const iniciar = useCallback(async () => {
    if (abrindoSessao || ativo) return;
    setAbrindoSessao(true);
    limparParaNovaSessao();

    const stream = novoStream();
    try {
      await stream.connect("simulador", SAMPLE_RATE);
    } catch {
      // Fecha o socket que não vingou, como o caminho do aparelho já fazia:
      // deixá-lo aberto é conexão órfã, e o `onclose` atrasado dela chegaria
      // fora de hora.
      stream.close();
      setErro("Não foi possível iniciar a captação simulada.");
      setAbrindoSessao(false);
      return;
    }

    sessao.current = stream;
    ativoRef.current = true;
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
      // Guardados num ref porque a **reconexão** refaz esta mesma ligação
      // (ADR-0055): os handlers guardam a closure sobre este `stream`, e é assim
      // que reconectar continua a sessão em vez de abrir outra.
      const handlers: DeviceHandlers = {
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
          // `disconnected` é a queda em si e tem tratamento próprio; `error` é o
          // resto (recusa, permissão, característica ausente) e continua sendo
          // uma mensagem na tela.
          if (status === "disconnected") aoCairAConexao();
          else if (status === "error") setErro(mensagemBluetooth(detalhe));
        },
      };
      aparelhoAtual.current = device;
      handlersAparelho.current = handlers;

      try {
        await stream.connect(device.name || "mindwave", SAMPLE_RATE);
        await deviceConnection.connect(device.id, handlers);
      } catch (e) {
        setErro(mensagemBluetooth(e));
        stream.close();
        setConectandoA(null);
        return;
      }

      sessao.current = stream;
      usandoAparelhoRef.current = true;
      ativoRef.current = true;
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
      aoCairAConexao,
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
      reconectando,
      motivoDoFim,
      relatorioNaoChegou,
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
      reconectando,
      motivoDoFim,
      relatorioNaoChegou,
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
