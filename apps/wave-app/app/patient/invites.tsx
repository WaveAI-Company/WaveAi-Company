import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  acceptCareLink,
  declineCareLink,
  listPendingInvites,
  type CareLink,
} from "../../src/api/care";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { StateView } from "../../src/components/StateView";
import { useAccentFor, useTheme, type Theme } from "../../src/theme";

/**
 * Caixa de convites do paciente (ADR-0024).
 *
 * O aceite aqui é **o ato de consentimento** que leva o vínculo a `active` e dá
 * ao médico acesso aos dados. Recusar o encerra (`declined`) sem conceder nada.
 * A invariante é enforçada no backend; esta tela é a porta desse consentimento.
 */
export default function PatientInvitesScreen() {
  const t = useTheme();
  const medico = useAccentFor("doctor");
  const styles = useMemo(() => criarEstilos(t), [t]);

  const [convites, setConvites] = useState<CareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  //: id do convite em processamento, para desabilitar só os botões dele.
  const [emAcao, setEmAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setConvites(await listPendingInvites());
    } catch {
      setErro("Não foi possível carregar seus convites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const responder = useCallback(async (id: string, acao: "aceitar" | "recusar") => {
    setEmAcao(id);
    setErro(null);
    try {
      await (acao === "aceitar" ? acceptCareLink(id) : declineCareLink(id));
      // Some da lista de pendentes de qualquer forma (virou active/declined).
      setConvites((atual) => atual.filter((c) => c.id !== id));
    } catch {
      setErro("Não foi possível responder ao convite. Tente de novo.");
    } finally {
      setEmAcao(null);
    }
  }, []);

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Convites"
        lead="Profissionais que pediram para acompanhar suas sessões. O acesso só existe se você aceitar."
      />

      <StateView
        loading={loading}
        error={erro}
        empty={
          !loading && !erro && convites.length === 0 ? "Nenhum convite pendente." : null
        }
      />

      {convites.map((convite) => (
        <Card
          key={convite.id}
          title={convite.counterpart_display_name ?? "Profissional"}
          subtitle="Quer acompanhar suas sessões de bem-estar."
          accent={medico.accent}
        >
          <View style={styles.acoes}>
            <View style={styles.acao}>
              <Button
                label="Aceitar"
                onPress={() => responder(convite.id, "aceitar")}
                loading={emAcao === convite.id}
              />
            </View>
            <View style={styles.acao}>
              <Button
                label="Recusar"
                onPress={() => responder(convite.id, "recusar")}
                disabled={emAcao === convite.id}
                variant="secondary"
              />
            </View>
          </View>
        </Card>
      ))}

      <Text style={styles.nota}>
        Aceitar autoriza o profissional a ver os resultados das suas sessões.
        Você pode revogar o acesso quando quiser, no seu perfil.
      </Text>
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    acoes: {
      flexDirection: "row",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    acao: {
      flex: 1,
    },
    nota: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.md,
    },
  });
