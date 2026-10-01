import { describe, expect, it } from "vitest"

import {
  CARD_KEYS,
  CARD_ROWS,
  FACT_LABELS_RU,
  amountMinorOf,
  cscaStatus,
  daysUntil,
  deadlineDateOf,
  demoCatalog,
  formatCheckedAt,
  hasProvenance,
  currentIntakeYear,
  cycleNote,
  intakeYearOf,
  isDeadlinePassed,
  isPastCycle,
  lastChecked,
  normalizeCatalog,
  yearInChinaEstimate, arrangeFacts, factCoordinates } from "@/data/china"
import { CARD_EXPECTED, FIXTURE_CATALOG } from "@/data/china.fixture"
import type { Fact, University } from "@/data/china.types"

describe("fixture catalog", () => {
  it("has the 20 universities with unique ids, all in CN", () => {
    const ids = FIXTURE_CATALOG.universities.map((u) => u.id)
    expect(ids).toHaveLength(20)
    expect(new Set(ids).size).toBe(20)
    for (const u of FIXTURE_CATALOG.universities) {
      expect(u.country).toBe("CN")
      expect(u.website).toMatch(/^https:\/\//)
      expect(u.name_ru).toBeTruthy()
      expect(u.coverage).toEqual({ published: u.facts.length, expected: CARD_EXPECTED })
    }
  })

  it("every fact is demo, dated 2026-08-31, with an official source and a printable display", () => {
    const facts = FIXTURE_CATALOG.universities.flatMap((u) => u.facts)
    expect(facts.length).toBeGreaterThan(0)
    for (const f of facts) {
      expect(hasProvenance(f)).toBe(true)
      expect(f.origin).toBe("demo")
      expect(f.verified_at).toBe("2026-08-31")
      expect(f.source_url).toMatch(/^https:\/\/[^/]+\.edu\.cn\//)
      expect(f.display).not.toMatch(/—/)
      expect(CARD_KEYS).toContain(f.key)
    }
  })

  it("universities without facts are «не опубликовано»: last_checked_at null", () => {
    for (const u of FIXTURE_CATALOG.universities) {
      if (u.facts.length === 0) expect(u.last_checked_at).toBeNull()
      else expect(u.last_checked_at).toBe("2026-08-31")
    }
    expect(FIXTURE_CATALOG.universities.filter((u) => u.facts.length).map((u) => u.id)).toEqual([
      "tsinghua",
      "sjtu",
      "zju",
      "xjtlu",
    ])
  })

  it("demoCatalog is flagged and keeps every fixture fact", () => {
    const c = demoCatalog()
    expect(c.demo).toBe(true)
    expect(c.universities.flatMap((u) => u.facts)).toHaveLength(
      FIXTURE_CATALOG.universities.flatMap((u) => u.facts).length,
    )
  })
})

describe("Russian names and cities", () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    generated_at: "2026-09-05T16:25:00Z",
    prompt_version: 13,
    universities: [{ id: "tsinghua-university", name: "Tsinghua University", name_ru: null, facts: [], ...over }],
  })

  it("fills name_ru and city the export does not carry yet", () => {
    const [u] = normalizeCatalog(raw()).universities
    expect(u.name_ru).toBe("Университет Цинхуа")
    expect(u.city).toBe("Пекин")
  })

  it("never overrides what the export does carry", () => {
    const [u] = normalizeCatalog(raw({ name_ru: "Цинхуа", city: "Beijing" })).universities
    expect(u.name_ru).toBe("Цинхуа")
    expect(u.city).toBe("Beijing")
  })

  it("an unknown id keeps null / empty instead of guessing", () => {
    const [u] = normalizeCatalog(raw({ id: "constructor", name: "X" })).universities
    expect(u.name_ru).toBeNull()
    expect(u.city).toBe("")
  })
})

