/**
 * Data layer of the «Китай» storefront.
 *
 * The only data source is `app/public/data/china.json`, produced by the
 * pipeline (`export:catalog`). When the file is missing (local dev, a build
 * before the first export) the built-in fixture is served with `demo: true`
 * and the UI shows the «демо-данные» banner.
 *
 * Rules enforced here so no screen can break them by accident:
 *  - a fact without `source_url` / `verified_at` / `display` is dropped on load;
 *  - the storefront prints `fact.display`; the helpers below read `value`
 *    ONLY for filters, matching and the single «год в Китае» estimate.
 */
import type {
  Catalog,
  Fact,
  FactKey,
  FactValue,
  MoneyValue,
  University,
} from "./china.types"
import { FIXTURE_CATALOG } from "./china.fixture"

/* ---------- card layout constants ---------- */

/** Card v1 keys (task 26 §7). `coverage.expected` in the JSON is computed from the same list by the exporter. */
export const CARD_KEYS: readonly FactKey[] = [
  "deadline.fall.application_non_eu",
  "fees.tuition_year_non_eu",
  "requirements.language_of_instruction",
  "requirements.hsk_min",
  "requirements.ielts_min",
  "requirements.csca_required",
  "requirements.csca_subjects",
  "funding.covers_tuition",
  "funding.amount_month",
  "deadline.scholarship",
  "fees.dormitory_month",
]

/** Critical keys – deadlines, HSK/IELTS gates, CSCA. Shown with «сверьтесь с сайтом вуза перед подачей». */
export const criticalKeys: readonly FactKey[] = [
  "deadline.fall.application_non_eu",
  "deadline.scholarship",
  "requirements.hsk_min",
  "requirements.ielts_min",
  "requirements.csca_required",
]

export function isCriticalKey(key: string): boolean {
  return (criticalKeys as readonly string[]).includes(key)
}

/** Russian labels for card rows that have NO fact (an empty fact has no `label_ru`). */
export const FACT_LABELS_RU: Record<FactKey, string> = {
  "deadline.fall.application_non_eu": "Дедлайн подачи (иностранцы)",
  "fees.tuition_year_non_eu": "Стоимость обучения в год (иностранцы)",
  "requirements.language_of_instruction": "Язык обучения",
  "requirements.hsk_min": "Минимальный HSK",
  "requirements.ielts_min": "Минимальный IELTS",
  "requirements.csca_required": "Требуется CSCA",
  "requirements.csca_subjects": "Модули CSCA",
  "funding.covers_tuition": "Стипендия покрывает обучение",
  "funding.amount_month": "Стипендия в месяц",
  "deadline.scholarship": "Дедлайн на стипендию",
  "fees.dormitory_month": "Общежитие в месяц",
  "docs.required_list": "Требуемые документы",
}

export interface CardRow {
  id: "deadline" | "tuition" | "language" | "csca" | "scholarship" | "dormitory"
  label_ru: string
  keys: readonly FactKey[]
}

/** The six rows of the university card (spec §3.3), in order. */
export const CARD_ROWS: readonly CardRow[] = [
  { id: "deadline", label_ru: "Дедлайн подачи", keys: ["deadline.fall.application_non_eu"] },
  { id: "tuition", label_ru: "Стоимость обучения в год", keys: ["fees.tuition_year_non_eu"] },
  {
    id: "language",
    label_ru: "Язык обучения и сертификат",
    keys: ["requirements.language_of_instruction", "requirements.hsk_min", "requirements.ielts_min"],
  },
  { id: "csca", label_ru: "CSCA", keys: ["requirements.csca_required", "requirements.csca_subjects"] },
  {
    id: "scholarship",
    label_ru: "Стипендия",
    keys: ["funding.covers_tuition", "funding.amount_month", "deadline.scholarship"],
  },
  { id: "dormitory", label_ru: "Общежитие в месяц", keys: ["fees.dormitory_month"] },
]

/* ---------- loading ---------- */

export const CATALOG_FILE = "data/china.json"

/** Resolved against Vite's base (`./` on Pages), so it works under any repo sub-path. */
export function catalogUrl(): string {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? "./"
  return base.endsWith("/") ? base + CATALOG_FILE : base + "/" + CATALOG_FILE
}

let cache: Promise<Catalog> | null = null

