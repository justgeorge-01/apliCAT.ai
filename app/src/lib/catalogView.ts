/**
 * View helpers of the catalog screen (spec §3.2): filters, sorting, the words
 * shown for a profile match, and the coverage / provenance lines of a card.
 *
 * Pure functions, no DOM. Nothing here formats a fact VALUE – the storefront
 * prints `fact.display` as is; the one formatter (`formatCny`) is for the
 * reader's own budget slider, which is not a fact.
 *
 * Lives outside `pages/Find.tsx` because component files may export only
 * components (react-refresh rule) and these need unit tests.
 */
import type { CscaStatus } from "@/data/china"
import type { Fact, University } from "@/data/china.types"
import {
  amountMinorOf,
  currencyOf,
  cscaStatus,
  deadlineDateOf,
  factOf,
  factsOf,
  formatCheckedAt,
  isDeadlinePassed,
  lastChecked,
  scoreOf,
} from "@/data/china"
import type { ChinaProfile, MatchResult } from "@/lib/match"

/* ---------- filters ---------- */

export type LanguageFilter = "any" | "zh" | "en"
export type CscaFilter = "any" | "required" | "not_required" | "unknown"
export type SortKey = "deadline" | "tuition" | "name"

export interface CatalogFilters {
  /** Exact `University.city`; null = all. */
  city: string | null
  language: LanguageFilter
  csca: CscaFilter
  /** The university's minimal HSK must be ≤ this level; null = off. */
  hskMax: number | null
  /** Tuition per year (lower bound of a range) must be ≤ this budget in CNY; null = off. */
  budgetCny: number | null
  /** `funding.covers_tuition` must be true. */
  coversTuition: boolean
  /** The application deadline must not have passed. */
  deadlineOpen: boolean
  /** Keep universities that have not published the fact an active filter needs. */
  keepUnpublished: boolean
}

export const DEFAULT_FILTERS: CatalogFilters = {
  city: null,
  language: "any",
  csca: "any",
  hskMax: null,
  budgetCny: null,
  coversTuition: false,
  deadlineOpen: false,
  keepUnpublished: false,
}

/** HSK levels offered by the filter (HSK 3.0 goes up to 9; the profile may add its own). */
export const HSK_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6]

/** Budget slider bounds – the same range as the onboarding (spec §3.5), whole yuan. */
export const BUDGET_MIN = 10_000
export const BUDGET_MAX = 150_000
export const BUDGET_STEP = 5_000

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)

type Verdict = "pass" | "fail" | "unknown"

/** Languages of instruction a university publishes (a fact may name both). */
export function languagesOf(u: University): Set<"zh" | "en"> {
  const out = new Set<"zh" | "en">()
  for (const f of factsOf(u, "requirements.language_of_instruction")) {
    const raw = "value" in f.value && typeof f.value.value === "string" ? f.value.value : f.display
    const s = raw.toLowerCase()
    if (/chin|mandarin|кит|中文|汉语/.test(s)) out.add("zh")
    if (/engl|англ/.test(s)) out.add("en")
  }
  return out
}

function languageVerdict(u: University, want: LanguageFilter): Verdict {
  if (want === "any") return "pass"
  if (factsOf(u, "requirements.language_of_instruction").length === 0) return "unknown"
  const langs = languagesOf(u)
  if (langs.size === 0) return "unknown"
  return langs.has(want) ? "pass" : "fail"
}

function cscaVerdict(u: University, want: CscaFilter): Verdict {
  if (want === "any") return "pass"
  return cscaStatus(u) === want ? "pass" : "fail"
}

function hskVerdict(u: University, max: number | null): Verdict {
  if (max === null) return "pass"
  const f = factOf(u, "requirements.hsk_min")
  if (!f) return "unknown"
  const min = scoreOf(f.value)
  if (min === null) return "unknown"
  return min <= max ? "pass" : "fail"
}

function budgetVerdict(u: University, budgetCny: number | null): Verdict {
  if (budgetCny === null) return "pass"
  const f = factOf(u, "fees.tuition_year_non_eu")
  if (!f) return "unknown"
  const minor = amountMinorOf(f.value)
  if (minor === null || currencyOf(f.value) !== "CNY") return "unknown"
  return minor <= budgetCny * 100 ? "pass" : "fail"
}

function coversVerdict(u: University, on: boolean): Verdict {
  if (!on) return "pass"
  const f = factOf(u, "funding.covers_tuition")
  if (!f) return "unknown"
  const v = "value" in f.value ? f.value.value : undefined
  if (typeof v !== "boolean") return "unknown"
  return v ? "pass" : "fail"
}

