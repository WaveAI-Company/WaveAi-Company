import { useCallback, useEffect, useState } from "react";
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
import { StateView } from "../../src/components/StateView";
import { colors, spacing } from "../../src/theme";

/**
 * Caixa de convites do paciente (ADR-0024).
 *
 * O aceite aqui é **o ato de consentimento** que leva o vínculo a `active` e dá
 * ao médico acesso aos dados. Recusar o encerra (`declined`) sem conceder nada.
 * A invariante é enforçada no backend; esta tela é a porta desse consentimento.
 */
export default function PatientInvitesScreen() {
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

  const responder = useCallback(
    async (id: string, acao: "aceitar" | "recusar") => {
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
    },
    [],
  );

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Convites</Text>
      <Text style={styles.lead}>
        Profissionais que pediram para acompanhar suas sessões. O acesso só
        existe se você aceitar.
      </Text>

      <StateView
        loading={loading}
        error={erro}
        empty={
          !loading && !erro && convites.length === 0
            ? "Nenhum convite pendente."
            : null
        }
      />

      {convites.map((convite) => (
        <Card
          key={convite.id}
          title={convite.counterpart_display_name ?? "Profissional"}
          subtitle="Quer acompanhar suas sessões de bem-estar."
          accent={colors.doctor}
        >
          <View style={styles.acoes}>
            <View style={styles.acao}>
              <Button
                label="Aceitar"
                onPress={() => responder(convite.id, "aceitar")}
                loading={emAcao === convite.id}
                accent={colors.patient}
              />
            </View>
            <View style={styles.acao}>
              <Button
                label="Recusar"
                onPress={() => responder(convite.id, "recusar")}
                disabled={emAcao === convite.id}
                accent={colors.border}
              />
            </View>
          </View>
        </Card>
      ))}

      <Text style={styles.footnote}>
        Aceitar autoriza o profissional a ver os resultados das suas sessões.
        Você pode revogar o acesso quando quiser, no seu perfil.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  acoes: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm / 2,
  },
  acao: {
    flex: 1,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
