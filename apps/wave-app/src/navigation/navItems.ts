/**
 * Itens de navegação por papel (P6-a).
 *
 * Fonte única do que aparece na sidebar/drawer e do título do header por rota.
 * Espelha as rotas de `app/` e **respeita a separação de papéis** — a guarda de
 * `app/_layout.tsx` continua sendo a autoridade; isto só decide o que mostrar.
 */

import type { UserRole } from "../auth/api";
import { capturaDisponivel, espectadorDisponivel } from "../capture/availability";

export type NavItem = {
  label: string;
  href: string;
  /** Glifo monocromático (identidade fina; ícones de marca vêm na P6-c). */
  icon: string;
};

const LIVE_ITEM: NavItem = { label: "Estado ao vivo", href: "/patient/live", icon: "◉" };
const WATCH_ITEM: NavItem = { label: "Assistir ao vivo", href: "/patient/watch", icon: "◉" };

const PATIENT: NavItem[] = [
  { label: "Início", href: "/patient", icon: "⌂" },
  LIVE_ITEM,
  WATCH_ITEM,
  { label: "Histórico", href: "/patient/history", icon: "≡" },
  { label: "Convites", href: "/patient/invites", icon: "✉" },
  { label: "Perfil", href: "/patient/profile", icon: "◔" },
];

const DOCTOR: NavItem[] = [
  { label: "Início", href: "/doctor", icon: "⌂" },
  { label: "Convidar paciente", href: "/doctor/invite", icon: "✚" },
];

export function navItemsFor(role: UserRole): NavItem[] {
  if (role === "doctor") return DOCTOR;
  // Superfície por plataforma: "Estado ao vivo" (captação) só onde se capta
  // (P6-b); "Assistir ao vivo" (espectador) só no web (ADR-0039).
  const capta = capturaDisponivel();
  const assiste = espectadorDisponivel();
  return PATIENT.filter(
    (i) => (i !== LIVE_ITEM || capta) && (i !== WATCH_ITEM || assiste),
  );
}

/** Títulos de rotas de detalhe, que não são itens de navegação. */
const TITULOS_EXTRA: Array<{ prefixo: string; titulo: string }> = [
  { prefixo: "/patient/consent", titulo: "Consentimento" },
  { prefixo: "/doctor/patient", titulo: "Paciente" },
  // Título estável mesmo quando o item sai da nav (captação gated — P6-b).
  { prefixo: "/patient/live", titulo: "Estado ao vivo" },
  // Ferramenta de dev fora da nav (gated — ADR-0040).
  { prefixo: "/patient/ble-diag", titulo: "Diagnóstico BLE" },
];

/**
 * Casa a rota com um item. A **raiz do papel** (ex.: `/patient`, 1 segmento)
 * casa só exatamente — senão engoliria toda `/patient/*`; itens mais fundos
 * (`/patient/live`) casam também suas sub-rotas.
 */
function combina(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  const segmentos = href.split("/").filter(Boolean);
  return segmentos.length >= 2 && pathname.startsWith(`${href}/`);
}

/** Href do item de navegação ativo (para destacar na lista). `null` = detalhe. */
export function activeHref(pathname: string, role: UserRole): string | null {
  const item = [...navItemsFor(role)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => combina(pathname, i.href));
  return item?.href ?? null;
}

/** Título da seção atual para o header, a partir do pathname resolvido. */
export function routeTitle(pathname: string, role: UserRole): string {
  const item = [...navItemsFor(role)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => combina(pathname, i.href));
  if (item) return item.label;
  const extra = TITULOS_EXTRA.find((e) => pathname.startsWith(e.prefixo));
  return extra?.titulo ?? "WaveAI";
}
