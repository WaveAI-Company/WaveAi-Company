import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import {
  getConsentStatus,
  giveConsent,
  revokeConsent,
  type ConsentStatus,
} from "../../src/api/consent";
import { ApiError } from "../../src/auth/api";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Disclaimer } from "../../src/components/Disclaimer";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { StateView } from "../../src/components/StateView";
import { useRoleAccent, useTheme, type Theme } from "../../src/theme";

/**
 * Termo de consentimento informado (ADR-0026 / Medical/72).
 *
 * É a manifestação de UI do **gate de persistência**: sem o aceite aqui, o
 * backend não grava nenhum `Result` derivado do EEG do paciente. O texto
 * descreve o que é coletado, para quê, por quanto tempo, quem acessa e os
 * direitos do titular — e a versão vigente vem do backend (fonte da verdade),
 * para o aceite registrar exatamente qual termo foi lido.
 */
export default function ConsentScreen() {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setStatus(await getConsentStatus());
    } catch {
      setErro("Não foi possível carregar o consentimento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aceitar = useCallback(async () => {
    if (!status) return;
    setEnviando(true);
    setErro(null);
    try {
      await giveConsent(status.current_version);
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
    try {
      await revokeConsent();
      await carregar();
    } catch {
      setErro("Não foi possível revogar o consentimento.");
    } finally {
      setEnviando(false);
    }
  }, [carregar]);

  const consentido = status?.consent_given ?? false;
  // Consentiu, mas a uma versão que já não é a vigente: precisa reconfirmar.
  const versaoDefasada = consentido && status?.consent_version !== status?.current_version;

  const secoes = [
    {
      titulo: "O que é guardado",
      corpo: (
        <Text style={styles.corpo}>
          Apenas as <Text style={styles.forte}>medidas derivadas</Text> do seu
          sinal (potências de banda, alfa relativo, qualidade) e a versão do
          motor de análise. O{" "}
          <Text style={styles.forte}>sinal bruto do EEG não é guardado</Text> em
          nenhum momento.
        </Text>
      ),
    },
    {
      titulo: "Para quê",
      corpo: (
        <Text style={styles.corpo}>
          Para você acompanhar suas tendências de bem-estar ao longo do tempo e,
          se você autorizar, permitir que um profissional as acompanhe. Uso
          exploratório — não-clínico e não-diagnóstico.
        </Text>
      ),
    },
    {
      titulo: "Por quanto tempo",
      corpo: (
        <Text style={styles.corpo}>
          Enquanto você mantiver os dados. A exclusão é um direito seu e está
          sempre disponível no seu perfil.
        </Text>
      ),
    },
    {
      titulo: "Quem acessa",
      corpo: (
        <Text style={styles.corpo}>
          Só você — e os profissionais que você{" "}
          <Text style={styles.forte}>explicitamente autorizar</Text>. Nenhum
          acesso acontece sem um ato seu.
        </Text>
      ),
    },
    {
      titulo: "Seus direitos",
      corpo: (
        <Text style={styles.corpo}>
          Acessar, exportar e apagar seus dados a qualquer momento.{" "}
          <Text style={styles.forte}>Revogar este consentimento</Text> interrompe
          novas coletas; ele não apaga o que já existe — para isso, use a
          exclusão no seu perfil.
        </Text>
      ),
    },
  ];

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Consentimento"
        lead="Para guardar os resultados das suas sessões, precisamos do seu consentimento informado. Você pode revogá-lo quando quiser."
      />

      <StateView loading={loading} error={loading ? null : erro} />

      {!loading && status ? (
        <>
          {secoes.map((s) => (
            <Card key={s.titulo} title={s.titulo} accent={accent}>
              {s.corpo}
            </Card>
          ))}

          {consentido && !versaoDefasada ? (
            <>
              <Card
                title="Você autorizou"
                subtitle={
                  status.consent_given_at
                    ? `Em ${new Date(status.consent_given_at).toLocaleDateString("pt-BR")} · termo ${status.consent_version}`
                    : `Termo ${status.consent_version}`
                }
                accent={accent}
              />
              <Button
                label="Revogar consentimento"
                onPress={revogar}
                loading={enviando}
                variant="danger"
              />
            </>
          ) : (
            <>
              {versaoDefasada ? (
                <Text style={styles.aviso} accessibilityRole="alert">
                  O termo foi atualizado desde o seu último aceite. Revise e
                  confirme novamente.
                </Text>
              ) : null}
              <Button label="Concordo e autorizo" onPress={aceitar} loading={enviando} />
            </>
          )}
        </>
      ) : null}

      <Disclaimer variant="medidas" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    corpo: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    forte: {
      color: t.colors.text,
      fontWeight: "700",
    },
    aviso: {
      ...t.typography.body,
      color: t.colors.warningText,
      fontSize: 14,
    },
  });
