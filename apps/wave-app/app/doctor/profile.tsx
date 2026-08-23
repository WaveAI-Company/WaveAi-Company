import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listCareLinks, revokeCareLink, type CareLink } from "../../src/api/care";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { DeleteAccount } from "../../src/components/DeleteAccount";
import { Disclaimer } from "../../src/components/Disclaimer";
import { NavAction } from "../../src/components/NavAction";
import { Panel } from "../../src/components/Panel";
import { PersonRow, PersonRowSkeleton } from "../../src/components/profile/PersonRow";
import { AccountEditor } from "../../src/components/profile/AccountEditor";
import { ProfileHeader } from "../../src/components/profile/ProfileHeader";
import { ProfileSection } from "../../src/components/profile/ProfileSection";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ThemeSelector } from "../../src/components/ThemeSelector";
import { dataCurta } from "../../src/format/date";
import { bp, useAccentFor, useRoleAccent, useTheme, type Theme } from "../../src/theme";

/**
 * Perfil do profissional de bem-estar.
 *
 * **Não há mockup para esta tela**: o round 1 tem 11 telas e a única de perfil
 * (`Design/round1/perfil.html`) é a do titular — o índice a marca como
 * "pessoa". Então isto é o perfil do titular relido do outro lado do vínculo,
 * na mesma linguagem: mesmo cabeçalho, mesma grade de duas colunas, mesmos
 * cartões de configuração.
 *
 * **O que muda, e por quê:**
 *
 * - "Quem me acompanha" vira "Quem autoriza você", e a ação é **encerrar o
 *   acompanhamento** — o gesto não é o mesmo dos dois lados: o titular tira o
 *   acesso de alguém, o profissional sai. O servidor aceita os dois (qualquer
 *   das partes revoga) e registra quem foi.
 * - **Não há consentimento aqui.** O consentimento de guarda é do titular; o
 *   profissional não tem equivalente, e desenhar um seria inventar poder.
 * - Os convites que ele enviou e ainda não foram respondidos aparecem no mesmo
 *   painel, porque é o único lugar de onde ele pode **cancelá-los** — um
 *   convite mandado para o e-mail errado, sem isso, ficaria pendurado.
 * - Nada de captação (o diagnóstico BLE é da tela do titular).
 */
