import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { listActivePatients, type CareLink } from "../../src/api/care";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Disclaimer } from "../../src/components/Disclaimer";
import { NavAction } from "../../src/components/NavAction";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { StateView } from "../../src/components/StateView";
import { useRoleAccent, useTheme, type Theme } from "../../src/theme";

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
  const t = useTheme();
  const { accent } = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);

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

  // Ao focar: um convite aceito pelo paciente, ou um vínculo revogado, muda
  // esta lista sem que nada aconteça nesta tela.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  return (
    <ScreenContainer>
      <ScreenHeading
        title="Pacientes"
        lead={
          user?.display_name
            ? `${user.display_name} — pacientes que autorizaram o acompanhamento.`
            : "Pacientes que autorizaram o acompanhamento."
        }
      />

      <NavAction label="+ Convidar paciente" onPress={() => router.push("/doctor/invite")} />

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
          accessibilityLabel={`${link.counterpart_display_name ?? "Paciente"}. Ver sessões.`}
          onPress={() => router.push(`/doctor/patient/${link.counterpart_user_id}`)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <Card
            title={link.counterpart_display_name ?? "Paciente"}
            subtitle="Ver sessões"
            accent={accent}
          />
        </Pressable>
      ))}

      <Disclaimer variant="profissional" />

      <Button label="Sair" onPress={signOut} variant="secondary" />
    </ScreenContainer>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    item: {
      borderRadius: t.radius.md,
    },
    pressed: {
      opacity: 0.7,
    },
  });
