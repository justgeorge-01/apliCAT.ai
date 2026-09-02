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
  isDeadlinePassed,
  normalizeCatalog,
  yearInChinaEstimate,
} from "@/data/china"
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
    expect(c.universities[0].facts).toEqual([good])
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
