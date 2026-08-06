/**
 * Ponto de entrada do design system (#18).
 *
 * Telas e componentes importam daqui — nunca de `tokens.ts` direto, e nunca
 * uma cor literal.
 */

export {
  ThemeProvider,
  useAccentFor,
  useRoleAccent,
  useTheme,
  type RoleAccent,
  type Theme,
} from "./ThemeProvider";
export { withAlpha } from "./color";
export {
  MIN_TOUCH,
  palettes,
  radius,
  shadows,
  spacing,
  typography,
  type Role,
  type ThemeName,
  type ThemePreference,
} from "./tokens";