describe("admission cycles", () => {
  it("a date from September on belongs to the next year's intake", () => {
    expect(intakeYearOf("2026-06-01")).toBe(2026)
    expect(intakeYearOf("2025-11-20")).toBe(2026)
    expect(intakeYearOf("2026-09-01")).toBe(2027)
    expect(intakeYearOf("bad")).toBeNull()
  })

  it("the current intake turns over on 1 September", () => {
    expect(currentIntakeYear(new Date(2026, 7, 31, 12))).toBe(2026)
    expect(currentIntakeYear(new Date(2026, 8, 1, 12))).toBe(2027)
  })

  it("on 1 October 2026 every 2026 deadline is a past cycle, a 2027 one is not", () => {
    const now = new Date(2026, 9, 1, 12)
    expect(isPastCycle("2026-06-01", now)).toBe(true)
    expect(isPastCycle("2025-11-20", now)).toBe(true)
    expect(isPastCycle("2027-03-31", now)).toBe(false)
    expect(isPastCycle("2026-12-15", now)).toBe(false)
  })

  it("cycleNote marks only deadlines of a finished intake", () => {
    const now = new Date(2026, 9, 1, 12)
    const base = {
      label_ru: "x",
      academic_year: null,
      quote: null,
      source_url: "https://example.edu.cn/",
      verified_at: "2026-09-05",
      origin: "auto" as const,
      certainty: "verified" as const,
      snapshot: null,
    }
    const old: Fact = { ...base, key: "deadline.fall.application_non_eu", value: { date: "2026-06-01" }, display: "1 июня 2026" }
    const next: Fact = { ...old, value: { date: "2027-04-30" }, display: "30 апреля 2027" }
    const fee: Fact = { ...base, key: "fees.tuition_year_non_eu", value: { amount_minor: 1, currency: "CNY" }, display: "¥0" }
    expect(cycleNote(old, now)).toBe("прошлый цикл, набор 2026")
    expect(cycleNote(next, now)).toBeNull()
    expect(cycleNote(fee, now)).toBeNull()
  })
})

describe("lastChecked", () => {
  const u = (facts: Fact[]): University => ({
    id: "x",
    name: "X",
    name_ru: null,
    city: "",
    country: "CN",
    website: "",
    last_checked_at: "2026-09-05T12:00:00Z",
    facts,
    coverage: { published: facts.length, expected: 11 },
  })

  it("a university with no published fact has no check date to show", () => {
    expect(lastChecked(u([]))).toBeNull()
  })

  it("with facts it is the export's last_checked_at", () => {
    const f = FIXTURE_CATALOG.universities.find((x) => x.facts.length > 0)!.facts[0]
    expect(lastChecked(u([f]))).toBe("2026-09-05T12:00:00Z")
  })
})

describe("normalizeCatalog", () => {
  const good: Fact = {
    key: "fees.tuition_year_non_eu",
    label_ru: "Стоимость",
    value: { amount_minor: 2_600_000, currency: "CNY" },
    display: "26 000 ¥ в год",
    academic_year: "2026/2027",
    quote: "26,000 RMB",
    source_url: "https://example.edu.cn/fees",
    verified_at: "2026-09-01T02:41:00Z",
    origin: "auto",
    certainty: "verified",
    snapshot: { render_method: "wayback", fetched_at: "2026-09-01T02:40:00Z", archived_at: "2026-07-28" },
  }

  it("drops facts without source_url / verified_at / display and keeps the rest verbatim", () => {
    const raw = {
      generated_at: "2026-09-01T03:10:00Z",
      prompt_version: 12,
      universities: [
        {
          id: "x",
          name: "X",
          facts: [
            good,
            { ...good, source_url: "" },
            { ...good, verified_at: undefined },
            { ...good, display: "" },
          ],
        },
        { name: "no id" },
      ],
    }
    const c = normalizeCatalog(raw)
    expect(c.prompt_version).toBe(12)
    expect(c.demo).toBeUndefined()
    expect(c.universities).toHaveLength(1)
    // the loader adds the two coordinate fields (null when the export omits them)
    expect(c.universities[0].facts).toEqual([{ ...good, degree_scope: null, intake_round: null }])
    expect(c.universities[0].coverage).toEqual({ published: 1, expected: CARD_KEYS.length })
    expect(c.universities[0].last_checked_at).toBeNull()
  })

  it("throws on a non-catalog", () => {
    expect(() => normalizeCatalog(null)).toThrow()
    expect(() => normalizeCatalog({ universities: {} })).toThrow()
  })
})

