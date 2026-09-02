import { FEATURES } from "./features"

/**
 * Tab ids of the app shell (spec §3.6).
 *
 *  - «Китай»: home · find (Каталог) · plan (Мой план); `policy` is reachable
 *    only from the footer / onboarding, never from the menu.
 *  - Legacy ids stay so the European screens keep type-checking behind their
 *    flags: `p_*` are the «Мои программы» sub-tabs (market = europe),
 *    essay / resume are the AI screens (FEATURES.ai).
 *
 * «Настройки» is not a tab – it is a dialog opened from the menu.
 */
export type Tab = "home" | "find" | "plan" | "policy" | "p_saved" | "p_priority" | "essay" | "resume"

export interface NavItem {
  id: Tab
  /** Menu label (desktop rail). */
  label: string
  /** Short label for the mobile bottom bar. */
  short: string
}

const CHINA_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Главная", short: "Главная" },
  { id: "find", label: "Каталог", short: "Каталог" },
  { id: "plan", label: "Мой план", short: "План" },
]

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

/** Top-level menu entries for the current build flags (settings excluded – it is a dialog). */
export function mainTabs(features: { ai: boolean; market: string } = FEATURES): NavItem[] {
  const items: NavItem[] = [...CHINA_ITEMS]
  if (features.market === "europe") items.push({ id: "p_saved", label: "Мои программы", short: "Мои" })
  if (features.ai) items.push(...AI_ITEMS)
  return items
}

/** True when the tab is reachable under the current flags (guards stale state). */
export function tabEnabled(t: Tab, features: { ai: boolean; market: string } = FEATURES): boolean {
  if (t === "essay" || t === "resume") return features.ai
  if (isProgramsTab(t)) return features.market === "europe"
  return true
}
