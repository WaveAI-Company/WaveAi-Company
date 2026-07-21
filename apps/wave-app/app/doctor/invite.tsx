import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { inviteCareLink, listCareLinks, type CareLink } from "../../src/api/care";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Disclaimer } from "../../src/components/Disclaimer";
import { Field } from "../../src/components/Field";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { StateView } from "../../src/components/StateView";
import { useTheme, type Theme } from "../../src/theme";

/**
 * Convidar paciente (ADR-0024).
 *
 * O convite **não concede acesso**: nasce `pending` e espera o aceite do
 * paciente. A confirmação é sempre a mesma, exista ou não a conta — o backend
 * não revela quem tem WaveAI (anti-enumeração), então esta tela também não
 * afirma que "o convite foi entregue", só que "foi registrado".
 */
export default function DoctorInviteScreen() {
  const t = useTheme();
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [pendentes, setPendentes] = useState<CareLink[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const todos = await listCareLinks();
      setPendentes(todos.filter((l) => l.status === "pending"));
    } catch {
      // Lista é secundária; a falha não deve travar o envio de convites.
      setPendentes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const convidar = useCallback(async () => {
    const alvo = email.trim();
    if (!alvo) return;
    setEnviando(true);
    setErro(null);
    setConfirmacao(null);
    try {
      await inviteCareLink(alvo);
      // Resposta genérica de propósito: não confirmamos se a conta existe.
      setConfirmacao(
        "Solicitação registrada. Se houver uma conta com este e-mail, o convite aparecerá para a pessoa aceitar.",
      );
      setEmail("");
      await carregar();
    } catch {
      setErro("Não foi possível enviar o convite. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }, [email, carregar]);

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Convidar paciente"
        lead="Envie um convite por e-mail. O acompanhamento só começa quando a pessoa aceitar — o convite, sozinho, não dá acesso a nada."
      />

      <Field
        label="E-mail do paciente"
        value={email}
        onChangeText={setEmail}
        placeholder="paciente@exemplo.com"
        keyboardType="email-address"
        autoComplete="email"
        editable={!enviando}
        error={erro}
      />
      <Button label="Enviar convite" onPress={convidar} loading={enviando} />

      {confirmacao ? (
        <Text style={styles.confirmacao} accessibilityRole="alert">
          {confirmacao}
        </Text>
      ) : null}

      <Text style={styles.secao}>Convites aguardando resposta</Text>
      <StateView
        loading={loading}
        empty={!loading && pendentes.length === 0 ? "Nenhum convite pendente." : null}
      />
      {pendentes.map((convite) => (
        <Card
          key={convite.id}
          title={convite.counterpart_display_name ?? "Paciente"}
          subtitle="Aguardando o aceite do paciente."
          accent={t.colors.warningText}
        />
      ))}

      <Disclaimer />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    secao: {
      ...t.typography.heading,
      color: t.colors.text,
      marginTop: t.spacing.md,
    },
    confirmacao: {
      ...t.typography.body,
      color: t.colors.accentDoctorText,
      fontSize: 14,
      lineHeight: 20,
    },
  });
