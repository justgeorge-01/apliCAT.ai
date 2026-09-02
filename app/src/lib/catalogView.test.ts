import { describe, expect, it } from "vitest"

import type { Fact, FactKey, FactValue, University } from "@/data/china.types"
import {
  applyFilters,
  cityList,
  coverageText,
  cscaEmptyText,
  DEFAULT_FILTERS,
  emptyFactText,
  evaluateFilters,
  formatCny,
  hasActiveFilters,
  matchesQuery,
  matchSummary,
  pluralRu,
  profileIsFilled,
  profileSummary,
  provenanceText,
  sortUniversities,
} from "./catalogView"

function fact(key: FactKey, value: FactValue, display: string, extra: Partial<Fact> = {}): Fact {
  return {
    key,
    label_ru: key,
    value,
    display,
    academic_year: null,
    quote: null,
    source_url: "https://example.edu/admissions",
    verified_at: "2026-08-31",
    origin: "auto",
    certainty: "verified",
    snapshot: { render_method: "fetch", fetched_at: "2026-08-31T10:00:00Z", archived_at: null },
    ...extra,
  }
}

function uni(id: string, facts: Fact[], over: Partial<University> = {}): University {
  return {
    id,
    name: id.toUpperCase(),
    name_ru: null,
    city: "Beijing",
    country: "CN",
    website: "https://example.edu",
    last_checked_at: facts.length ? "2026-08-31" : null,
    facts,
    coverage: { published: facts.length, expected: 8 },
    ...over,
  }
}

const NOW = new Date(2026, 0, 15, 12) // 15 Jan 2026

const zhUni = uni("zh", [
  fact("requirements.language_of_instruction", { value: "Chinese" }, "китайский"),
  fact("requirements.hsk_min", { value: 5 }, "HSK 5"),
  fact("fees.tuition_year_non_eu", { amount_minor_min: 2_600_000, amount_minor_max: 4_000_000, currency: "CNY" }, "26 000 – 40 000 ¥"),
  fact("deadline.fall.application_non_eu", { date: "2026-02-28" }, "28 февраля 2026"),
  fact("requirements.csca_required", { value: true }, "требуется"),
  fact("funding.covers_tuition", { value: true }, "да"),
])
const enUni = uni(
  "en",
  [
    fact("requirements.language_of_instruction", { value: "English" }, "английский"),
    fact("requirements.ielts_min", { value: 5 }, "IELTS 5.0"),
    fact("fees.tuition_year_non_eu", { amount_minor: 9_300_000, currency: "CNY" }, "93 000 ¥"),
    fact("deadline.fall.application_non_eu", { date: "2025-12-31" }, "31 декабря 2025"),
    fact("requirements.csca_required", { value: false }, "не требуется"),
  ],
  { city: "Suzhou", name_ru: "Английский вуз" },
)
const empty = uni("empty", [], { city: "Wuhan" })