/**
 * Fetch the exported catalog once per page load (in-memory cache). Any failure
 * – missing file, 404 HTML from Pages, malformed JSON – falls back to the
 * fixture with `demo: true`. Never throws.
 */
export function loadCatalog(): Promise<Catalog> {
  if (!cache) {
    cache = fetchCatalog().catch((err: unknown) => {
      if (import.meta.env.DEV) console.warn("[china] catalog not available, using fixture:", err)
      return demoCatalog()
    })
  }
  return cache
}

/** Forget the cached catalog – tests / hot reload only. */
export function resetCatalogCache(): void {
  cache = null
}

/** The built-in fixture, sanitized the same way as a real export. */
export function demoCatalog(): Catalog {
  return { ...normalizeCatalog(FIXTURE_CATALOG), demo: true }
}

async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch(catalogUrl(), { cache: "no-cache" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  if (type && !/json/i.test(type)) throw new Error(`not JSON: ${type}`)
  return normalizeCatalog(await res.json())
}

/* ---------- validation ---------- */

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x)
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x : null)

const ORIGINS = new Set(["auto", "manual", "demo"])
const CERTAINTIES = new Set(["verified", "estimate", "community_estimate"])
const RENDER_METHODS = new Set(["fetch", "browser", "wayback"])

/**
 * A fact the UI is allowed to render: has a key, a printable `display`, an
 * object `value`, and provenance (`source_url` + `verified_at`).
 */
export function hasProvenance(f: unknown): f is Fact {
  if (!isRec(f)) return false
  return Boolean(str(f.key) && str(f.display) && isRec(f.value) && str(f.source_url) && str(f.verified_at))
}

function normalizeFact(raw: unknown, uniId: string): Fact | null {
  if (!hasProvenance(raw)) {
    if (import.meta.env.DEV) console.warn(`[china] ${uniId}: dropped fact without provenance`, raw)
    return null
  }
  const r = raw as unknown as Rec
  const key = r.key as FactKey
  const snap = isRec(r.snapshot) ? r.snapshot : null
  return {
    key,
    label_ru: str(r.label_ru) ?? FACT_LABELS_RU[key] ?? key,
    value: r.value as FactValue,
    display: r.display as string,
    academic_year: str(r.academic_year),
    quote: str(r.quote),
    source_url: r.source_url as string,
    verified_at: r.verified_at as string,
    origin: ORIGINS.has(r.origin as string) ? (r.origin as Fact["origin"]) : "auto",
    certainty: CERTAINTIES.has(r.certainty as string) ? (r.certainty as Fact["certainty"]) : "verified",
    snapshot:
      snap && RENDER_METHODS.has(snap.render_method as string)
        ? {
            render_method: snap.render_method as NonNullable<Fact["snapshot"]>["render_method"],
            fetched_at: str(snap.fetched_at),
            archived_at: str(snap.archived_at),
          }
        : null,
  }
}

function normalizeUniversity(raw: unknown): University | null {
  if (!isRec(raw)) return null
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return null
  const facts = Array.isArray(raw.facts)
    ? raw.facts.map((f) => normalizeFact(f, id)).filter((f): f is Fact => f !== null)
    : []
  const cov = isRec(raw.coverage) ? raw.coverage : null
  return {
    id,
    name,
    name_ru: str(raw.name_ru),
    city: str(raw.city) ?? "",
    country: str(raw.country) ?? "CN",
    website: str(raw.website) ?? "",
    last_checked_at: str(raw.last_checked_at),
    facts,
    coverage: {
      published: typeof cov?.published === "number" ? cov.published : facts.length,
      expected: typeof cov?.expected === "number" ? cov.expected : CARD_KEYS.length,
    },
  }
}

/**
 * Validate an export payload. Throws on a non-catalog; silently drops
 * universities without id/name and facts without provenance (with a dev warning).
 */
export function normalizeCatalog(raw: unknown): Catalog {
  if (!isRec(raw) || !Array.isArray(raw.universities)) throw new Error("not a catalog")
  const universities = raw.universities
    .map(normalizeUniversity)
    .filter((u): u is University => u !== null)
  return {
    generated_at: str(raw.generated_at) ?? "",
    prompt_version: typeof raw.prompt_version === "number" ? raw.prompt_version : 0,
    universities,
    ...(raw.demo === true ? { demo: true } : {}),
  }
}

/* ---------- fact accessors ---------- */

export function factsOf(u: University, key: FactKey): Fact[] {
  return u.facts.filter((f) => f.key === key)
}

