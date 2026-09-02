/**
 * Formal profile ↔ university match (spec §3.2). A pure function: for every
 * published fact it answers «подходит» / «не хватает» / «не проверено» and
 * NOTHING else – no probabilities, no tiers, no «шансы». A missing fact is
 * always `unknown`, never a gap.
 */
import type { University } from "@/data/china.types"
import {
  amountMinorOf,
  currencyOf,
  cscaStatus,
  deadlineDateOf,
  factOf,
  isDeadlinePassed,
  scoreOf,
} from "@/data/china"

/* ---------- profile (onboarding §3.5) ---------- */

export type Degree = "bachelor" | "master"
/** Preferred language of instruction: Chinese / English / any. */
export type LanguagePref = "zh" | "en" | "any"

/** Stored in `localStorage["admitica.cn.profile"]` by the onboarding. All fields optional. */
export interface ChinaProfile {
  degree?: Degree | null
  /** Application year, e.g. 2026. */
  year?: number | null
  /** Field of study id from the onboarding list. */
  field?: string | null
  language?: LanguagePref | null
  /** HSK level 1–9 (HSK 3.0), null/undefined = none. */
  hsk?: number | null
  /** IELTS band, e.g. 6.5; null/undefined = none. */
  ielts?: number | null
  /** Budget per year in CNY (whole yuan). */
  budget_year_cny?: number | null
}

/** persist.ts key (→ `admitica.cn.profile`). */
export const PROFILE_KEY = "cn.profile"

export interface MatchResult {
  /** Formal conditions met (and informational lines such as CSCA). */
  ok: string[]
  /** Formal conditions NOT met by published facts. */
  gaps: string[]
  /** Not checkable: the university has not published the fact or the profile lacks the value. */
  unknown: string[]
}

/* ---------- helpers ---------- */

type Lang = "zh" | "en" | "other"

function languageOfFact(raw: string): Lang {
  const s = raw.toLowerCase()
  if (/chin|mandarin|кит|中文|汉语/.test(s)) return "zh"
  if (/engl|англ|english/.test(s)) return "en"
  return "other"
}

/** Numbers in Russian: 6.5 → «6,5», 5 → «5». */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",")
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)

/* ---------- the match ---------- */

/**
 * @param now – the date deadlines are compared against; passed in (not
 *              `Date.now()`) so results are testable and stable within a render.
 */
export function matchUniversity(profile: ChinaProfile, u: University, now: Date): MatchResult {
  const ok: string[] = []
  const gaps: string[] = []
  const unknown: string[] = []

  /* language of instruction */
  const langFact = factOf(u, "requirements.language_of_instruction")
  const want = profile.language ?? "any"
  if (!langFact) {
    unknown.push("язык обучения: вуз не опубликовал")
  } else if (want === "any") {
    ok.push(`язык обучения: ${langFact.display}`)
  } else {
    const has = "value" in langFact.value && typeof langFact.value.value === "string"
      ? languageOfFact(langFact.value.value)
      : "other"
    if (has === "other") unknown.push(`язык обучения: ${langFact.display}, не проверено`)
    else if (has === want) ok.push(`обучение на ${want === "zh" ? "китайском" : "английском"}`)
    else
      gaps.push(
        want === "zh"
          ? "обучение на английском, а не на китайском"
          : "обучение на китайском, а не на английском",
      )
  }

  /* HSK */
  const hskFact = factOf(u, "requirements.hsk_min")
  if (!hskFact) {
    unknown.push("HSK: вуз не опубликовал")
  } else {
    const min = scoreOf(hskFact.value)
    if (min === null) unknown.push(`HSK: ${hskFact.display}, не проверено`)
    else if (!isNum(profile.hsk)) gaps.push(`не хватает HSK ${num(min)} (в профиле нет HSK)`)
    else if (profile.hsk >= min) ok.push(`HSK ${num(min)} есть (у вас HSK ${num(profile.hsk)})`)
    else gaps.push(`не хватает HSK ${num(min)} (у вас HSK ${num(profile.hsk)})`)
  }

  /* IELTS */
  const ieltsFact = factOf(u, "requirements.ielts_min")
  if (!ieltsFact) {
    unknown.push("IELTS: вуз не опубликовал")
  } else {
    const min = scoreOf(ieltsFact.value)
    if (min === null) unknown.push(`IELTS: ${ieltsFact.display}, не проверено`)
    else if (!isNum(profile.ielts)) gaps.push(`не хватает IELTS ${num(min)} (в профиле нет IELTS)`)
    else if (profile.ielts >= min) ok.push(`IELTS ${num(min)} есть (у вас ${num(profile.ielts)})`)
    else gaps.push(`не хватает IELTS ${num(min)} (у вас ${num(profile.ielts)})`)
  }

  /* budget vs tuition (lower bound of a range) */
  const tuition = factOf(u, "fees.tuition_year_non_eu")
  if (!tuition) {
    unknown.push("стоимость: вуз не опубликовал")
  } else {
    const minor = amountMinorOf(tuition.value)
    const cur = currencyOf(tuition.value)
    if (minor === null || cur !== "CNY") unknown.push(`стоимость: ${tuition.display}, не проверено`)
    else if (!isNum(profile.budget_year_cny)) unknown.push(`стоимость: ${tuition.display}, бюджет не указан`)
    else if (profile.budget_year_cny * 100 >= minor) ok.push(`укладывается в бюджет: ${tuition.display}`)
    else gaps.push(`дороже бюджета: ${tuition.display}`)
  }

  /* application deadline (inclusive day) */
  const deadline = factOf(u, "deadline.fall.application_non_eu")
  if (!deadline) {
    unknown.push("дедлайн: вуз не опубликовал")
  } else {
    const date = deadlineDateOf(deadline.value)
    if (!date) unknown.push(`дедлайн: ${deadline.display}, не проверено`)
    else if (isDeadlinePassed(date, now)) gaps.push(`дедлайн прошёл: ${deadline.display}`)
    else ok.push(`дедлайн не прошёл: ${deadline.display}`)
  }

  /* CSCA – informational only, never a gap */
  const csca = cscaStatus(u)
  const cscaFact = factOf(u, "requirements.csca_required")
  if (csca === "required") ok.push(`CSCA требуется: ${cscaFact?.display ?? "да"}`)
  else if (csca === "not_required") ok.push(`CSCA не требуется: ${cscaFact?.display ?? "нет"}`)
  else unknown.push("CSCA: вуз не заявил")

  return { ok, gaps, unknown }
}

/** True when nothing formal is missing (there may still be unknowns). */
export function hasNoGaps(r: MatchResult): boolean {
  return r.gaps.length === 0
}
