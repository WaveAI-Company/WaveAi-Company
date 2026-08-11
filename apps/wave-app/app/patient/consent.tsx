import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  getConsentStatus,
  giveConsent,
  revokeConsent,
  type ConsentStatus,
} from "../../src/api/consent";
import { deleteMyResults, exportMyData } from "../../src/api/results";
import { ApiError } from "../../src/auth/api";
import { Button } from "../../src/components/Button";
import { Checkbox } from "../../src/components/Checkbox";
import { Disclaimer } from "../../src/components/Disclaimer";
import { Icon, type IconName } from "../../src/components/Icon";
import { Panel } from "../../src/components/Panel";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { Skeleton } from "../../src/components/Skeleton";
import { WaveField } from "../../src/components/brand/WaveField";
import { dataCurta } from "../../src/format/date";
import {
  AVISO_COPIA,
  COPIA_DISPONIVEL,
  ROTULO_COPIA,
  TEXTO_COPIA,
  baixarCopia,
  podeCompartilhar,
} from "../../src/privacy/dataExport";
import { useRoleAccent, useTheme, withAlpha, type Theme } from "../../src/theme";

/**
 * Trechos em negrito dentro de um item — o design destaca o **quê**, não a
 * frase inteira. Uma string com marcador seria mais curta e menos legível.
 */
type Trecho = string | { forte: string };

type Secao = {
  icone: IconName;
  titulo: string;
  itens: Trecho[][];
};

/**
 * O que o aceite cobre, em palavras da pessoa que aceita.
 *
 * Cada item corresponde a algo que o servidor **de fato** faz ou não faz — a
 * lista é conferida contra ADR-0025 (bruto não persistido), ADR-0026 (gate de
 * consentimento), ADR-0034 (eSense rotulado), ADR-0037 (nota cifrada) e
 * Medical/71-72.
 */
const SECOES: Secao[] = [
  {
    icone: "database",
    titulo: "O que guardamos",
    itens: [
      [
        { forte: "Resultados por sessão" },
        ", calculados no servidor: composição por banda (delta, teta, alfa, beta, gama), data e duração.",
      ],
      [
        { forte: "Qualidade do sinal" },
        " de cada sessão — para você saber quando uma leitura merece menos peso.",
      ],
      [
        { forte: "Índice de atenção/meditação (eSense)" },
        " — algoritmo proprietário e não validado do sensor, guardado como complemento, nunca como fundamento.",
      ],
      [
        { forte: "Suas notas de contexto" },
        " (autorrelato), se você escrever alguma — guardadas cifradas.",
      ],
      [
        "A ",
        { forte: "versão do motor de análise" },
        " usada em cada resultado, para transparência.",
      ],
    ],
  },
  {
    icone: "xCircle",
    titulo: "O que não fazemos",
    itens: [
      [
        "Não guardamos o ",
        { forte: "sinal bruto do EEG" },
        " — ele é analisado em tempo real e descartado, nunca chega ao banco.",
      ],
      [
        "Não fazemos diagnóstico e não geramos laudo — o WaveAI é ",
        { forte: "bem-estar exploratório" },
        ", não é um serviço de saúde.",
      ],
      [
        "Não compartilhamos nada com um profissional de bem-estar ",
        { forte: "sem a sua autorização expressa" },
        " — e você pode revogá-la a qualquer momento.",
      ],
      ["Não vendemos seus dados nem os usamos para publicidade."],
    ],
  },
  {
    icone: "lock",
    titulo: "Seu controle, sempre",
    itens: [
      [
        { forte: "Revogar este consentimento" },
        " quando quiser — novas sessões deixam de ser guardadas na hora.",
      ],
      [{ forte: "Excluir os resultados guardados" }, ", de uma vez."],
      [{ forte: "Pedir uma cópia" }, " dos seus resultados e notas."],
    ],
  },
];