function deadlineVerdict(u: University, on: boolean, now: Date): Verdict {
  if (!on) return "pass"
  const f = factOf(u, "deadline.fall.application_non_eu")
  if (!f) return "unknown"
  const date = deadlineDateOf(f.value)
  if (!date) return "unknown"
  return isDeadlinePassed(date, now) ? "fail" : "pass"
}

export type FilterVerdict = "pass" | "fail" | "unpublished"

/**
 * `fail` – a published fact contradicts an active filter; `unpublished` – no
 * contradiction, but some active filter has no fact to check (the university
 * did not publish it); `pass` – every active filter is confirmed by a fact.
 */
export function evaluateFilters(u: University, f: CatalogFilters, now: Date): FilterVerdict {
  if (f.city && u.city !== f.city) return "fail"
  const verdicts: Verdict[] = [
    languageVerdict(u, f.language),
    cscaVerdict(u, f.csca),
    hskVerdict(u, f.hskMax),
    budgetVerdict(u, f.budgetCny),
    coversVerdict(u, f.coversTuition),
    deadlineVerdict(u, f.deadlineOpen, now),
  ]
  if (verdicts.includes("fail")) return "fail"
  return verdicts.includes("unknown") ? "unpublished" : "pass"
}

export interface FilterOutcome {
  shown: University[]
  /** Universities hidden only because they have not published a fact a filter needs. */
  hiddenUnpublished: number
}

export function applyFilters(list: readonly University[], f: CatalogFilters, now: Date): FilterOutcome {
  const shown: University[] = []
  let hiddenUnpublished = 0
  for (const u of list) {
    const v = evaluateFilters(u, f, now)
    if (v === "pass" || (v === "unpublished" && f.keepUnpublished)) shown.push(u)
    else if (v === "unpublished") hiddenUnpublished++
  }
  return { shown, hiddenUnpublished }
}

/** True when at least one filter differs from the defaults (ignoring `keepUnpublished`). */
export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.city !== null ||
    f.language !== "any" ||
    f.csca !== "any" ||
    f.hskMax !== null ||
    f.budgetCny !== null ||
    f.coversTuition ||
    f.deadlineOpen
  )
}

/* ---------- search / lists ---------- */

export function displayName(u: University): string {
  return u.name_ru ?? u.name
}

export function matchesQuery(u: University, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [u.name, u.name_ru ?? "", u.city].some((x) => x.toLowerCase().includes(s))
}