describe("evaluateFilters / applyFilters", () => {
  it("no filters → everything passes, nothing hidden", () => {
    const r = applyFilters([zhUni, enUni, empty], DEFAULT_FILTERS, NOW)
    expect(r.shown.map((u) => u.id)).toEqual(["zh", "en", "empty"])
    expect(r.hiddenUnpublished).toBe(0)
  })

  it("language filter: published contradiction fails, missing fact is unpublished", () => {
    const f = { ...DEFAULT_FILTERS, language: "en" as const }
    expect(evaluateFilters(zhUni, f, NOW)).toBe("fail")
    expect(evaluateFilters(enUni, f, NOW)).toBe("pass")
    expect(evaluateFilters(empty, f, NOW)).toBe("unpublished")
  })

  it("unpublished universities are hidden and counted unless keepUnpublished", () => {
    const f = { ...DEFAULT_FILTERS, hskMax: 5 }
    const hidden = applyFilters([zhUni, enUni, empty], f, NOW)
    expect(hidden.shown.map((u) => u.id)).toEqual(["zh"])
    expect(hidden.hiddenUnpublished).toBe(2)
    const kept = applyFilters([zhUni, enUni, empty], { ...f, keepUnpublished: true }, NOW)
    expect(kept.shown.map((u) => u.id)).toEqual(["zh", "en", "empty"])
    expect(kept.hiddenUnpublished).toBe(0)
  })

  it("HSK: the university's minimum must be ≤ the chosen level", () => {
    expect(evaluateFilters(zhUni, { ...DEFAULT_FILTERS, hskMax: 4 }, NOW)).toBe("fail")
    expect(evaluateFilters(zhUni, { ...DEFAULT_FILTERS, hskMax: 5 }, NOW)).toBe("pass")
  })

  it("budget compares the lower bound of a range in CNY", () => {
    expect(evaluateFilters(zhUni, { ...DEFAULT_FILTERS, budgetCny: 26_000 }, NOW)).toBe("pass")
    expect(evaluateFilters(zhUni, { ...DEFAULT_FILTERS, budgetCny: 25_999 }, NOW)).toBe("fail")
    expect(evaluateFilters(enUni, { ...DEFAULT_FILTERS, budgetCny: 50_000 }, NOW)).toBe("fail")
  })

  it("scholarship covering tuition: true passes, false fails, absent unpublished", () => {
    const f = { ...DEFAULT_FILTERS, coversTuition: true }
    expect(evaluateFilters(zhUni, f, NOW)).toBe("pass")
    expect(evaluateFilters(enUni, f, NOW)).toBe("unpublished")
    const no = uni("no", [fact("funding.covers_tuition", { value: false }, "нет")])
    expect(evaluateFilters(no, f, NOW)).toBe("fail")
  })

  it("deadline open: passed deadline fails (inclusive day), upcoming passes", () => {
    const f = { ...DEFAULT_FILTERS, deadlineOpen: true }
    expect(evaluateFilters(zhUni, f, NOW)).toBe("pass")
    expect(evaluateFilters(enUni, f, NOW)).toBe("fail")
    expect(evaluateFilters(zhUni, f, new Date(2026, 1, 28, 23))).toBe("pass")
    expect(evaluateFilters(zhUni, f, new Date(2026, 2, 1, 0))).toBe("fail")
  })

  it("CSCA: explicit choice, «не опубликовано» selects the unknowns", () => {
    expect(evaluateFilters(zhUni, { ...DEFAULT_FILTERS, csca: "required" }, NOW)).toBe("pass")
    expect(evaluateFilters(enUni, { ...DEFAULT_FILTERS, csca: "required" }, NOW)).toBe("fail")
    expect(evaluateFilters(empty, { ...DEFAULT_FILTERS, csca: "unknown" }, NOW)).toBe("pass")
    expect(evaluateFilters(zhUni, { ...DEFAULT_FILTERS, csca: "unknown" }, NOW)).toBe("fail")
  })

  it("city is metadata, not a fact: mismatch fails outright", () => {
    expect(evaluateFilters(empty, { ...DEFAULT_FILTERS, city: "Wuhan" }, NOW)).toBe("pass")
    expect(evaluateFilters(empty, { ...DEFAULT_FILTERS, city: "Beijing" }, NOW)).toBe("fail")
  })

  it("hasActiveFilters ignores keepUnpublished", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, keepUnpublished: true })).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, deadlineOpen: true })).toBe(true)
  })
})

describe("sortUniversities", () => {
  it("deadline: upcoming soonest first, then passed, then unpublished", () => {
    const later = uni("later", [fact("deadline.fall.application_non_eu", { date: "2026-03-31" }, "31 марта 2026")])
    const ids = sortUniversities([empty, later, enUni, zhUni], "deadline", NOW).map((u) => u.id)
    expect(ids).toEqual(["zh", "later", "en", "empty"])
  })

  it("tuition: cheapest lower bound first, unpublished last", () => {
    const ids = sortUniversities([empty, enUni, zhUni], "tuition", NOW).map((u) => u.id)
    expect(ids).toEqual(["zh", "en", "empty"])
  })

  it("name: by Russian name, falling back to the Latin one", () => {
    const ids = sortUniversities([zhUni, enUni], "name", NOW).map((u) => u.id)
    expect(ids).toEqual(["en", "zh"])
  })

  it("does not mutate the input", () => {
    const list = [empty, zhUni]
    sortUniversities(list, "tuition", NOW)
    expect(list.map((u) => u.id)).toEqual(["empty", "zh"])
  })
})

describe("search and cities", () => {
  it("matches name, Russian name and city, case-insensitively", () => {
    expect(matchesQuery(enUni, "англий")).toBe(true)
    expect(matchesQuery(enUni, "EN")).toBe(true)
    expect(matchesQuery(enUni, "suz")).toBe(true)
    expect(matchesQuery(enUni, "пекин")).toBe(false)
    expect(matchesQuery(enUni, "   ")).toBe(true)
  })

  it("cityList is unique and sorted", () => {
    expect(cityList([zhUni, enUni, empty, uni("x", [], { city: "Beijing" })])).toEqual(["Beijing", "Suzhou", "Wuhan"])
  })
})

