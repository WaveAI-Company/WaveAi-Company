import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { listCareLinks, revokeCareLink, type CareLink } from "../../src/api/care";
import { getConsentStatus, type ConsentStatus } from "../../src/api/consent";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Disclaimer } from "../../src/components/Disclaimer";
import { NavAction } from "../../src/components/NavAction";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { ScreenHeading } from "../../src/components/ScreenHeading";
import { StateView } from "../../src/components/StateView";
import { useAccentFor, useRoleAccent, useTheme } from "../../src/theme";

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
  const t = useTheme();
  const { accent } = useRoleAccent();
  const medico = useAccentFor("doctor");

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
      const [todos, status] = await Promise.all([listCareLinks(), getConsentStatus()]);
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
      <ScreenHeading title="Meu perfil" />

      <Card title={user?.display_name ?? "Paciente"} subtitle={user?.email} accent={accent} />

      <StateView loading={loading} error={erro} />

      {!loading ? (
        <>
          {/* Consentimento — o gate que libera guardar resultados. */}
          <ScreenHeading title="Consentimento" />
          <Card
            title={consentido ? "Consentimento ativo" : "Consentimento pendente"}
            subtitle={
              consentido
                ? "Você autorizou guardar os resultados das suas sessões."
                : "Sem consentimento, os resultados das suas sessões não são guardados."
            }
            accent={consentido ? accent : t.colors.warningText}
          />
          <NavAction
            label={consentido ? "Gerenciar consentimento" : "Rever e autorizar"}
            tone={consentido ? "accent" : "attention"}
            onPress={() => router.push("/patient/consent")}
          />

          {pendentes > 0 ? (
            <NavAction
              label={
                pendentes === 1
                  ? "1 convite aguardando resposta"
                  : `${pendentes} convites aguardando resposta`
              }
              onPress={() => router.push("/patient/invites")}
            />
          ) : null}

          <ScreenHeading
            title="Quem acompanha você"
            lead="Estes profissionais têm acesso às suas sessões porque você autorizou. Você pode revogar quando quiser — o efeito é imediato."
          />

          {links.length === 0 ? (
            <Card title="Nenhum profissional acompanha você no momento" />
          ) : null}

          {links.map((link) => (
            <Card
              key={link.id}
              title={link.counterpart_display_name ?? "Profissional"}
              subtitle="Acesso autorizado por você"
              accent={medico.accent}
            >
              <Button
                label="Revogar acesso"
                onPress={() => revogar(link.id)}
                loading={revogando === link.id}
                variant="danger"
              />
            </Card>
          ))}
        </>
      ) : null}

      <Disclaimer />

      <Button label="Sair" onPress={signOut} variant="secondary" />
    </ScreenContainer>
  );
}