describe("helpers", () => {
  const u = (facts: Fact[]): University => ({
    id: "u",
    name: "U",
    name_ru: null,
    city: "",
    country: "CN",
    website: "",
    last_checked_at: null,
    facts,
    coverage: { published: facts.length, expected: 8 },
  })
  const f = (key: Fact["key"], value: Fact["value"]): Fact => ({
    key,
    label_ru: key,
    value,
    display: "x",
    academic_year: null,
    quote: null,
    source_url: "https://example.edu.cn/",
    verified_at: "2026-08-31",
    origin: "demo",
    certainty: "verified",
    snapshot: null,
  })

  it("dates: countdown and inclusive deadline day", () => {
    expect(daysUntil("2026-02-28", new Date(2026, 1, 25, 23))).toBe(3)
    expect(isDeadlinePassed("2026-02-28", new Date(2026, 1, 28, 23, 59))).toBe(false)
    expect(isDeadlinePassed("2026-02-28", new Date(2026, 2, 1, 0, 1))).toBe(true)
    expect(daysUntil("nonsense", new Date())).toBeNull()
  })

  it("formatCheckedAt renders provenance dates in Russian", () => {
    expect(formatCheckedAt("2026-08-31")).toBe("31 августа 2026")
    expect(formatCheckedAt("2026-09-01T02:41:00Z")).toBe("1 сентября 2026")
    expect(formatCheckedAt(null)).toBe("")
    expect(formatCheckedAt("soon")).toBe("soon")
  })

  it("range values: money uses the minimum, dates use the latest", () => {
    expect(amountMinorOf({ amount_minor_min: 100, amount_minor_max: 200, currency: "CNY" })).toBe(100)
    expect(amountMinorOf({ amount_minor: 300, currency: "CNY" })).toBe(300)
    expect(amountMinorOf({ value: 5 })).toBeNull()
    expect(deadlineDateOf({ date_min: "2025-11-28", date_max: "2026-02-28" })).toBe("2026-02-28")
    expect(deadlineDateOf({ date: "2026-03-31" })).toBe("2026-03-31")
    expect(deadlineDateOf({ value: true })).toBeNull()
  })

  it("cscaStatus", () => {
    expect(cscaStatus(u([]))).toBe("unknown")
    expect(cscaStatus(u([f("requirements.csca_required", { value: true })]))).toBe("required")
    expect(cscaStatus(u([f("requirements.csca_required", { value: false })]))).toBe("not_required")
  })

  it("yearInChinaEstimate = tuition (min) + 12 × dormitory, same currency only", () => {
    const tuition = f("fees.tuition_year_non_eu", { amount_minor_min: 2_600_000, amount_minor_max: 4_000_000, currency: "CNY" })
    const dorm = f("fees.dormitory_month", { amount_minor: 150_000, currency: "CNY" })
    expect(yearInChinaEstimate(u([tuition, dorm]))).toEqual({
      amount_minor: 4_400_000,
      currency: "CNY",
      display: "44\u00a0000\u00a0¥",
    })
    expect(yearInChinaEstimate(u([tuition]))).toBeNull()
    const usdDorm = f("fees.dormitory_month", { amount_minor: 50_000, currency: "USD" })
    expect(yearInChinaEstimate(u([tuition, usdDorm]))).toBeNull()
  })

  it("card constants cover every key with a label and six rows in the spec order", () => {
    for (const k of CARD_KEYS) expect(FACT_LABELS_RU[k]).toBeTruthy()
    expect(CARD_ROWS.map((r) => r.id)).toEqual(["deadline", "tuition", "language", "csca", "scholarship", "dormitory"])
  })
})

describe("arrangeFacts / factCoordinates – a value is printed with the degree it holds for", () => {
  const base = {
    key: "fees.tuition_year_non_eu" as const,
    label_ru: "Стоимость",
    value: { amount_minor: 1, currency: "CNY" },
    quote: "q",
    source_url: "https://u.edu.cn/x",
    verified_at: "2026-09-05",
    origin: "auto" as const,
    certainty: "verified" as const,
    snapshot: null,
    academic_year: null,
    intake_round: null,
  }
  it("puts the bachelor value first, then the unscoped one, then the other levels", () => {
    const facts = [
      { ...base, display: "¥150 000", degree_scope: "mba" as const },
      { ...base, display: "¥30 000", degree_scope: "master" as const },
      { ...base, display: "¥26 000", degree_scope: null },
      { ...base, display: "¥24 000", degree_scope: "bachelor" as const },
    ]
    expect(arrangeFacts(facts).map((f) => f.display)).toEqual(["¥24 000", "¥26 000", "¥30 000", "¥150 000"])
  })
  it("drops an exact duplicate (same print, same coordinates) and keeps a differently scoped twin", () => {
    const facts = [
      { ...base, display: "5", degree_scope: null },
      { ...base, display: "5", degree_scope: null },
      { ...base, display: "5", degree_scope: "bachelor" as const },
    ]
    expect(arrangeFacts(facts)).toHaveLength(2)
  })
  it("prints year · degree · round, and nothing when none is stated", () => {
    expect(factCoordinates({ ...base, display: "x", academic_year: "2026/2027", degree_scope: "master", intake_round: 2 })).toBe(
      "учебный год 2026/2027 · магистратура · раунд 2",
    )
    expect(factCoordinates({ ...base, display: "x", degree_scope: "all" })).toBe("")
    expect(factCoordinates({ ...base, display: "x", degree_scope: null })).toBe("")
  })
})