describe("profile", () => {
  it("profileIsFilled needs at least one usable field", () => {
    expect(profileIsFilled(null)).toBe(false)
    expect(profileIsFilled({})).toBe(false)
    expect(profileIsFilled({ hsk: null, budget_year_cny: null })).toBe(false)
    expect(profileIsFilled({ language: "any" })).toBe(true)
    expect(profileIsFilled({ budget_year_cny: 50_000 })).toBe(true)
  })

  it("profileSummary is words plus the reader's own numbers", () => {
    expect(
      profileSummary({ degree: "bachelor", year: 2026, language: "en", ielts: 6.5, budget_year_cny: 50_000 }),
    ).toEqual(["бакалавриат", "подача в 2026", "обучение на английском", "IELTS 6.5", "бюджет до 50 000 ¥ в год"])
  })
})

describe("matchSummary", () => {
  it("gaps win, ok without unknowns is a clean match, CSCA alone is «проверять нечего»", () => {
    expect(matchSummary({ ok: ["a"], gaps: ["b"], unknown: [] }).tone).toBe("gaps")
    expect(matchSummary({ ok: ["a"], gaps: [], unknown: [] })).toEqual({
      tone: "ok",
      text: "формальные условия совпадают",
    })
    expect(matchSummary({ ok: ["a"], gaps: [], unknown: ["c"] }).text).toBe(
      "формальные условия совпадают, часть не проверена",
    )
    expect(matchSummary({ ok: ["CSCA требуется: да"], gaps: [], unknown: ["x"] })).toEqual({
      tone: "unknown",
      text: "условия не опубликованы, проверять нечего",
    })
    expect(matchSummary({ ok: [], gaps: ["b"], unknown: [] }).text).toBe("есть расхождения")
  })

  it("never contains digits", () => {
    for (const r of [
      { ok: ["a", "b"], gaps: ["c"], unknown: [] },
      { ok: ["a"], gaps: [], unknown: ["c", "d"] },
      { ok: [], gaps: [], unknown: ["c"] },
    ])
      expect(matchSummary(r).text).not.toMatch(/\d/)
  })
})

describe("coverage / provenance text", () => {
  it("empty university: «данные не опубликованы · проверка не проводилась»", () => {
    expect(coverageText(empty)).toEqual({
      published: 0,
      facts: "данные не опубликованы",
      checked: "проверка не проводилась",
    })
    expect(emptyFactText(empty)).toBe("не опубликовано · проверка не проводилась")
    expect(cscaEmptyText(empty)).toBe("вуз не заявил · проверка не проводилась")
    expect(cscaEmptyText(zhUni)).toBe("вуз не заявил · проверено 31 августа 2026")
  })

  it("published facts with a last check date", () => {
    const c = coverageText(uni("c", [fact("requirements.hsk_min", { value: 4 }, "HSK 4")], { coverage: { published: 7, expected: 8 } }))
    expect(c.facts).toBe("7 из 8 фактов проверено")
    expect(c.checked).toBe("проверено 31 августа 2026")
    expect(emptyFactText(zhUni)).toBe("не опубликовано · проверено 31 августа 2026")
  })

  it("provenance: auto, manual, wayback and demo", () => {
    const base = fact("requirements.hsk_min", { value: 4 }, "HSK 4")
    expect(provenanceText(base)).toBe("проверено · 31 августа 2026")
    expect(provenanceText({ ...base, origin: "manual", snapshot: null })).toBe("проверено вручную · 31 августа 2026")
    expect(
      provenanceText({
        ...base,
        snapshot: { render_method: "wayback", fetched_at: null, archived_at: "2026-05-02" },
      }),
    ).toBe("по архивной копии от 2 мая 2026")
    expect(provenanceText({ ...base, origin: "demo", snapshot: null })).toBe("демо · 31 августа 2026")
  })
})

describe("misc", () => {
  it("formatCny groups thousands with NBSP", () => {
    expect(formatCny(150000)).toBe("150 000 ¥")
    expect(formatCny(9500)).toBe("9 500 ¥")
  })

  it("pluralRu", () => {
    expect(pluralRu(1, "вуз", "вуза", "вузов")).toBe("вуз")
    expect(pluralRu(3, "вуз", "вуза", "вузов")).toBe("вуза")
    expect(pluralRu(12, "вуз", "вуза", "вузов")).toBe("вузов")
    expect(pluralRu(21, "вуз", "вуза", "вузов")).toBe("вуз")
  })
})