export default function DoctorProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const { accent } = useRoleAccent();
  const paciente = useAccentFor("patient");
  const styles = useMemo(() => criarEstilos(t), [t]);
  const emColunas = useWindowDimensions().width > bp.duasColunas;

  const [ativos, setAtivos] = useState<CareLink[]>([]);
  const [pendentes, setPendentes] = useState<CareLink[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState<string | null>(null);
  /** Vínculos encerrados nesta visita — ficam à vista como recibo do gesto. */
  const [encerrados, setEncerrados] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const todos = await listCareLinks();
      setAtivos(todos.filter((link) => link.status === "active"));
      setPendentes(todos.filter((link) => link.status === "pending"));
      setEncerrados([]);
    } catch {
      setErro("Não foi possível carregar seu perfil.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Ao focar: um convite enviado na tela de convidar precisa aparecer aqui.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const encerrar = useCallback(async (id: string) => {
    setEncerrando(id);
    setErro(null);
    try {
      await revokeCareLink(id);
      // A linha não some agora: some no próximo carregamento. Sumir na hora
      // seria a pessoa perder de vista o que acabou de fazer — e não há
      // desfazer (encerrar é terminal; voltar exige um convite novo).
      setEncerrados((atual) => [...atual, id]);
    } catch {
      setErro("Não foi possível concluir. Tente de novo.");
    } finally {
      setEncerrando(null);
    }
  }, []);

  const vivos = [...ativos, ...pendentes];
  const nadaAinda = !carregando && vivos.length === 0;

  return (
    <ScreenContainer largura="perfil">
      <ProfileHeader
        name={user?.display_name}
        email={user?.email}
        fallback="Profissional de bem-estar"
        role="Profissional de bem-estar"
        accent={accent}
      />

      {erro ? (
        <Text style={styles.erro} accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}

      <View style={[styles.grade, emColunas && styles.gradeLinha]}>
        {/* ============ configurações ============ */}
        <View style={[styles.coluna, emColunas && styles.colunaLinha]}>
          <ProfileSection label="Configurações" />

          <Panel title="Aparência" eyebrow="tema">
            <ThemeSelector />
            <Text style={styles.nota}>
              “Sistema” acompanha a preferência do seu aparelho automaticamente.
            </Text>
          </Panel>

          <AccountEditor showEmail={false} showPassword={false} />
        </View>

        {/* ============ quem autoriza você ============ */}
        <View style={[styles.coluna, emColunas && styles.colunaLinha]}>
          <ProfileSection label="Quem autoriza você" />

          <Panel
            title="Pessoas que autorizam você"
            headerAccessory={<Chip label="leitura · nunca edição" />}
          >
            <Text style={styles.nota}>
              O acompanhamento começa quando a pessoa aceita o convite e termina quando
              qualquer um dos dois encerra — com efeito imediato.
            </Text>

            {carregando ? <PersonRowSkeleton /> : null}

            {nadaAinda ? (
              <Text style={styles.vazio}>
                Ninguém autorizou seu acompanhamento ainda. Convide uma pessoa por e-mail
                — só depois de ela aceitar você vê alguma coisa.
              </Text>
            ) : null}

            {!carregando
              ? ativos.map((link) => {
                  const encerrado = encerrados.includes(link.id);
                  return (
                    <PersonRow
                      key={link.id}
                      name={link.counterpart_display_name}
                      fallback="Pessoa"
                      note={`autorizou em ${dataCurta(link.consented_at ?? link.created_at)}`}
                      tone={paciente.accentText}
                      ended={encerrado}
                      status={encerrado ? "acompanhamento encerrado" : undefined}
                      action={
                        <Button
                          label="Encerrar acompanhamento"
                          onPress={() => encerrar(link.id)}
                          loading={encerrando === link.id}
                          variant="secondary"
                        />
                      }
                    />
                  );
                })
              : null}

            {!carregando
              ? pendentes.map((link) => {
                  const cancelado = encerrados.includes(link.id);
                  return (
                    <PersonRow
                      key={link.id}
                      // O convite é anti-enumeração (ADR-0024): quando o e-mail
                      // não tem conta, não há nome nenhum para mostrar — e a
                      // ausência dele não conta se a conta existe ou não.
                      name={link.counterpart_display_name}
                      fallback="Convite enviado"
                      note={`aguardando resposta · enviado em ${dataCurta(link.created_at)}`}
                      tone={paciente.accentText}
                      ended={cancelado}
                      status={cancelado ? "convite cancelado" : undefined}
                      action={
                        <Button
                          label="Cancelar convite"
                          onPress={() => encerrar(link.id)}
                          loading={encerrando === link.id}
                          variant="secondary"
                        />
                      }
                    />
                  );
                })
              : null}

            <NavAction
              label="Convidar uma pessoa"
              description="O acompanhamento só começa se ela aceitar."
              tone="neutral"
              onPress={() => router.push("/doctor/invite")}
            />
          </Panel>

          <Panel>
            {/* A contrapartida do que prometemos ao titular. Ele lê, no perfil
                dele, que o profissional nunca vê o sinal bruto e que a leitura
                fica registrada — dizer o mesmo aqui é o que torna a promessa
                verificável, em vez de um texto que só uma das partes vê. */}
            <Text style={styles.nota}>
              Você lê medidas calculadas no servidor, resumos e o que a pessoa escreveu —
              nunca o sinal bruto da sessão, e nada é editável. Cada leitura fica
              registrada em trilha de acesso. Acompanhar uma sessão ao vivo depende de a
              pessoa ter ligado o compartilhamento naquela sessão, e ela pode desligar a
              qualquer momento.
            </Text>
          </Panel>
        </View>
      </View>

      {/* As credenciais saem da coluna de configurações e viram uma faixa
          própria, meio a meio na largura inteira — o mesmo arranjo do perfil
          do paciente, para os dois lados lerem igual. */}
      <AccountEditor showIdentity={false} credenciaisEmLinha={emColunas} />

      {/* "Sair" saiu do perfil: ele vive na sidebar (decisão do fundador em
          2026-08-13). */}
      {/* Última coisa da tela, e depois do resto: encerrar a conta não pode
          ficar perto de nada que se clique por engano. */}
      <ProfileSection label="Conta" />

      {/* O profissional aceita os mesmos documentos e precisa poder relê-los —
          inclusive a parte que diz que a conta dele não tem credencial
          verificada. */}
      <NavAction
        label="Termos de Uso"
        description="As regras de uso do WaveAI, e o que ele não é."
        tone="neutral"
        onPress={() => router.push("/legal/termos")}
      />
      <NavAction
        label="Política de Privacidade"
        description="O que coletamos, por quanto tempo e com quem compartilhamos."
        tone="neutral"
        onPress={() => router.push("/legal/privacidade")}
      />

      <DeleteAccount />

      <Disclaimer />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
    },
    grade: {
      gap: t.spacing.lg,
    },
    // `stretch` dá às duas colunas a mesma altura; os cartões dentro delas
    // mantêm a altura do conteúdo e a sobra fica no fim da coluna, fora de
    // qualquer borda. Ver a nota longa no perfil do paciente.
    gradeLinha: {
      alignItems: "stretch",
      flexDirection: "row",
    },
    // Duas colunas de larguras iguais: aqui `flex: 1` é exatamente o que se
    // quer — o cuidado de estilo próprio sem `flex` vale para coluna FIXA.
    coluna: {
      gap: t.spacing.md,
      minWidth: 0,
    },
    // `flex` só quando a grade é uma LINHA. Empilhada no celular, o eixo
    // principal vira o vertical e o `flex: 1` (que o RN-web resolve como
    // `flex-basis: 0%`) reparte a ALTURA em partes iguais: sobra vazio no fim
    // da primeira coluna e a segunda transborda por cima do que vem depois.
    // Medido no perfil a 375px: 542px para cada coluna, 122px de vazio numa e
    // 121px de transbordo na outra — o "espaçamento muito grande" e a
    // "sobreposição" do pente fino eram a mesma causa.
    colunaLinha: {
      flex: 1,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    vazio: {
      ...t.typography.body,
      color: t.colors.textMuted,
      paddingVertical: t.spacing.sm,
    },
  });
