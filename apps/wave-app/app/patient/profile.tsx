import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import {
  listCareLinks,
  revokeCareLink,
  type CareLink,
} from "../../src/api/care";
import { getConsentStatus, type ConsentStatus } from "../../src/api/consent";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { StateView } from "../../src/components/StateView";
import { colors, radius, spacing } from "../../src/theme";

/**
 * Perfil do paciente.
 *
 * Centro de controle do consent-first (ADR-0024/0026): o paciente vê e gere seu
 * consentimento, vê quem autorizou e pode **revogar** o acesso a qualquer
 * momento (efeito imediato). Convites pendentes e o termo têm telas próprias.
 */
export default function PatientProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [links, setLinks] = useState<CareLink[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [todos, status] = await Promise.all([
        listCareLinks(),
        getConsentStatus(),
      ]);
      setLinks(todos.filter((link) => link.status === "active"));
      setPendentes(todos.filter((link) => link.status === "pending").length);
      setConsent(status);
    } catch {
      setErro("Não foi possível carregar seu perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Ao focar: voltando da tela de consentimento ou de convites, o que mudou
  // lá precisa aparecer aqui.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const revogar = useCallback(async (id: string) => {
    setRevogando(id);
    setErro(null);
    try {
      await revokeCareLink(id);
      setLinks((atual) => atual.filter((link) => link.id !== id));
    } catch {
      setErro("Não foi possível revogar o acesso. Tente de novo.");
    } finally {
      setRevogando(null);
    }
  }, []);

  const consentido = consent?.consent_given ?? false;

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Meu perfil</Text>

      <Card title={user?.display_name ?? "Paciente"} subtitle={user?.email} accent={colors.patient} />

      <StateView loading={loading} error={erro} />

      {!loading ? (
        <>
          {/* Consentimento — o gate que libera guardar resultados. */}
          <Text style={styles.secao}>Consentimento</Text>
          <Card
            title={consentido ? "Consentimento ativo" : "Consentimento pendente"}
            subtitle={
              consentido
                ? "Você autorizou guardar os resultados das suas sessões."
                : "Sem consentimento, os resultados das suas sessões não são guardados."
            }
            accent={consentido ? colors.patient : colors.warning}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/patient/consent")}
            style={({ pressed }) => [styles.acao, pressed && styles.pressed]}
          >
            <Text style={styles.acaoTexto}>
              {consentido ? "Gerenciar consentimento" : "Rever e autorizar"}
            </Text>
          </Pressable>

          {/* Convites pendentes — atalho para a caixa. */}
          {pendentes > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/patient/invites")}
              style={({ pressed }) => [styles.acao, pressed && styles.pressed]}
            >
              <Text style={styles.acaoTexto}>
                {pendentes === 1
                  ? "1 convite aguardando resposta"
                  : `${pendentes} convites aguardando resposta`}
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.secao}>Quem acompanha você</Text>
          <Text style={styles.explicacao}>
            Estes profissionais têm acesso às suas sessões porque você autorizou.
            Você pode revogar quando quiser — o efeito é imediato.
          </Text>

          {links.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhum profissional acompanha você no momento.
            </Text>
          ) : null}

          {links.map((link) => (
            <Card
              key={link.id}
              title={link.counterpart_display_name ?? "Profissional"}
              subtitle="Acesso autorizado por você"
              accent={colors.doctor}
            >
              <Button
                label="Revogar acesso"
                onPress={() => revogar(link.id)}
                loading={revogando === link.id}
                accent={colors.warning}
              />
            </Card>
          ))}
        </>
      ) : null}

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
  vazio: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  acao: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  acaoTexto: {
    color: colors.patient,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
