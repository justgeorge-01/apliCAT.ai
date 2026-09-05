/**
 * Types 1:1 with the storefront export `app/public/data/china.json`
 * (pipeline task 26 §5, `export:catalog`).
 *
 * Invariants the UI relies on:
 *  - the storefront NEVER formats a fact value – it prints `display` as is;
 *  - every fact carries `source_url` + `verified_at`; a fact without them is
 *    an export bug and is dropped on load (see `normalizeCatalog` in china.ts),
 *    so nothing without provenance ever reaches a screen.
 */

/**
 * Keys of the university card v1 (task 26 §7) plus `docs.required_list`,
 * which «Мой план» merges into its document checklist when the export has it.
 */
export type FactKey =
  | "deadline.fall.application_non_eu"
  | "fees.tuition_year_non_eu"
  | "requirements.language_of_instruction"
  | "requirements.hsk_min"
  | "requirements.ielts_min"
  | "requirements.csca_required"
  | "requirements.csca_subjects"
  | "funding.covers_tuition"
  | "funding.amount_month"
  | "deadline.scholarship"
  | "fees.dormitory_month"
  | "docs.required_list"

/* ---------- value shapes (mirror @admitica/core fields.ts) ---------- */

/** Money – integer minor units + ISO-4217 code. */
export interface MoneyValue {
  amount_minor: number
  currency: string
}
/** Entity-level money rollup across programmes (min–max). */
export interface MoneyRangeValue {
  amount_minor_min: number
  amount_minor_max: number
  currency: string
}
/** Calendar date, ISO `YYYY-MM-DD`. */
export interface DateValue {
  date: string
}
/** Entity-level date rollup (earliest–latest). */
export interface DateRangeValue {
  date_min: string
  date_max: string
}
/** Test score (HSK level, IELTS band, …). */
export interface ScoreValue {
  value: number
}
export interface BooleanValue {
  value: boolean
}
/** One value from a fixed per-key vocabulary (e.g. language of instruction). */
export interface EnumValue {
  value: string
}
export interface ListValue {
  items: string[]
}

export type FactValue =
  | MoneyValue
  | MoneyRangeValue
  | DateValue
  | DateRangeValue
  | ScoreValue
  | BooleanValue
  | EnumValue
  | ListValue

/* ---------- provenance ---------- */

/**
 * `auto` – extracted by the pipeline from a snapshot; `manual` – typed in by an
 * operator (Пульт); `demo` – the built-in fixture (china.fixture.ts), shown with
 * a plainly grey «демо» badge and never mixed with pipeline data.
 */
export type FactOrigin = "auto" | "manual" | "demo"

/** Mirrors `CERTAINTY_LEVELS` in @admitica/core scope.ts; `verified` is the only one the card shows without a caveat. */
export type FactCertainty = "verified" | "estimate" | "community_estimate"

/**
 * How the source page was read. `wayback` means the official page was
 * unreachable and the fact comes from an archive.org copy – the UI must say
 * «по архивной копии от <archived_at>».
 */
export type RenderMethod = "fetch" | "browser" | "wayback" | "pdf"

export interface FactSnapshot {
  render_method: RenderMethod
  fetched_at: string | null
  /** Date of the archive copy when `render_method === "wayback"`, else null. */
  archived_at: string | null
}

export type DegreeScope = "bachelor" | "master" | "phd" | "mba" | "other" | "all"

export interface Fact {
  key: FactKey
  /** Russian label from the exporter's dictionary – the only place labels live. */
  label_ru: string
  /** Raw value; used ONLY for filters/matching and the single «год в Китае» estimate. */
  value: FactValue
  /** Ready-to-print string from the pipeline's `formatFactValue()`. Print this. */
  display: string
  /** e.g. "2026/2027"; null when the page did not state one. */
  academic_year: string | null
  /**
   * The degree level the value holds for (pipeline task 23) – a university
   * publishes one tuition for bachelors and another for an MBA, and the two are
   * two facts. null = the page did not say; "all" = stated for every level.
   */
  degree_scope?: DegreeScope | null
  /** Application round the deadline belongs to (task 23b); null = no rounds. */
  intake_round?: number | null
  /** Verbatim quote from the source page; null only for demo facts without one. */
  quote: string | null
  /** Official page the fact was read from – always the university's own URL. */
  source_url: string
  /** ISO timestamp (or date) when the fact was published/verified. */
  verified_at: string
  origin: FactOrigin
  certainty: FactCertainty
  /** null for manual facts (no snapshot) and for demo facts. */
  snapshot: FactSnapshot | null
}

export interface Coverage {
  /** How many card keys have a published fact. */
  published: number
  /** Number of card keys v1 – comes from the exporter, not computed here. */
  expected: number
}

export interface University {
  /** Stable slug, e.g. "tsinghua". */
  id: string
  name: string
  name_ru: string | null
  city: string
  /** ISO country code, "CN" for every university in this catalog. */
  country: string
  website: string
  /** max(snapshots.fetched_at) over approved sources; null when nothing was ever fetched. */
  last_checked_at: string | null
  facts: Fact[]
  coverage: Coverage
}

export interface Catalog {
  generated_at: string
  prompt_version: number
  universities: University[]
  /** true only for the built-in fixture – the UI shows the «демо-данные» banner. */
  demo?: boolean
}
