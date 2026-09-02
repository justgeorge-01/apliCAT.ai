import { describe, expect, it } from "vitest"

import type { Fact, FactKey, FactValue, University } from "@/data/china.types"
import { matchUniversity, hasNoGaps, type ChinaProfile } from "./match"

function fact(key: FactKey, value: FactValue, display: string): Fact {
  return {
    key,
    label_ru: key,
    value,
    display,
    academic_year: null,
    quote: null,
    source_url: "https://example.edu/admissions",
    verified_at: "2026-08-31",
    origin: "demo",
    certainty: "verified",
    snapshot: null,
  }
}

function uni(facts: Fact[]): University {
  return {
    id: "u",
    name: "U",
    name_ru: null,
    city: "Beijing",
    country: "CN",
    website: "https://example.edu",
    last_checked_at: "2026-08-31",
    facts,
    coverage: { published: facts.length, expected: 8 },
  }
}

const FULL = uni([
  fact("requirements.language_of_instruction", { value: "Chinese" }, "китайский"),
  fact("requirements.hsk_min", { value: 5 }, "HSK 5"),
  fact(
    "fees.tuition_year_non_eu",
    { amount_minor_min: 2_600_000, amount_minor_max: 4_000_000, currency: "CNY" },
    "26 000 – 40 000 ¥ в год",
  ),
  fact("deadline.fall.application_non_eu", { date_min: "2025-11-28", date_max: "2026-02-28" }, "до 28 февраля 2026"),
  fact("requirements.csca_required", { value: true }, "требуется"),
])

const BEFORE = new Date(2026, 0, 15, 12) // 15 Jan 2026, local
const AFTER = new Date(2026, 2, 1, 12) // 1 Mar 2026

const fit: ChinaProfile = { language: "zh", hsk: 6, budget_year_cny: 50_000 }

describe("matchUniversity", () => {
  it("everything formal matches → only ok, no gaps, CSCA is informational in ok", () => {
    const r = matchUniversity(fit, FULL, BEFORE)
    expect(r.gaps).toEqual([])
    expect(r.ok).toContain("обучение на китайском")
    expect(r.ok).toContain("HSK 5 есть (у вас HSK 6)")
    expect(r.ok).toContain("укладывается в бюджет: 26 000 – 40 000 ¥ в год")
    expect(r.ok).toContain("дедлайн не прошёл: до 28 февраля 2026")
    expect(r.ok.some((s) => s.startsWith("CSCA требуется"))).toBe(true)
    expect(hasNoGaps(r)).toBe(true)
    // IELTS is not published → unknown, never a gap
    expect(r.unknown).toContain("IELTS: вуз не опубликовал")
  })

  it("HSK below the minimum is a gap that names the required level", () => {
    const r = matchUniversity({ ...fit, hsk: 3 }, FULL, BEFORE)
    expect(r.gaps).toContain("не хватает HSK 5 (у вас HSK 3)")
  })

  it("no HSK in the profile is a gap when the university requires one", () => {
    const r = matchUniversity({ ...fit, hsk: null }, FULL, BEFORE)
    expect(r.gaps).toContain("не хватает HSK 5 (в профиле нет HSK)")
  })

  it("budget below the LOWER bound of a tuition range is a gap", () => {
    const r = matchUniversity({ ...fit, budget_year_cny: 20_000 }, FULL, BEFORE)
    expect(r.gaps).toContain("дороже бюджета: 26 000 – 40 000 ¥ в год")
    // exactly the lower bound still fits
    expect(matchUniversity({ ...fit, budget_year_cny: 26_000 }, FULL, BEFORE).gaps).toEqual([])
  })

  it("budget not given → unknown, not a gap", () => {
    const r = matchUniversity({ ...fit, budget_year_cny: undefined }, FULL, BEFORE)
    expect(r.gaps).toEqual([])
    expect(r.unknown.some((s) => s.includes("бюджет не указан"))).toBe(true)
  })

  it("deadline is compared against the passed-in date, inclusive of the deadline day", () => {
    expect(matchUniversity(fit, FULL, AFTER).gaps).toContain("дедлайн прошёл: до 28 февраля 2026")
    const onTheDay = new Date(2026, 1, 28, 23, 59)
    expect(matchUniversity(fit, FULL, onTheDay).gaps).toEqual([])
  })

  it("language mismatch is a gap; 'any' accepts whatever is published", () => {
    const en = matchUniversity({ ...fit, language: "en" }, FULL, BEFORE)
    expect(en.gaps).toContain("обучение на китайском, а не на английском")
    const any = matchUniversity({ ...fit, language: "any" }, FULL, BEFORE)
    expect(any.ok).toContain("язык обучения: китайский")
    expect(any.gaps).toEqual([])
  })

  it("IELTS below the minimum is a gap, printed with a Russian decimal comma", () => {
    const u = uni([fact("requirements.ielts_min", { value: 6.5 }, "IELTS 6.5")])
    const r = matchUniversity({ language: "en", ielts: 5.5 }, u, BEFORE)
    expect(r.gaps).toContain("не хватает IELTS 6,5 (у вас 5,5)")
    expect(matchUniversity({ language: "en", ielts: 7 }, u, BEFORE).ok).toContain("IELTS 6,5 есть (у вас 7)")
  })

  it("no facts at all → everything unknown, nothing ok, nothing missing", () => {
    const r = matchUniversity(fit, uni([]), BEFORE)
    expect(r.ok).toEqual([])
    expect(r.gaps).toEqual([])
    expect(r.unknown).toEqual([
      "язык обучения: вуз не опубликовал",
      "HSK: вуз не опубликовал",
      "IELTS: вуз не опубликовал",
      "стоимость: вуз не опубликовал",
      "дедлайн: вуз не опубликовал",
      "CSCA: вуз не заявил",
    ])
  })

  it("CSCA never lands in gaps, whatever the profile", () => {
    for (const profile of [{}, fit, { ...fit, hsk: 0, budget_year_cny: 0 }]) {
      const r = matchUniversity(profile, FULL, AFTER)
      expect(r.gaps.some((s) => /csca/i.test(s))).toBe(false)
    }
    const notRequired = uni([fact("requirements.csca_required", { value: false }, "не требуется")])
    expect(matchUniversity({}, notRequired, BEFORE).ok).toContain("CSCA не требуется: не требуется")
  })

  it("tuition in a currency other than CNY cannot be checked → unknown", () => {
    const u = uni([fact("fees.tuition_year_non_eu", { amount_minor: 1_000_000, currency: "USD" }, "10 000 $")])
    const r = matchUniversity(fit, u, BEFORE)
    expect(r.gaps).toEqual([])
    expect(r.unknown).toContain("стоимость: 10 000 $, не проверено")
  })

  it("never produces probabilities, tiers or chances", () => {
    const all = [...Object.values(matchUniversity(fit, FULL, BEFORE))].flat().join(" ")
    expect(all).not.toMatch(/%|шанс|вероятн|мечта|надёжн/i)
  })
})
