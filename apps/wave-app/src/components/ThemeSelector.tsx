import { Icon } from "./Icon";
import { SegmentedFilter, type SegmentedOption } from "./SegmentedFilter";
import { useRoleAccent, useTheme, type ThemePreference } from "../theme";

/**
 * Escolha de tema: seguir o sistema (padrão) ou fixar claro/escuro.
 *
 * **Por que existe:** o `userInterfaceStyle` do Expo é resolvido em tempo de
 * build e, no Android, depende de `expo-system-ui` — dependência nativa. Sem
 * ela o app fica preso a um tema no aparelho, por mais que o sistema mude.
 * Este seletor é puro JavaScript, então funciona em qualquer build já
 * instalado, e mantém "seguir o sistema" como padrão.
 *
 * A forma é a do design "Maré": um segmentado, o mesmo controle do filtro de
 * período — dois controles idênticos em função não deveriam ter dois desenhos.
 */

export function ThemeSelector() {
  const t = useTheme();
  const { accent } = useRoleAccent();

  // Ordem do design: os dois temas concretos primeiro, "Sistema" como saída.
  const opcoes: SegmentedOption<ThemePreference>[] = [
    { value: "light", label: "Claro", icon: <Glifo nome="sun" preferencia="light" /> },
    { value: "dark", label: "Escuro", icon: <Glifo nome="moon" preferencia="dark" /> },
    {
      value: "system",
      label: "Sistema",
      icon: <Glifo nome="monitor" preferencia="system" />,
    },
  ];

  return (
    <SegmentedFilter
      options={opcoes}
      value={t.preference}
      onChange={t.setPreference}
      label="Tema"
      accent={accent}
      fill
    />
  );
}

/** Glifo da opção, tingido quando ela é a escolhida. */
function Glifo({
  nome,
  preferencia,
}: {
  nome: "sun" | "moon" | "monitor";
  preferencia: ThemePreference;
}) {
  const t = useTheme();
  const { accent } = useRoleAccent();
  const ativo = t.preference === preferencia;

  return <Icon name={nome} size={15} color={ativo ? accent : t.colors.textMuted} />;
}
