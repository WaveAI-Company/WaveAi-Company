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
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Disclaimer } from "../../src/components/Disclaimer";
import { Icon } from "../../src/components/Icon";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { SearchField } from "../../src/components/SearchField";
import { diaMes } from "../../src/format/date";
import { Skeleton } from "../../src/components/Skeleton";
import { ThemeSelector } from "../../src/components/ThemeSelector";
import { WaveField } from "../../src/components/brand/WaveField";
import { useRoleAccent, useTheme, withAlpha, type Theme } from "../../src/theme";

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
 * **Os cartões não trazem números da pessoa** — nem contagem de sessões, nem
 * qualidade média, nem a linha de alfa que o mockup desenha. Ler os resultados
 * de um titular é um ato **auditado** (`ResultService.listar` grava um
 * `result_access_event` a cada leitura): carregar isso para todo mundo ao abrir
 * a lista encheria a trilha de acessos que ninguém pediu e esvaziaria o sentido
 * do registro. O acesso deliberado é abrir o painel da pessoa.
 */
export default function DoctorScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const { accent } = useRoleAccent();
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
        <View style={styles.topoTextos}>
          <Text style={styles.saudacao}>
            {saudacao(agora)}
            {tratamento ? `, ${tratamento}` : ""}.
          </Text>
          {links.length > 0 ? <Text style={styles.resumo}>{resumo}</Text> : null}
        </View>
        {links.length > 0 ? (
          <View style={styles.topoAcoes}>
            <View style={styles.busca}>
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
        <Panel>
          <View style={styles.vazio}>
            <View style={[styles.vazioIcone, { backgroundColor: withAlpha(accent, 0.14) }]}>
              <Icon name="userPlus" size={36} color={accent} strokeWidth={1.6} />
            </View>
            <Text style={styles.vazioTitulo}>Ninguém por aqui — ainda</Text>
            <Text style={styles.vazioTexto}>
              Convide uma pessoa por e-mail. O acompanhamento só começa se ela aceitar — e
              ela pode revogar o acesso a qualquer momento. Quando alguém autorizar, as
              tendências dela aparecem aqui.
            </Text>
            <View style={styles.vazioAcao}>
              <Button
                label="Convidar uma pessoa"
                onPress={() => router.push("/doctor/invite")}
              />
            </View>
            <WaveField height={90} opacity={0.35} amplitude={12} />
          </View>
        </Panel>
      ) : null}

      {/* ===== grade de pessoas ===== */}
      <View style={styles.grade}>
        {ativosVisiveis.map((link) => (
          <View key={link.id} style={styles.cartao}>
            <Panel grow>
              <View style={styles.cabeca}>
                <Avatar name={link.counterpart_display_name} size={46} tone={accent} />
                <View style={styles.cabecaTextos}>
                  <Text style={styles.nome}>
                    {link.counterpart_display_name ?? "Paciente"}
                  </Text>
                  <Text style={styles.nota}>
                    autorizou em {diaMes(link.consented_at ?? link.created_at)}
                  </Text>
                </View>
              </View>

              <Text style={styles.explicacao}>
                As medidas desta pessoa abrem no painel — e cada leitura fica registrada
                em trilha de acesso.
              </Text>

              <View style={styles.acao}>
                <Button
                  label="Abrir painel"
                  onPress={() => router.push(`/doctor/patient/${link.counterpart_user_id}`)}
                  variant="secondary"
                />
              </View>
            </Panel>
          </View>
        ))}

        {pendentesVisiveis.map((link) => (
          <View key={link.id} style={styles.cartao}>
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

              {reenviado === link.id ? (
                <Text style={styles.explicacao}>
                  Lembrete enviado. Ele não muda o convite nem o recado — só avisa de novo.
                </Text>
              ) : null}

              <View style={styles.acoes}>
                <Button
                  label="Reenviar convite"
                  onPress={() => reenviarConvite(link.id)}
                  loading={reenviando === link.id}
                  variant="secondary"
                />
                <Button
                  label="Cancelar convite"
                  onPress={() => cancelarConvite(link.id)}
                  loading={cancelando === link.id}
                  variant="secondary"
                />
              </View>
            </Panel>
          </View>
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

      {/* Enquanto o profissional não tem tela de perfil própria, a preferência
          de tema mora aqui — é o único lugar onde ele pode mudá-la. */}
      <View style={styles.aparencia}>
        <Text style={styles.aparenciaTitulo}>Aparência</Text>
        <ThemeSelector />
      </View>

      <Disclaimer variant="profissional" />

      <Button label="Sair" onPress={signOut} variant="secondary" />
    </ScreenContainer>
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
    topoTextos: {
      flex: 1,
      gap: 2,
      minWidth: 240,
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
    topoAcoes: {
      alignItems: "center",
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
      flexWrap: "wrap",
      gap: t.spacing.sm,
      minWidth: 240,
    },
    busca: {
      flexBasis: 200,
      flexGrow: 1,
      maxWidth: 320,
      minWidth: 0,
    },
    botaoConvidar: {
      minWidth: 150,
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
    // Cartão elástico (não de largura fixa): abaixo de ~300 a linha quebra e
    // ele ocupa a largura toda.
    cartao: {
      flexBasis: 300,
      flexGrow: 1,
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
    semResultado: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      textAlign: "center",
    },
    vazio: {
      alignItems: "center",
      gap: t.spacing.sm,
      paddingTop: t.spacing.lg,
    },
    vazioIcone: {
      alignItems: "center",
      borderRadius: 44,
      height: 88,
      justifyContent: "center",
      width: 88,
    },
    vazioTitulo: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: "center",
    },
    vazioTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 520,
      textAlign: "center",
    },
    vazioAcao: {
      marginTop: t.spacing.sm,
      minWidth: 240,
    },
    aparencia: {
      gap: t.spacing.sm,
      marginTop: t.spacing.md,
    },
    aparenciaTitulo: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
  });