/** "5 ago 2026, 14:32" */
function carimbo(iso: string): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataCurta(iso)}, ${hora}`;
}

/**
 * Termo de consentimento informado — porte de
 * `Design/round1/consentimento.html` (ADR-0026 / ADR-0042 / Medical/72).
 *
 * É a manifestação de UI do **gate de persistência**: sem o aceite aqui, o
 * backend não grava nenhum `Result` derivado do EEG do titular. A versão
 * vigente vem do backend (fonte da verdade), para o aceite registrar exatamente
 * qual termo foi lido.
 *
 * Depois de aceito, a tela vira o **painel de direitos**: revogar, pedir cópia
 * (portabilidade) e excluir (erasure) — os três são atos separados de propósito,
 * para um não destruir o outro sem pedido.
 */
export default function ConsentScreen() {
  const t = useTheme();
  const router = useRouter();
  const { accent, accentText, onAccent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [li, setLi] = useState(false);
  /** Ação de gerenciamento em curso, para o spinner cair no botão certo. */
  const [emAcao, setEmAcao] = useState<"copia" | "excluir" | null>(null);
  /** Exclusão é irreversível: o primeiro toque só pede confirmação. */
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  /**
   * No nativo, quem decide se há como entregar o arquivo é o **sistema**
   * (ADR-0046): sem share sheet, a tela não oferece o botão em vez de oferecer
   * um botão que falha. `null` enquanto a resposta não chega.
   */
  const [entregaPossivel, setEntregaPossivel] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    podeCompartilhar().then((ok) => {
      if (vivo) setEntregaPossivel(ok);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setStatus(await getConsentStatus());
    } catch {
      setErro("Não foi possível carregar o consentimento.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aceitar = useCallback(async () => {
    if (!status) return;
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      await giveConsent(status.current_version);
      setLi(false);
      await carregar();
    } catch (e) {
      // 409 = o termo mudou desde que a tela abriu: recarrega e pede de novo.
      setErro(
        e instanceof ApiError && e.status === 409
          ? "O termo foi atualizado. Recarregamos — por favor, revise e confirme."
          : "Não foi possível registrar o consentimento.",
      );
      await carregar();
    } finally {
      setEnviando(false);
    }
  }, [status, carregar]);

  const revogar = useCallback(async () => {
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      await revokeConsent();
      await carregar();
    } catch {
      setErro("Não foi possível revogar o consentimento.");
    } finally {
      setEnviando(false);
    }
  }, [carregar]);

  const pedirCopia = useCallback(async () => {
    setEmAcao("copia");
    setErro(null);
    setAviso(null);
    try {
      await baixarCopia(await exportMyData());
      setAviso(AVISO_COPIA);
    } catch {
      setErro("Não foi possível preparar a cópia dos seus dados.");
    } finally {
      setEmAcao(null);
    }
  }, []);

  const excluirTudo = useCallback(async () => {
    setEmAcao("excluir");
    setErro(null);
    setAviso(null);
    try {
      const { deleted } = await deleteMyResults();
      setConfirmandoExclusao(false);
      setAviso(
        deleted === 0
          ? "Não havia resultados guardados para excluir."
          : `${deleted} ${deleted === 1 ? "resultado excluído" : "resultados excluídos"}, junto com as notas.`,
      );
    } catch {
      setErro("Não foi possível excluir seus resultados. Tente de novo.");
    } finally {
      setEmAcao(null);
    }
  }, []);

  const consentido = status?.consent_given ?? false;
  // Consentiu, mas a uma versão que já não é a vigente: precisa reconfirmar.
  const versaoDefasada = consentido && status?.consent_version !== status?.current_version;
  const precisaAceitar = !consentido || versaoDefasada;

  /** Um item da lista: marcador redondo + texto com destaques. */
  const item = (trechos: Trecho[], chave: number) => (
    <View key={chave} style={styles.item}>
      <View style={[styles.marcador, { backgroundColor: accentText }]} />
      <Text style={styles.itemTexto}>
        {trechos.map((trecho, i) =>
          typeof trecho === "string" ? (
            trecho
          ) : (
            <Text key={i} style={styles.forte}>
              {trecho.forte}
            </Text>
          ),
        )}
      </Text>
    </View>
  );

  const secao = (s: Secao) => (
    <View key={s.titulo} style={styles.secao}>
      <View style={styles.secaoTitulo}>
        <Icon name={s.icone} size={17} color={accentText} strokeWidth={1.9} />
        <Text style={styles.secaoTexto}>{s.titulo}</Text>
      </View>
      {s.itens.map(item)}
    </View>
  );

  /** Linha de "Gerenciar": explicação à esquerda, ação à direita. */
  const linhaGerenciar = (titulo: string, descricao: string, acao: ReactNode) => (
    <View style={styles.gerenciarLinha}>
      <View style={styles.gerenciarTextos}>
        <Text style={styles.gerenciarTitulo}>{titulo}</Text>
        <Text style={styles.gerenciarNota}>{descricao}</Text>
      </View>
      <View style={styles.gerenciarAcao}>{acao}</View>
    </View>
  );

  if (carregando) {
    return (
      <ScreenContainer>
        <Panel>
          <Skeleton width={64} height={64} radius={32} />
          <Skeleton width="45%" height={14} />
          <Skeleton width="80%" height={30} />
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={120} />
        </Panel>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {erro ? (
        <Text style={styles.erro} accessibilityRole="alert">
          {erro}
        </Text>
      ) : null}
      {aviso ? (
        <Text style={styles.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}

      {status && precisaAceitar ? (
        <>
          <Panel>
            <View style={[styles.selo, { backgroundColor: withAlpha(accentText, 0.14) }]}>
              <Icon name="shield" size={28} color={accentText} strokeWidth={1.6} />
            </View>
            <Text style={styles.eyebrow}>Consentimento · versão {status.current_version}</Text>
            <Text style={styles.titulo}>Guardar os resultados das suas sessões</Text>
            <Text style={styles.lead}>
              Para mostrar suas tendências ao longo do tempo, precisamos guardar os
              resultados de cada sessão. Aqui está exatamente o que isso significa — em
              palavras simples.
            </Text>

            {versaoDefasada ? (
              <Text style={styles.defasado} accessibilityRole="alert">
                O termo foi atualizado desde o seu último aceite (você aceitou a versão{" "}
                {status.consent_version}). Revise e confirme novamente.
              </Text>
            ) : null}

            {SECOES.map(secao)}

            <Text style={styles.nota}>
              Sem este consentimento você ainda pode fazer sessões e ver tudo ao vivo — os
              resultados simplesmente não ficam guardados, e as tendências não se formam.
              Nada muda no seu acesso ao app.
            </Text>

            <Checkbox
              checked={li}
              onChange={setLi}
              label="Li e entendi o que será guardado e como posso mudar de ideia."
            />

            <View style={styles.acoes}>
              <View style={styles.acao}>
                <Button
                  label="Aceitar e guardar minhas sessões"
                  onPress={aceitar}
                  loading={enviando}
                  disabled={!li}
                />
              </View>
              <View style={styles.acao}>
                <Button
                  label="Decidir depois"
                  onPress={() => router.push("/patient")}
                  variant="secondary"
                />
              </View>
            </View>

            <WaveField height={70} opacity={0.35} amplitude={10} />
          </Panel>

          <Text style={styles.rodape}>
            consentimento v{status.current_version} · registrado no servidor WaveAI com data
            e hora
          </Text>
        </>
      ) : null}

      {status && !precisaAceitar ? (
        <>
          <Panel>
            <View style={[styles.faixa, { backgroundColor: withAlpha(accentText, 0.14) }]}>
              <View style={[styles.faixaSelo, { backgroundColor: accent }]}>
                <Icon name="check" size={19} color={onAccent} strokeWidth={2.6} />
              </View>
              <View style={styles.faixaTextos}>
                <Text style={styles.faixaTitulo}>Consentimento ativo</Text>
                <Text style={styles.faixaNota}>
                  {status.consent_given_at ? `aceito em ${carimbo(status.consent_given_at)} · ` : ""}
                  versão {status.consent_version} · registrado no servidor
                </Text>
              </View>
            </View>

            <View style={styles.secao}>
              <View style={styles.secaoTitulo}>
                <Icon name="gear" size={17} color={accentText} strokeWidth={1.9} />
                <Text style={styles.secaoTexto}>Gerenciar</Text>
              </View>

              {linhaGerenciar(
                "Revogar consentimento",
                "Novas sessões deixam de ser guardadas imediatamente. As já guardadas continuam suas — exclua quando quiser.",
                <Button
                  label="Revogar"
                  onPress={revogar}
                  loading={enviando}
                  variant="secondary"
                />,
              )}

              {/* Portabilidade existe no servidor para as duas plataformas; o
                  que muda é a entrega do arquivo (ver `dataExport.ts`).

                  O mockup promete "enviamos para o seu e-mail" — o produto NÃO
                  faz isso, de propósito (ADR-0046): mandar o conjunto inteiro,
                  com as notas que ciframos, para uma caixa de entrada seria
                  desfazer por e-mail o cuidado que temos no banco. A cópia
                  abaixo diz o que de fato acontece. */}
              {COPIA_DISPONIVEL && entregaPossivel !== false
                ? linhaGerenciar(
                    "Pedir uma cópia dos resultados",
                    TEXTO_COPIA,
                    <Button
                      label={ROTULO_COPIA}
                      onPress={pedirCopia}
                      loading={emAcao === "copia"}
                      variant="secondary"
                    />,
                  )
                : null}

              {linhaGerenciar(
                "Excluir todos os resultados",
                confirmandoExclusao
                  ? "Isto não tem volta: os resultados guardados e as notas de contexto somem para sempre. O consentimento continua ativo — novas sessões voltam a ser guardadas."
                  : "Remove os resultados guardados e as notas de forma permanente. Pediremos uma confirmação.",
                confirmandoExclusao ? (
                  <View style={styles.confirmar}>
                    <Button
                      label="Excluir mesmo assim"
                      onPress={excluirTudo}
                      loading={emAcao === "excluir"}
                      variant="danger"
                    />
                    <Button
                      label="Cancelar"
                      onPress={() => setConfirmandoExclusao(false)}
                      variant="secondary"
                    />
                  </View>
                ) : (
                  <Button
                    label="Excluir…"
                    onPress={() => setConfirmandoExclusao(true)}
                    variant="secondary"
                  />
                ),
              )}
            </View>

            <Text style={styles.nota}>
              Lembrete sereno: o WaveAI é bem-estar exploratório. Seus resultados descrevem
              tendências — nunca são um laudo, e nenhuma banda é “boa” ou “ruim”.
            </Text>
          </Panel>

          <Text style={styles.rodape}>
            consentimento v{status.consent_version} · histórico de aceites disponível no
            servidor
          </Text>
        </>
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
    },
    aviso: {
      ...t.typography.body,
      color: t.colors.text,
    },
    selo: {
      alignItems: "center",
      borderRadius: 32,
      height: 64,
      justifyContent: "center",
      marginBottom: t.spacing.xs,
      width: 64,
    },
    eyebrow: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    titulo: {
      ...t.typography.title,
      color: t.colors.text,
    },
    lead: {
      ...t.typography.body,
      color: t.colors.textMuted,
      maxWidth: 560,
    },
    defasado: {
      ...t.typography.body,
      color: t.colors.warningText,
      fontSize: 14,
    },
    secao: {
      gap: t.spacing.sm,
      marginTop: t.spacing.md,
    },
    secaoTitulo: {
      alignItems: "center",
      flexDirection: "row",
      gap: t.spacing.sm + 1,
      marginBottom: t.spacing.xs,
    },
    secaoTexto: {
      ...t.typography.heading,
      color: t.colors.text,
      flexShrink: 1,
      fontSize: 15,
    },
    item: {
      flexDirection: "row",
      gap: t.spacing.sm + 4,
    },
    marcador: {
      borderRadius: 3,
      height: 6,
      marginTop: 8,
      width: 6,
    },
    itemTexto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 22,
    },
    forte: {
      color: t.colors.text,
      fontWeight: "700",
    },
    nota: {
      ...t.typography.caption,
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      color: t.colors.textSubtle,
      lineHeight: 20,
      marginTop: t.spacing.md,
      padding: t.spacing.md,
    },
    acoes: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
    acao: {
      flex: 1,
      minWidth: 200,
    },
    rodape: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      textAlign: "center",
    },
    faixa: {
      alignItems: "center",
      borderRadius: t.radius.md,
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.spacing.md,
    },
    faixaSelo: {
      alignItems: "center",
      borderRadius: 19,
      flexGrow: 0,
      flexShrink: 0,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    faixaTextos: {
      flexShrink: 1,
      gap: 2,
    },
    faixaTitulo: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
    },
    faixaNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
    },
    gerenciarLinha: {
      alignItems: "center",
      borderTopColor: t.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
    gerenciarTextos: {
      flex: 1,
      gap: 2,
      minWidth: 200,
    },
    gerenciarTitulo: {
      ...t.typography.bodyStrong,
      color: t.colors.text,
      fontSize: 14,
    },
    gerenciarNota: {
      ...t.typography.caption,
      color: t.colors.textSubtle,
      lineHeight: 18,
    },
    gerenciarAcao: {
      minWidth: 170,
    },
    confirmar: {
      gap: t.spacing.sm,
    },
  });
