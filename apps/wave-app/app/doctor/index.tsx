import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { listActivePatients, type CareLink } from "../../src/api/care";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { StateView } from "../../src/components/StateView";
import { colors, radius, spacing } from "../../src/theme";

/**
 * Lista de pacientes do médico.
 *
 * Mostra **apenas vínculos `active`** (ADR-0024): um convite pendente não
 * concede acesso, então exibi-lo aqui sugeriria um acompanhamento que não
 * existe. Convidar e ver convites pendentes é a tela `doctor/invite` (#29).
 */
export default function DoctorScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [links, setLinks] = useState<CareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setLinks(await listActivePatients());
    } catch {
      setErro("Não foi possível carregar seus pacientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Pacientes</Text>
      <Text style={styles.lead}>
        {user?.display_name
          ? `${user.display_name} — pacientes que autorizaram o acompanhamento.`
          : "Pacientes que autorizaram o acompanhamento."}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/doctor/invite")}
        style={({ pressed }) => [styles.convidar, pressed && styles.pressed]}
      >
        <Text style={styles.convidarTexto}>+ Convidar paciente</Text>
      </Pressable>

      <StateView
        loading={loading}
        error={erro}
        empty={
          !loading && !erro && links.length === 0
            ? "Nenhum paciente autorizou o acompanhamento ainda."
            : null
        }
      />

      {links.map((link) => (
        <Pressable
          key={link.id}
          accessibilityRole="button"
          onPress={() => router.push(`/doctor/patient/${link.counterpart_user_id}`)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <Card
            title={link.counterpart_display_name ?? "Paciente"}
            subtitle="Ver sessões"
            accent={colors.doctor}
          />
        </Pressable>
      ))}

      <Text style={styles.footnote}>
        Dados exploratórios de bem-estar — não-clínicos e não-diagnósticos. Não
        substituem avaliação profissional.
      </Text>

      <Button label="Sair" onPress={signOut} accent={colors.border} />
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
  item: {
    borderRadius: radius.md,
  },
  convidar: {
    borderColor: colors.doctor,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  convidarTexto: {
    color: colors.doctor,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
