import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  deleteMyAnnotation,
  getMyAnnotation,
  getPatientAnnotation,
  putMyAnnotation,
  type Annotation,
} from "../api/annotations";
import { useRoleAccent, useTheme, type Theme } from "../theme";
import { Button } from "./Button";
import { Card } from "./Card";
import { Field } from "./Field";

type Props = {
  sessionId: string;
  /** `edit` = o titular anota a própria sessão; `read` = profissional só lê. */
  mode: "edit" | "read";
  /** Obrigatório em `read`: de quem é a sessão (a API exige CareLink ativo). */
  patientId?: string;
  accent?: string;
};

const MAX = 2000;

/**
 * Anotação de contexto de uma sessão (ADR-0037), a v1 manual do "pop-up de
 * contexto". O titular escreve/edita/apaga; o profissional só lê (read-only),
 * rotulado como autorrelato. A autorização é do servidor.
 */
export function SessionAnnotation({ sessionId, mode, patientId, accent }: Props) {
  const t = useTheme();
  const papel = useRoleAccent();
  const styles = useMemo(() => criarEstilos(t), [t]);
  const cor = accent ?? papel.accent;

  const [nota, setNota] = useState<Annotation | null>(null);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const atual =
        mode === "read" && patientId
          ? await getPatientAnnotation(patientId, sessionId)
          : await getMyAnnotation(sessionId);
      setNota(atual);
      setTexto(atual?.note ?? "");
    } catch {
      // Sessão sem permissão/inexistente: nada a mostrar (a tela pai já trata o
      // caso maior; aqui a anotação só some sem alarde).
      setNota(null);
    } finally {
      setCarregando(false);
    }
  }, [mode, patientId, sessionId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = useCallback(async () => {
    const conteudo = texto.trim();
    if (!conteudo) {
      setErro("Escreva algo para salvar.");
      return;
    }
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      setNota(await putMyAnnotation(sessionId, conteudo));
      setSalvo(true);
    } catch {
      setErro("Não foi possível salvar a anotação.");
    } finally {
      setSalvando(false);
    }
  }, [sessionId, texto]);

  const remover = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    try {
      await deleteMyAnnotation(sessionId);
      setNota(null);
      setTexto("");
      setSalvo(false);
    } catch {
      setErro("Não foi possível remover a anotação.");
    } finally {
      setSalvando(false);
    }
  }, [sessionId]);

  if (carregando) return null;

  // -- profissional: só leitura, rotulado como autorrelato --------------
  if (mode === "read") {
    return (
      <Card title="Contexto da sessão" accent={cor}>
        <Text style={styles.rotulo}>Autorrelato do paciente</Text>
        {nota ? (
          <Text style={styles.leitura}>{nota.note}</Text>
        ) : (
          <Text style={styles.vazio}>
            Este paciente não anotou o contexto desta sessão.
          </Text>
        )}
      </Card>
    );
  }

  // -- titular: escreve/edita a própria nota ----------------------------
  return (
    <Card title="Contexto da sessão" accent={cor}>
      <Text style={styles.lead}>
        Anote o que você estava fazendo ou sentindo — dá contexto às suas
        medidas. Só você e um profissional vinculado veem.
      </Text>
      <Field
        label="Sua anotação"
        value={texto}
        onChangeText={(v) => {
          setTexto(v);
          setSalvo(false);
        }}
        placeholder="Ex.: depois de meditar; dia corrido; dormi mal…"
        multiline
        numberOfLines={4}
        maxLength={MAX}
        error={erro}
      />
      <View style={styles.acoes}>
        <Button label="Salvar" onPress={salvar} loading={salvando} accent={cor} />
        {nota ? (
          <Button
            label="Remover"
            onPress={remover}
            variant="secondary"
            disabled={salvando}
          />
        ) : null}
      </View>
      {salvo ? <Text style={styles.salvo}>Anotação salva.</Text> : null}
    </Card>
  );
}

const criarEstilos = (t: Theme) =>
  StyleSheet.create({
    lead: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    rotulo: {
      ...t.typography.label,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    leitura: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 14,
      lineHeight: 20,
      marginTop: t.spacing.xs,
    },
    vazio: {
      ...t.typography.body,
      color: t.colors.textMuted,
      fontSize: 14,
      marginTop: t.spacing.xs,
    },
    acoes: {
      flexDirection: "row",
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    salvo: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xs,
    },
  });
