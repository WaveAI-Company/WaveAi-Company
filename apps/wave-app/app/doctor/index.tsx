import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  listCareLinks,
  resendCareLink,
  revokeCareLink,
  type CareLink,
} from "../../src/api/care";
import { ApiError } from "../../src/auth/api";
import { useAuth } from "../../src/auth/AuthContext";
import { Avatar } from "../../src/components/Avatar";
import { PersonAvatar } from "../../src/components/profile/PersonAvatar";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { EmptyState } from "../../src/components/EmptyState";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SearchField } from "../../src/components/SearchField";
import { diaMes } from "../../src/format/date";
import { Skeleton } from "../../src/components/Skeleton";
import {
  anelFoco,
  elevar,
  motion,
  semContornoNativo,
  transicao,
  useInteracao,
  useFaixa,
  useRoleAccent,
  useTheme,
  type FaixaLargura,
  type Theme,
} from "../../src/theme";

/** "há 5 dias" — idade do convite, com os casos curtos por extenso. */
function enviadoHa(iso: string, agora: Date): string {
  const dias = Math.floor((agora.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "convite enviado hoje";
  if (dias === 1) return "convite enviado ontem";
  return `convite enviado há ${dias} dias`;
}

function saudacao(agora: Date): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Como chamar a pessoa na saudação.
 *
 * O primeiro token sozinho não serve quando ele é um **título**: "Dra. Fictícia"
 * vira "Dra." e a saudação sai com ponto dobrado ("Bom dia, Dra.."). Quando o
 * primeiro token termina em ponto, o nome vem junto.
 */
function comoChamar(nomeCompleto: string | null | undefined): string {
  const partes = (nomeCompleto ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes[0].endsWith(".") && partes.length > 1) return `${partes[0]} ${partes[1]}`;
  return partes[0];
}

/** Normaliza para busca: sem acento, sem caixa. */
function chave(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Início do profissional de bem-estar — porte de
 * `Design/round1/inicio-profissional.html` (ADR-0024/0042).
 *
 * Lista quem **autorizou** o acompanhamento e os convites ainda **pendentes**,
 * lado a lado mas nunca confundidos: um convite pendente não concede acesso
 * nenhum (ADR-0024), e é por isso que o cartão pendente não tem "Abrir painel".
 *
 * **O cartão conta, o cartão não mede** (emenda à ADR-0037 de 2026-08-14). As
 * contagens de sessões e de autorrelatos vêm do próprio `/care-links`, como
 * `COUNT(*)`: nada é decifrado e nenhum evento de acesso é gravado. Já a
 * qualidade média e a linha de alfa que o mockup desenha no cartão **continuam
 * fora** — são valor derivado do sinal, e lê-los é ato auditado
 * (`ResultService.listar` grava um `result_access_event`). O acesso deliberado
 * é abrir o painel da pessoa.
 */
export default function DoctorScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const { accent } = useRoleAccent();
  /** `@media (max-width:767px){.search{width:100%}}` — no celular ela ocupa a linha. */
  const faixa = useFaixa();
  // A fileira de busca desce para a própria linha fora do desktop: dividindo a
  // linha com a saudação, ela espremia o título em duas ou três linhas.
  const acoesEmLinhaPropria = faixa !== "largo";
  // Já a busca só toma a linha inteira *dentro* da fileira no celular — no
  // tablet ela divide a linha com o botão "Convidar", que é o do mockup.
  const buscaCheia = faixa === "movel";
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [links, setLinks] = useState<CareLink[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setLinks(await listCareLinks());
    } catch {
      setErro("Não foi possível carregar as pessoas que autorizaram você.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Ao focar: um convite aceito, ou um vínculo revogado pelo titular, muda esta
  // lista sem que nada aconteça nesta tela.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const cancelarConvite = useCallback(async (id: string) => {
    setCancelando(id);
    setErro(null);
    try {
      // Cancelar um convite é revogar o vínculo antes do aceite: ele nunca
      // concedeu acesso, então não há o que encerrar além do próprio pedido.
      await revokeCareLink(id);
      setLinks((atual) => atual.filter((l) => l.id !== id));
    } catch {
      setErro("Não foi possível cancelar o convite. Tente de novo.");
    } finally {
      setCancelando(null);
    }
  }, []);

  /**
   * Lembra a pessoa do convite. O 429 não é erro de sistema: é o servidor
   * dizendo que o lembrete anterior saiu há pouco, e a tela precisa contar
   * isso com todas as letras — senão parece que o botão não funcionou.
   */
  const reenviarConvite = useCallback(async (id: string) => {
    setReenviando(id);
    setErro(null);
    setReenviado(null);
    try {
      await resendCareLink(id);
      setReenviado(id);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 429
          ? "Você já lembrou esta pessoa há pouco. Tente de novo mais tarde."
          : "Não foi possível reenviar o convite. Tente de novo.",
      );
    } finally {
      setReenviando(null);
    }
  }, []);

  const agora = new Date();
  const ativos = links.filter((l) => l.status === "active");
  const pendentes = links.filter((l) => l.status === "pending");

  const filtro = chave(busca.trim());
  const casa = (l: CareLink) =>
    filtro.length === 0 || chave(l.counterpart_display_name ?? "").includes(filtro);
  const ativosVisiveis = ativos.filter(casa);
  const pendentesVisiveis = pendentes.filter(casa);
  const nadaEncontrado =
    filtro.length > 0 && ativosVisiveis.length === 0 && pendentesVisiveis.length === 0;

  const tratamento = comoChamar(user?.display_name);

  const resumo = [
    ativos.length === 1
      ? "1 pessoa autorizou seu acompanhamento"
      : `${ativos.length} pessoas autorizaram seu acompanhamento`,
    pendentes.length > 0
      ? pendentes.length === 1
        ? "1 convite pendente"
        : `${pendentes.length} convites pendentes`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const cartaoEsqueleto = (chaveCartao: number) => (
    <View key={chaveCartao} style={styles.cartao}>
      <Panel grow>
        <View style={styles.cabeca}>
          <Skeleton width={46} height={46} radius={23} />
          <View style={styles.cabecaTextos}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
        <Skeleton width="100%" height={44} radius={t.radius.md} />
      </Panel>
    </View>
  );

  if (carregando) {
    return (
      <ScreenContainer largura="app">
        <Skeleton width={260} height={32} />
        <Text style={styles.carregandoNota}>
          Carregando as pessoas que autorizaram seu acompanhamento…
        </Text>
        <View style={styles.grade}>{[0, 1, 2].map(cartaoEsqueleto)}</View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer largura="app">
      {/* ===== cabeçalho ===== */}
      <View style={styles.topo}>
        <View style={[styles.topoTextos, faixa === "movel" && styles.topoTextosMovel]}>
          <Text style={styles.saudacao}>
            {saudacao(agora)}
            {tratamento ? `, ${tratamento}` : ""}.
          </Text>
          {links.length > 0 ? <Text style={styles.resumo}>{resumo}</Text> : null}
        </View>
        {links.length > 0 ? (
          <View style={[styles.topoAcoes, acoesEmLinhaPropria && styles.topoAcoesCheio]}>
            <View style={[styles.busca, buscaCheia && styles.buscaCheia]}>
              <SearchField
                value={busca}
                onChangeText={setBusca}
                label="Buscar pessoa"
                placeholder="Buscar pessoa"
              />
            </View>
            <View style={styles.botaoConvidar}>
              <Button label="Convidar" onPress={() => router.push("/doctor/invite")} />
            </View>
          </View>
        ) : null}
      </View>

      {erro ? (
        <Text style={styles.erro} accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}

      {/* ===== ninguém ainda ===== */}
      {links.length === 0 && !erro ? (
        <EmptyState
          adorno={{ tipo: "icone", nome: "userPlus" }}
          titulo="Ninguém por aqui — ainda"
          texto="Convide uma pessoa por e-mail. O acompanhamento só começa se ela aceitar — e ela pode revogar o acesso a qualquer momento. Quando alguém autorizar, as tendências dela aparecem aqui."
          acao={
            <Button label="Convidar uma pessoa" onPress={() => router.push("/doctor/invite")} />
          }
        />
      ) : null}

      {/* ===== grade de pessoas ===== */}
      <View style={styles.grade}>
        {ativosVisiveis.map((link) => (
          <CartaoPessoa
            key={link.id}
            link={link}
            accent={accent}
            onAbrir={() => router.push(`/doctor/patient/${link.counterpart_user_id}`)}
          />
        ))}

        {pendentesVisiveis.map((link) => (
          <CartaoPendente
            key={link.id}
            link={link}
            agora={agora}
            faixa={faixa}
            reenviado={reenviado === link.id}
            reenviando={reenviando === link.id}
            cancelando={cancelando === link.id}
            onReenviar={() => reenviarConvite(link.id)}
            onCancelar={() => cancelarConvite(link.id)}
          />
        ))}

        {/* Espaçadores de altura zero: sem eles, um cartão sozinho na última
            fila estica para a largura inteira (o `flexGrow` não sabe que a fila
            está incompleta) e vira uma faixa desproporcional ao lado dos
            outros. Três cobrem até quatro colunas, que é o máximo no teto de
            1280 desta tela. */}
        {[0, 1, 2].map((i) => (
          <View key={`espaco-${i}`} style={styles.espacador} aria-hidden />
        ))}
      </View>

      {nadaEncontrado ? (
        <Text style={styles.semResultado}>Nenhuma pessoa encontrada com esse nome.</Text>
      ) : null}

      {/* O seletor de tema saiu daqui (pente fino: "funções de aparência e sair
          sem sentido para essa tela"). O comentário que o justificava — "o
          profissional não tem tela de perfil própria" — estava vencido: o
          perfil existe e já traz o mesmo seletor. Conferido antes de remover,
          para não deixar o profissional sem como trocar o tema. */}

      {/* "Sair" saiu daqui: ele vive na sidebar (decisão do fundador em
          2026-08-13). Sem isso ele ficaria pendurado **depois** do aviso, que
          agora fecha a tela. */}
      <Disclaimer variant="profissional" />
    </ScreenContainer>
  );
}

/**
 * Cartão de convite pendente.
 *
 * **Não é clicável** — não há painel para abrir enquanto ninguém aceitou —,
 * mas reage ao ponteiro como os vizinhos: sem isso, ele era o único cartão
 * inerte da fila e parecia desligado. O realce é só a borda e os 2px do
 * `.pcard:hover`; não há `accessibilityRole` de botão, nem cursor de mão, nem
 * foco de teclado próprio: quem age são os dois botões lá dentro.
 *
 * Declarado fora da tela porque precisa do seu próprio `useInteracao`.
 */
function CartaoPendente({
  link,
  agora,
  faixa,
  reenviado,
  reenviando,
  cancelando,
  onReenviar,
  onCancelar,
}: {
  link: CareLink;
  agora: Date;
  faixa: FaixaLargura;
  reenviado: boolean;
  reenviando: boolean;
  cancelando: boolean;
  onReenviar: () => void;
  onCancelar: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  return (
    /**
     * **Sem realce de ponteiro, e não por esquecimento.** No RN-web 0.86 o
     * hover só existe em `Pressable` que seja de fato interativo: `onHoverIn`
     * é prop dele e a `View` a ignora, `onPointerEnter` na `View` não chega ao
     * DOM (inspecionado: o nó sai sem handler nenhum), e um `Pressable` sem
     * `onPress` — ou com `focusable={false}` — também não instala nada.
     *
     * As três saídas foram medidas e nenhuma serve sem custo: para acender a
     * borda, este cartão teria de virar um alvo clicável e focável que **não
     * leva a lugar nenhum** (não há painel enquanto ninguém aceitou). Um alvo
     * que o leitor de tela anuncia como botão e não faz nada é pior que um
     * cartão que não reage. Quem age aqui são os dois botões lá dentro.
     */
    <View style={styles.cartao}>
      <Panel grow>
            <View style={styles.cabeca}>
              <Avatar
                name={link.counterpart_display_name}
                size={46}
                tone={t.colors.textMuted}
              />
              <View style={styles.cabecaTextos}>
                <Text style={styles.nome}>
                  {link.counterpart_display_name ?? "Convite enviado"}
                </Text>
                {/* O endereço só existe enquanto pende: é como quem
                    convidou confere se digitou certo antes de insistir. */}
                <Text style={styles.nota}>
                  {[link.counterpart_email, enviadoHa(link.created_at, agora)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Chip label="pendente" />
            </View>

            <Text style={styles.explicacao}>
              Aguardando o aceite. O acompanhamento só começa quando a pessoa autorizar —
              e ela pode revogar depois, a qualquer momento.
            </Text>

            {reenviado ? (
              <Text style={styles.explicacao}>
                Lembrete enviado. Ele não muda o convite nem o recado — só avisa de novo.
              </Text>
            ) : null}

            {/* Lado a lado, meio a meio, enquanto houver largura; no
                celular cada um volta a ocupar a linha, centrado. */}
            <View style={[styles.acoes, faixa === "movel" && styles.acoesMovel]}>
              <View style={faixa === "movel" ? undefined : styles.acaoMetade}>
                <Button
                  label="Reenviar convite"
                  onPress={onReenviar}
                  loading={reenviando}
                  variant="secondary"
                  largura={faixa === "movel" ? "conteudo" : "bloco"}
                  compacto
                />
              </View>
              <View style={faixa === "movel" ? undefined : styles.acaoMetade}>
                <Button
                  label="Cancelar convite"
                  onPress={onCancelar}
                  loading={cancelando}
                  variant="secondary"
                  largura={faixa === "movel" ? "conteudo" : "bloco"}
                  compacto
                />
              </View>
            </View>
      </Panel>
    </View>
  );
}

/**
 * Cartão de pessoa — o `.pcard` do mockup, e o cartão **inteiro** é o alvo.
 *
 * `.pcard:hover{transform:translateY(-2px); border-color:var(--accent)}`: no
 * design o cartão reage ao ponteiro e leva ao painel; aqui só o botão levava, e
 * o resto do cartão era decoração inerte.
 *
 * O botão continua existindo por dentro. Não é redundância: ele é o alvo de
 * teclado e o rótulo que diz **para onde** o cartão leva — um `Pressable` de
 * 300px sem nome não se anuncia a leitor de tela. O RN resolve a disputa a
 * favor do filho, então clicar no botão não dispara o cartão duas vezes.
 *
 * Declarado **fora** do componente da tela: cada cartão precisa do seu
 * `useInteracao`, e um componente definido no render remontaria a lista a cada
 * tecla digitada na busca.
 */
function CartaoPessoa({
  link,
  accent,
  onAbrir,
}: {
  link: CareLink;
  accent: string;
  onAbrir: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const { estado, handlers, reduzirMovimento } = useInteracao();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir painel de ${link.counterpart_display_name ?? "paciente"}`}
      onPress={onAbrir}
      {...handlers}
      style={[
        styles.cartao,
        // `transition:transform .15s, border-color .2s` — o cartão sobe e a
        // borda o alcança, como no mockup.
        transicao("transform, border-color", [motion.rapida, motion.media]),
        estado.hovered && elevar(-2, reduzirMovimento),
        estado.focoVisivel && { boxShadow: anelFoco(accent, t.colors.background) },
        semContornoNativo(),
      ]}
    >
      {/* A borda vive no `Panel`, não neste invólucro — que não tem borda
          nenhuma. Enquanto o `borderColor` do hover ficou aqui, o cartão subia
          os 2px e o contorno do `.pcard:hover` simplesmente não acontecia. */}
      <Panel grow style={estado.hovered ? { borderColor: accent } : undefined}>
        <View style={styles.cabeca}>
          <PersonAvatar
            name={link.counterpart_display_name}
            size={46}
            tone={accent}
            userId={link.counterpart_user_id}
          />
          <View style={styles.cabecaTextos}>
            <Text style={styles.nome}>{link.counterpart_display_name ?? "Paciente"}</Text>
            <Text style={styles.nota}>
              autorizou em {diaMes(link.consented_at ?? link.created_at)}
            </Text>
          </View>
        </View>

        {/* As `.stat` do `.pcard`. Contagem, nunca medida: número de sessões
            não é nota de desempenho, e nada aqui vem do sinal. */}
        <View style={styles.estatisticas}>
          <View style={styles.estatistica}>
            <Text style={styles.estatisticaRotulo}>Sessões</Text>
            <Text style={styles.estatisticaValor}>{link.session_count ?? "—"}</Text>
          </View>
          <View style={styles.estatistica}>
            <Text style={styles.estatisticaRotulo}>Autorrelatos</Text>
            <Text style={styles.estatisticaValor}>{link.annotation_count ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.explicacao}>
          As medidas desta pessoa abrem no painel — e cada leitura fica registrada em
          trilha de acesso.
        </Text>

        <View style={styles.acao}>
          <Button label="Abrir painel" onPress={onAbrir} variant="secondary" />
        </View>
      </Panel>
    </Pressable>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    carregandoNota: {
      ...t.typography.body,
      color: t.colors.textSubtle,
      fontSize: 13,
    },
    topo: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
    },
    /**
     * `minWidth: 420` e não 240: a saudação é `display` (32px) e, com 240, ela
     * quebrava em duas linhas já num laptop grande enquanto a busca ficava com
     * a folga toda. Com o piso maior, a fileira de busca **quebra sozinha**
     * para a linha de baixo quando não couber — é o `flexWrap` do `topo` que
     * decide, sem mais um corte por largura.
     */
    topoTextos: {
      flex: 1,
      gap: 2,
      minWidth: 420,
    },
    /**
     * No celular o piso vira zero. Um `minWidth` maior que a tela é um piso
     * que ninguém consegue honrar: o bloco ficava com os 420 numa faixa útil
     * de ~328 e **o título saía pela borda** em vez de quebrar em duas linhas.
     */
    topoTextosMovel: {
      minWidth: 0,
    },
    saudacao: {
      ...t.typography.display,
      color: t.colors.text,
    },
    resumo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
    },
    // `flexShrink: 1` aqui não é estética. No RN o padrão é **0** (no CSS é 1),
    // então este bloco não encolhia abaixo da largura do próprio conteúdo e
    // **transbordava** a coluna a 360 em vez de quebrar por dentro: a busca e o
    // botão saíam pela direita da tela.
    // Fora do desktop a fileira desce para a própria linha: dividindo a linha
    // com a saudação, ela deixava 240px para o título e o quebrava em duas ou
    // três linhas. O `flexBasis:100%` precisa estar **aqui** e não na busca —
    // ali ele só ocupava a largura da própria fileira.
    topoAcoesCheio: {
      flexBasis: "100%",
    },
    topoAcoes: {
      alignItems: "center",
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      flexWrap: "wrap",
      gap: t.spacing.sm,
      // O `.sp{flex:1}` do `.page-top`: busca e botão encostam à direita, e o
      // vão fica entre eles e a saudação.
      justifyContent: "flex-end",
      minWidth: 240,
    },
    /**
     * `.search{width:min(320px,100%)}` e, no celular, `width:100%`.
     *
     * Com `flexGrow: 1` e teto de 320 ela parava de crescer no meio da linha e
     * deixava um vão à direita — o "alinhamento do search não condiz com o do
     * mockup". Lá o `.page-top .sp{flex:1}` encosta busca e botão à direita.
     */
    busca: {
      flexBasis: 320,
      maxWidth: "100%",
      minWidth: 0,
    },
    buscaCheia: {
      flexBasis: "100%",
    },
    // Sem largura mínima: o `minWidth: 150` sobrava 37px à direita do rótulo e
    // impedia o botão de encostar na borda junto com a busca.
    botaoConvidar: {
      alignItems: "flex-end",
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
    },
    grade: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.lg - 4,
    },
    /**
     * Cartão elástico (não de largura fixa): abaixo de ~300 a linha quebra e
     * ele ocupa a largura toda.
     *
     * `flexShrink: 1` porque o padrão do RN é **0**: numa tela de 320px sobram
     * 288 de largura útil, e o cartão ficava nos 300 do `flexBasis` sem
     * encolher — 16px de margem à esquerda contra 4 à direita, com 12px
     * saindo por baixo da borda da tela.
     */
    cartao: {
      flexBasis: 300,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    espacador: {
      flexBasis: 300,
      flexGrow: 1,
      height: 0,
      // Sem isto o `gap` da grade ainda reservaria a altura da linha vazia.
      marginBottom: -(24 - 4),
      minWidth: 0,
    },
    cabeca: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm + 4,
    },
    // `.pcard .stats{grid-template-columns:1fr 1fr; gap:10px 16px}`.
    estatisticas: {
      flexDirection: "row",
      gap: 16,
    },
    estatistica: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    // `.stat .k{font-size:11.5px; color:var(--ink-3)}`.
    estatisticaRotulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11.5,
    },
    // `.stat .v{font-size:15px; font-weight:650; font-variant-numeric:tabular-nums}`.
    estatisticaValor: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    cabecaTextos: {
      flex: 1,
      gap: 2,
      minWidth: 120,
    },
    nome: {
      ...t.typography.heading,
      color: t.colors.text,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    explicacao: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    // Só o respiro: largura é assunto do `Button` desde o pente fino de UI.
    acao: {
      marginTop: t.spacing.xs,
    },
    // Dois botões lado a lado, como o mockup do cartão pendente. `flexWrap`
    // não é enfeite: no RN o `flexShrink` padrão é 0, então sem ele a linha
    // transbordaria o cartão em vez de quebrar por dentro.
    acoes: {
      flexDirection: "row",
      flexWrap: "wrap",
      // 8 e não 4: no cartão do painel (≈312 px) os dois botões não cabem lado
      // a lado e a linha quebra — com 4 px eles ficam colados na vertical. O
      // mockup usa 6 px numa linha larga; aqui a folga vale mais.
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    // `flexWrap:"nowrap"` junto: numa coluna que quebra, o `center` alinha
    // dentro da *linha do wrap* (a largura do conteúdo) e não do contêiner —
    // o mesmo que segurou o botão do herói da home fora do centro.
    acoesMovel: {
      alignItems: "center",
      flexDirection: "column",
      flexWrap: "nowrap",
    },
    acaoMetade: {
      flexBasis: 0,
      flexGrow: 1,
      minWidth: 0,
    },
    semResultado: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      textAlign: "center",
    },
  });
