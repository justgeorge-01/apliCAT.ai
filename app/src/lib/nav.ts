import { FEATURES } from "./features"

/**
 * Tab ids of the app shell (spec §3.6, cabinet spec §4–5).
 *
 *  - «Китай»: home · find (Каталог) · plan (Мой план); `policy` is reachable
 *    only from the footer / onboarding, never from the menu.
 *  - Cabinet (FEATURES.accounts): `signin` (the magic-link screen), `profile`
 *    (replaces «Настройки» for a signed-in user), `mentor` (the mentor panel,
 *    members of an organization only), `delete` (the «Удалить аккаунт и все
 *    данные?» confirmation reached from the e-mail link).
 *  - Legacy ids stay so the European screens keep type-checking behind their
 *    flags: `p_*` are the «Мои программы» sub-tabs (market = europe),
 *    essay / resume are the AI screens (FEATURES.ai).
 *
 * «Настройки» is not a tab – it is a dialog opened from the menu.
 */
export type Tab =
  | "home"
  | "find"
  | "plan"
  | "policy"
  | "signin"
  | "profile"
  | "mentor"
  | "delete"
  | "p_saved"
  | "p_priority"
  | "essay"
  | "resume"

export interface NavItem {
  id: Tab
  /** Menu label (desktop rail). */
  label: string
  /** Short label for the mobile bottom bar. */
  short: string
}

/** Runtime state the menu depends on – who is signed in. */
export interface NavContext {
  /** A session exists (FEATURES.accounts). */
  signed?: boolean
  /** The signed-in user is a member of at least one organization. */
  member?: boolean
}

const CHINA_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Главная", short: "Главная" },
  { id: "find", label: "Каталог", short: "Каталог" },
  { id: "plan", label: "Мой план", short: "План" },
]

export const MENTOR_ITEM: NavItem = { id: "mentor", label: "Наставник", short: "Ученики" }

const AI_ITEMS: readonly NavItem[] = [
  { id: "essay", label: "Редактор эссе", short: "Эссе" },
  { id: "resume", label: "Сборка резюме", short: "Резюме" },
]

/** «Мои программы» (European market only) – shown as one menu entry with two sub-tabs. */
export const PROGRAMS_SUBTABS: readonly NavItem[] = [
  { id: "p_saved", label: "Сохранённые", short: "Мои" },
  { id: "p_priority", label: "Приоритеты и роадмап", short: "Мои" },
]

export function isProgramsTab(t: Tab): boolean {
  return t === "p_saved" || t === "p_priority"
}

type Flags = { ai: boolean; market: string; accounts?: boolean }

/** Top-level menu entries for the current build flags (settings excluded – it is a dialog). */
export function mainTabs(features: Flags = FEATURES, ctx: NavContext = {}): NavItem[] {
  const items: NavItem[] = [...CHINA_ITEMS]
  if (features.accounts && ctx.member) items.push(MENTOR_ITEM)
  if (features.market === "europe") items.push({ id: "p_saved", label: "Мои программы", short: "Мои" })
  if (features.ai) items.push(...AI_ITEMS)
  return items
}

/** True when the tab is reachable under the current flags and session (guards stale state). */
export function tabEnabled(t: Tab, features: Flags = FEATURES, ctx: NavContext = {}): boolean {
  if (t === "essay" || t === "resume") return features.ai
  if (isProgramsTab(t)) return features.market === "europe"
  if (t === "signin") return Boolean(features.accounts) && !ctx.signed
  if (t === "profile" || t === "delete") return Boolean(features.accounts) && Boolean(ctx.signed)
  if (t === "mentor") return Boolean(features.accounts) && Boolean(ctx.member)
  return true
}
