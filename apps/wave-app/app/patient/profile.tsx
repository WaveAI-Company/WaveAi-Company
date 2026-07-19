import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { listCareLinks, type CareLink } from "../../src/api/care";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { StateView } from "../../src/components/StateView";
import { colors, spacing } from "../../src/theme";

/**
 * Perfil do paciente.
 *
 * Mostra os dados reais da conta e **quem tem acesso** a ela — informação de
 * transparência: sob consent-first (ADR-0024) o paciente precisa conseguir ver
 * quais médicos ele autorizou.
 *
 * Aceitar, recusar e revogar são a **#20** — aqui a lista é só leitura.
 */
export default function PatientProfileScreen() {
  const { user, signOut } = useAuth();
  const [links, setLinks] = useState<CareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const todos = await listCareLinks();
      setLinks(todos.filter((link) => link.status === "active"));
    } catch {
      setErro("Não foi possível carregar quem acompanha você.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Meu perfil</Text>

      <Card title={user?.display_name ?? "Paciente"} subtitle={user?.email} accent={colors.patient} />

      <Text style={styles.secao}>Quem acompanha você</Text>
      <Text style={styles.explicacao}>
        Estes profissionais têm acesso às suas sessões porque você autorizou.
      </Text>

      <StateView
        loading={loading}
        error={erro}
        empty={
          !loading && !erro && links.length === 0
            ? "Nenhum profissional acompanha você no momento."
            : null
        }
      />

      {links.map((link) => (
        <Card
          key={link.id}
          title={link.counterpart_display_name ?? "Profissional"}
          subtitle="Acesso autorizado por você"
          accent={colors.doctor}
        />
      ))}

      <Text style={styles.footnote}>
        Uso exploratório de bem-estar — não-clínico e não-diagnóstico.
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
  secao: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  explicacao: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