export function cityList(list: readonly University[]): string[] {
  return [...new Set(list.map((u) => u.city).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

/* ---------- sorting ---------- */

function byName(a: University, b: University): number {
  return displayName(a).localeCompare(displayName(b), "ru")
}

/**
 * `deadline` – soonest upcoming first, then passed, then unpublished;
 * `tuition` – cheapest first (lower bound of a range), unpublished last;
 * `name` – Russian name.
 */
export function sortUniversities(list: readonly University[], sort: SortKey, now: Date): University[] {
  const arr = [...list]
  if (sort === "name") return arr.sort(byName)

  if (sort === "tuition") {
    const key = (u: University): number | null => {
      const f = factOf(u, "fees.tuition_year_non_eu")
      return f ? amountMinorOf(f.value) : null
    }
    return arr.sort((a, b) => {
      const ka = key(a)
      const kb = key(b)
      if (ka === null && kb === null) return byName(a, b)
      if (ka === null) return 1
      if (kb === null) return -1
      return ka - kb || byName(a, b)
    })
  }

  const rank = (u: University): { group: number; date: string } => {
    const f = factOf(u, "deadline.fall.application_non_eu")
    const date = f ? deadlineDateOf(f.value) : null
    if (!date) return { group: 2, date: "" }
    return { group: isDeadlinePassed(date, now) ? 1 : 0, date }
  }
  return arr.sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    return ra.group - rb.group || ra.date.localeCompare(rb.date) || byName(a, b)
  })
}

/* ---------- profile ---------- */

/** A profile with at least one field the match can use (language «any» counts). */
export function profileIsFilled(p: ChinaProfile | null | undefined): p is ChinaProfile {
  if (!p || typeof p !== "object") return false
  const has = (x: unknown) => x !== null && x !== undefined && x !== ""
  return has(p.language) || has(p.hsk) || has(p.ielts) || has(p.budget_year_cny) || has(p.degree)
}

/** Numbers in Russian: 6.5 → «6,5», 5 → «5». */
/** IELTS bands as printed on the certificate (and in the onboarding): 6.0, 6.5. */
function ieltsBand(n: number): string {
  return n.toFixed(1)
}

/** The reader's own profile, in words – shown above the catalog so it is clear what the match compares against. */
export function profileSummary(p: ChinaProfile): string[] {
  const parts: string[] = []
  if (p.degree) parts.push(p.degree === "master" ? "магистратура" : "бакалавриат")
  if (isNum(p.year)) parts.push(`подача в ${p.year}`)
  if (p.language)
    parts.push(
      p.language === "zh"
        ? "обучение на китайском"
        : p.language === "en"
          ? "обучение на английском"
          : "язык обучения любой",
    )
  if (isNum(p.hsk)) parts.push(`HSK ${p.hsk}`)
  if (isNum(p.ielts)) parts.push(`IELTS ${ieltsBand(p.ielts)}`)
  if (isNum(p.budget_year_cny)) parts.push(`бюджет до ${formatCny(p.budget_year_cny)} в год`)
  return parts
}

/* ---------- match wording ---------- */

export type MatchTone = "ok" | "gaps" | "unknown"

export interface MatchSummary {
  tone: MatchTone
  /** One line in words – no counts, no tiers, no probabilities. */
  text: string
}

/**
 * The one-line verdict of a card. CSCA lines in `ok` are informational
 * (match.ts never makes them a gap), so a university that published only its
 * CSCA status still reads as «проверять нечего».
 */
export function matchSummary(r: MatchResult): MatchSummary {
  if (r.gaps.length > 0) return { tone: "gaps", text: "есть расхождения" }
  const formalOk = r.ok.filter((line) => !/^CSCA/.test(line))
  if (formalOk.length > 0) {
    return r.unknown.length > 0
      ? { tone: "ok", text: "формальные условия совпадают, часть не проверена" }
      : { tone: "ok", text: "формальные условия совпадают" }
  }
  return { tone: "unknown", text: "условия не опубликованы, проверять нечего" }
}

/* ---------- coverage / provenance lines ---------- */

export interface CoverageText {
  published: number
  /** «7 из 8 фактов проверено» or «данные не опубликованы». */
  facts: string
  /** «проверено 31 августа 2026» / «проверка не проводилась» / «дата проверки не указана». */
  checked: string
}

export function coverageText(u: University): CoverageText {
  const { published, expected } = u.coverage
  const lc = lastChecked(u)
  if (published <= 0) {
    return {
      published: 0,
      facts: "данные не опубликованы",
      checked: lc ? `проверено ${formatCheckedAt(lc)}` : "проверка не проводилась",
    }
  }
  return {
    published,
    facts: `${published} из ${expected} фактов проверено`,
    checked: lc ? `проверено ${formatCheckedAt(lc)}` : "дата проверки не указана",
  }
}

/** Compact provenance of one fact for a card row (the detail page has the full badge). */
export function provenanceText(f: Fact): string {
  const date = formatCheckedAt(f.verified_at)
  if (f.origin === "demo") return `демо · ${date}`
  if (f.snapshot?.render_method === "wayback")
    return `по архивной копии от ${formatCheckedAt(f.snapshot.archived_at ?? f.verified_at)}`
  if (f.origin === "manual") return `проверено вручную · ${date}`
  return `проверено · ${date}`
}

/** Text of an empty card row – never a skipped row (spec §3.3). */
export function emptyFactText(u: University): string {
  const lc = lastChecked(u)
  return lc ? `не опубликовано · проверено ${formatCheckedAt(lc)}` : "не опубликовано · проверка не проводилась"
}

/** The CSCA row without a `csca_required` fact: «вуз не заявил, проверено <дата>» (spec §3.3). */
export function cscaEmptyText(u: University): string {
  const lc = lastChecked(u)
  return lc ? `вуз не заявил · проверено ${formatCheckedAt(lc)}` : "вуз не заявил · проверка не проводилась"
}

/* ---------- CSCA status: one colour system on every screen ---------- */

/**
 * How the three CSCA states are painted – the single source of truth for the
 * landing, the catalog card and the university card, so «CSCA требуется» is
 * never amber in one place and red in another. Printed-label look, no icons:
 * «требуется» is a red label with a thin red rim, «не требуется» an ink
 * contour, «не опубликовано» a dashed contour – told apart by colour AND by
 * the words. Informational only – never a verdict about the applicant.
 */
export const CSCA_BADGE: Record<CscaStatus, { variant: "default" | "outline"; className: string }> = {
  required: { variant: "default", className: "border-accent/40 font-semibold" },
  not_required: { variant: "outline", className: "border-fg/40 text-fg" },
  unknown: { variant: "outline", className: "border-dashed text-fg-muted" },
}

/** The ONE wording of the three CSCA states – landing, catalog card and university card all print this. */
export const CSCA_LABEL: Record<CscaStatus, string> = {
  required: "CSCA требуется",
  not_required: "CSCA не требуется",
  unknown: "CSCA не опубликовано",
}

/* ---------- misc ---------- */

const NBSP = " "

/** The reader's budget (whole yuan) for the slider label – NOT used for facts. */
export function formatCny(n: number): string {
  const whole = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${whole}${NBSP}¥`
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}
