/**
 * Itens de navegação por papel (P6-a).
 *
 * Fonte única do que aparece na sidebar/drawer e do título do header por rota.
 * Espelha as rotas de `app/` e **respeita a separação de papéis** — a guarda de
 * `app/_layout.tsx` continua sendo a autoridade; isto só decide o que mostrar.
 */

import type { UserRole } from "../auth/api";
import { capturaDisponivel, espectadorDisponivel } from "../capture/availability";
import type { IconName } from "../components/Icon";

export type NavItem = {
  label: string;
  href: string;
  /**
   * Ícone de traço do conjunto "Maré".
   *
   * **Era um glifo Unicode** (`⌂`, `≡`, `✉`…) desde a P6-a, com a nota de que
   * os ícones viriam depois. Vieram na P8-b: caractere de fonte tem peso,
   * grade e desenho próprios de cada tipografia do sistema — ao lado de um
   * conjunto de traço, lê como outra família.
   */
  icon: IconName;
};

// Os pares rota→ícone são os do mockup: `Design/round1/inicio-paciente.html` e
// `inicio-profissional.html`.
const LIVE_ITEM: NavItem = { label: "Estado ao vivo", href: "/patient/live", icon: "wave" };
// "Assistir ao vivo" não existe no round 1 (é nosso, ADR-0039). `monitor` e
// não `users`: quem assiste aqui é o próprio titular, pelo navegador, a
// captação que corre no celular — a tela do aparelho é o assunto, não gente.
const WATCH_ITEM: NavItem = { label: "Assistir ao vivo", href: "/patient/watch", icon: "monitor" };

const PATIENT: NavItem[] = [
  { label: "Início", href: "/patient", icon: "home" },
  LIVE_ITEM,
  WATCH_ITEM,
  { label: "Histórico", href: "/patient/history", icon: "calendar" },
  { label: "Convites", href: "/patient/invites", icon: "mail" },
  { label: "Perfil", href: "/patient/profile", icon: "user" },
];

const DOCTOR: NavItem[] = [
  { label: "Início", href: "/doctor", icon: "home" },
  { label: "Convidar paciente", href: "/doctor/invite", icon: "userPlus" },
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
