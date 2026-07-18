/**
 * Tokens visuais mínimos do app.
 *
 * O design system completo (identidade por papel) é a issue #18 — aqui só o
 * suficiente para as telas placeholder ficarem legíveis.
 */

export const colors = {
  background: "#0B1220",
  surface: "#151E32",
  border: "#243049",
  text: "#F5F7FA",
  textMuted: "#9AA7BD",
  patient: "#4FD1C5",
  doctor: "#7AA2F7",
  warning: "#F2C94C",
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 16,
} as const;