/** First published fact for the key, or undefined (→ UI shows «вуз не публикует»). */
export function factOf(u: University, key: FactKey): Fact | undefined {
  return u.facts.find((f) => f.key === key)
}

/** ISO timestamp of the last successful check, or null (→ «не опубликовано»). */
export function lastChecked(u: University): string | null {
  return u.last_checked_at
}

export function findUniversity(catalog: Catalog, id: string): University | undefined {
  return catalog.universities.find((u) => u.id === id)
}

export type CscaStatus = "required" | "not_required" | "unknown"

export function cscaStatus(u: University): CscaStatus {
  const f = factOf(u, "requirements.csca_required")
  if (!f || !("value" in f.value) || typeof f.value.value !== "boolean") return "unknown"
  return f.value.value ? "required" : "not_required"
}

/* ---------- raw-value readers (filters / matching / the one estimate) ---------- */

/** Lower bound of a money fact in minor units (a range → its minimum). */
export function amountMinorOf(value: FactValue): number | null {
  if ("amount_minor" in value && typeof value.amount_minor === "number") return value.amount_minor
  if ("amount_minor_min" in value && typeof value.amount_minor_min === "number") return value.amount_minor_min
  return null
}

export function currencyOf(value: FactValue): string | null {
  return "currency" in value && typeof value.currency === "string" ? value.currency : null
}

/** The date a deadline fact refers to (a range → its latest date), ISO `YYYY-MM-DD`. */
export function deadlineDateOf(value: FactValue): string | null {
  if ("date" in value && typeof value.date === "string") return value.date
  if ("date_max" in value && typeof value.date_max === "string") return value.date_max
  return null
}

export function scoreOf(value: FactValue): number | null {
  return "value" in value && typeof value.value === "number" ? value.value : null
}

/** The application deadline fact of a university, if published. */
export function applicationDeadline(u: University): Fact | undefined {
  return factOf(u, "deadline.fall.application_non_eu")
}

/* ---------- dates (metadata, not fact values) ---------- */

const pad = (n: number) => String(n).padStart(2, "0")

/** Local calendar date of `d` as ISO `YYYY-MM-DD`. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function utcOf(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Whole days from `now` (local date) to an ISO date; negative when it is in the past. */
export function daysUntil(iso: string, now: Date): number | null {
  const target = utcOf(iso)
  const from = utcOf(isoDate(now))
  if (target === null || from === null) return null
  return Math.round((target - from) / 86_400_000)
}

/** A deadline day is inclusive: it has passed only after that calendar day. */
export function isDeadlinePassed(iso: string, now: Date): boolean {
  const d = daysUntil(iso, now)
  return d !== null && d < 0
}

const RU_MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
]

/**
 * Renders a PROVENANCE date («проверено · 31 августа 2026») – metadata, not a
 * fact value. Accepts an ISO date or timestamp; anything else is returned as is.
 */
export function formatCheckedAt(iso: string | null | undefined): string {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const month = RU_MONTHS_GEN[Number(m[2]) - 1]
  return month ? `${Number(m[3])} ${month} ${m[1]}` : iso
}

/* ---------- the single computed number ---------- */

const NBSP = " "

function groupThousands(n: number): string {
  return String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

export interface YearEstimate extends MoneyValue {
  /** Ready-to-print sum, e.g. "93 000 ¥". The UI MUST add the word «оценка». */
  display: string
}

/**
 * «Год в Китае ≈ обучение + 12 × общежитие» – the ONLY number the storefront
 * computes. Needs both facts in the same currency; a tuition range uses its
 * minimum. Returns null otherwise.
 */
export function yearInChinaEstimate(u: University): YearEstimate | null {
  const tuition = factOf(u, "fees.tuition_year_non_eu")
  const dorm = factOf(u, "fees.dormitory_month")
  if (!tuition || !dorm) return null
  const t = amountMinorOf(tuition.value)
  const d = amountMinorOf(dorm.value)
  const cur = currencyOf(tuition.value)
  if (t === null || d === null || !cur || cur !== currencyOf(dorm.value)) return null
  const amount_minor = t + d * 12
  const whole = groupThousands(amount_minor / 100)
  const display = cur === "CNY" ? `${whole}${NBSP}¥` : `${whole}${NBSP}${cur}`
  return { amount_minor, currency: cur, display }
}
