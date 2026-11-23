import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthContext";
import { ApiError, acceptTerms } from "../../auth/api";
import { TERMOS_DE_USO } from "../../legal/documents";
import { useRoleAccent, useTheme, type Theme } from "../../theme";
import { Button } from "../Button";

/**
 * Aviso de Termos atualizados (emenda à ADR-0048).
 *
 * A Política promete que, mudando os Termos, "avisaremos no aplicativo". Isto
 * é esse aviso: aparece para quem está logado e **não aceitou a versão que
 * este app exibe** — inclusive quem nunca teve aceite registrado (contas
 * anteriores à ADR-0048), porque nulo é "não temos registro", e a frase diz
 * exatamente isso.
 *
 * **Não bloqueia.** A ADR-0048 preteriu o gate por medo de trancar alguém fora;
 * o aviso cumpre a promessa sem esse risco. A pessoa lê, aceita quando quiser,
 * e o app segue funcionando enquanto isso.
 */
export function AvisoDeTermos() {
  const { user, recarregarUsuario } = useAuth();
  const t = useTheme();
  const { accent } = useRoleAccent();
  const router = useRouter();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!user || user.accepted_terms_version === TERMOS_DE_USO.versao) return null;

  const nuncaRegistrado = user.accepted_terms_version == null;

  const aceitar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await acceptTerms(TERMOS_DE_USO.versao);
      await recarregarUsuario();
    } catch (e) {
      // 409: este app mostra uma versão que o servidor já não reconhece como
      // vigente — o texto mudou depois que este app foi instalado.
      setErro(
        e instanceof ApiError && e.status === 409
          ? "Os Termos mudaram de novo depois desta versão do app. Atualize o app para ler e aceitar a versão atual."
          : "Não foi possível registrar agora. Tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.caixa} accessibilityRole="alert">
      <Text style={styles.titulo}>
        {nuncaRegistrado ? "Confirme os Termos de Uso" : "Os Termos de Uso foram atualizados"}
      </Text>
      <Text style={styles.texto}>
        {nuncaRegistrado
          ? `Não temos registro do seu aceite dos Termos. A versão ${TERMOS_DE_USO.versao} está em vigor; leia e confirme quando puder.`
          : `A versão ${TERMOS_DE_USO.versao} substitui a ${user.accepted_terms_version} que você aceitou. Leia o que mudou e confirme quando puder.`}
      </Text>
      <View style={styles.acoes}>
        <Button
          label="Ler os Termos"
          variant="secondary"
          accent={accent}
          compacto
          onPress={() => router.push("/legal/termos")}
        />
        <Button
          label="Li e aceito"
          accent={accent}
          compacto
          loading={enviando}
          onPress={() => void aceitar()}
        />
      </View>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    caixa: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderWidth: 1,
      borderRadius: t.radius.md,
      padding: t.spacing.md,
      marginHorizontal: t.spacing.md,
      marginTop: t.spacing.md,
      gap: t.spacing.sm,
    },
    titulo: {
      ...t.typography.body,
      color: t.colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    texto: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    acoes: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
    },
    erro: {
      ...t.typography.body,
      color: t.colors.dangerText,
      fontSize: 13,
    },
  });
