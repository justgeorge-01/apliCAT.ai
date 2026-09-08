import { describe, expect, it } from "vitest"

import type { Catalog, Fact, FactKey, FactValue, University } from "@/data/china.types"
import {
  FIXED_DATES,
  addToPlan,
  daysLeftLabel,
  deadlineFeed,
  docChecklist,
  docProgress,
  emptyPlan,
  normalizePlan,
  parsePlan,
  planSummary,
  removeFromPlan,
  serializePlan,
  setDoc,
  setNote,
  setStatus,
  shareUrl,
  togglePlan,
  upcomingWithin,
  type FixedDate,
  type Plan,
} from "./plan"

function fact(key: FactKey, value: FactValue, display: string, label: string = key): Fact {
  return {
    key,
    label_ru: label,
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

function uni(id: string, name_ru: string, facts: Fact[]): University {
  return {
    id,
    name: id.toUpperCase(),
    name_ru,
    city: "Beijing",
    country: "CN",
    website: "https://example.edu",
    last_checked_at: "2026-08-31",
    facts,
    coverage: { published: facts.length, expected: 8 },
  }
}

const A = uni("a", "Вуз А", [
  fact("deadline.fall.application_non_eu", { date: "2026-02-28" }, "28 февраля 2026", "Дедлайн подачи"),
  fact("deadline.scholarship", { date: "2026-01-20" }, "20 января 2026", "Дедлайн на стипендию"),
  fact("requirements.csca_required", { value: true }, "требуется"),
  fact("requirements.hsk_min", { value: 5 }, "HSK 5"),
])
const B = uni("b", "Вуз Б", [
  fact("deadline.fall.application_non_eu", { date_min: "2025-11-28", date_max: "2026-03-31" }, "до 31 марта 2026", "Дедлайн подачи"),
  fact("requirements.csca_required", { value: false }, "не требуется"),
  fact("requirements.ielts_min", { value: 6 }, "IELTS 6.0"),
  fact("docs.required_list", { items: ["Study plan", "Passport photo page"] }, "Study plan, Passport photo page"),
])
const C = uni("c", "Вуз В", [])

const CATALOG: Catalog = { generated_at: "2026-08-31T00:00:00Z", prompt_version: 0, universities: [A, B, C] }

const FIXED: FixedDate[] = [
  {
    id: "csca-2026-03",
    label: "Сессия CSCA",
    date: "2026-03-01",
    precision: "month",
    display: "март 2026",
    note: "общие даты, по csca.cn",
    source_url: "https://csca.cn/",
    verified_at: "2026-08-31",
  },
  {
    id: "csca-2026-01",
    label: "Сессия CSCA",
    date: "2026-01-01",
    precision: "month",
    display: "январь 2026",
    note: "общие даты, по csca.cn",
    source_url: "https://csca.cn/",
    verified_at: "2026-08-31",
  },
]

const NOW = new Date(2026, 1, 1, 12) // 1 Feb 2026

describe("plan updaters", () => {
  it("add / remove / toggle are idempotent and never mutate", () => {
    const p0 = emptyPlan()
    const p1 = addToPlan(p0, "a")
    expect(p0.universities).toEqual([])
    expect(p1.universities).toEqual([{ id: "a", status: "considering", docs: {} }])
    expect(addToPlan(p1, "a")).toBe(p1)
    expect(removeFromPlan(p1, "zzz")).toBe(p1)
    expect(removeFromPlan(p1, "a").universities).toEqual([])
    expect(togglePlan(togglePlan(p0, "a"), "a").universities).toEqual([])
  })

  it("setStatus / setDoc update one entry and keep the rest", () => {
    let p = addToPlan(addToPlan(emptyPlan(), "a"), "b")
    p = setStatus(p, "a", "applied")
    p = setDoc(p, "b", "passport", true)
    expect(p.universities[0]).toEqual({ id: "a", status: "applied", docs: {} })
    expect(p.universities[1]).toEqual({ id: "b", status: "considering", docs: { passport: true } })
    expect(setStatus(p, "nope", "applied")).toBe(p)
    expect(setDoc(p, "b", "passport", true)).toBe(p)
  })

  it("normalizePlan sanitizes storage and rejects garbage", () => {
    expect(normalizePlan(null)).toBeNull()
    expect(normalizePlan({ universities: "x" })).toBeNull()
    expect(
      normalizePlan({
        universities: [
          { id: "a", status: "weird", docs: { p: true, q: "yes" } },
          { id: "a", status: "applied", docs: {} },
          { status: "applied" },
          "junk",
        ],
      }),
    ).toEqual({ universities: [{ id: "a", status: "considering", docs: { p: true } }] })
  })
})

describe("docChecklist / docProgress", () => {
  it("base list + CSCA when required + the university's own required_list with provenance", () => {
    const a = docChecklist(A)
    expect(a.map((d) => d.id)).toEqual([
      "passport",
      "transcript",
      "language",
      "csca",
      "motivation",
      "recommendations",
      "medical",
      "photo",
    ])
    expect(a.find((d) => d.id === "language")?.label).toBe("Сертификат HSK")
    expect(a.find((d) => d.id === "csca")?.label).toBe("Отчёт о результатах CSCA")

    const b = docChecklist(B)
    expect(b.some((d) => d.id === "csca")).toBe(false)
    expect(b.find((d) => d.id === "language")?.label).toBe("Сертификат IELTS")
    const fromUni = b.filter((d) => d.origin === "university")
    expect(fromUni.map((d) => d.label)).toEqual(["Study plan", "Passport photo page"])
    expect(fromUni[0]).toMatchObject({ source_url: "https://example.edu/admissions", verified_at: "2026-08-31" })

    const c = docChecklist(C)
    expect(c.find((d) => d.id === "csca")?.label).toContain("вуз не заявил")
    expect(c.find((d) => d.id === "language")?.label).toBe("Сертификат HSK или IELTS")
  })

  it("progress counts only known doc ids", () => {
    const entry = { id: "a", status: "preparing" as const, docs: { passport: true, csca: true, ghost: true } }
    expect(docProgress(entry, A)).toEqual({ done: 2, total: 8, pct: 25 })
    expect(docProgress(undefined, A)).toEqual({ done: 0, total: 8, pct: 0 })
  })
})

describe("deadlineFeed", () => {
  const plan: Plan = addToPlan(addToPlan(addToPlan(emptyPlan(), "a"), "b"), "missing")

  it("merges university deadlines and common dates, ascending, with a countdown", () => {
    const feed = deadlineFeed(plan, CATALOG, FIXED, NOW)
    expect(feed.map((i) => i.id)).toEqual(["a:deadline.fall.application_non_eu", "csca-2026-03", "b:deadline.fall.application_non_eu"])
    expect(feed[0]).toMatchObject({
      kind: "university",
      universityId: "a",
      title: "Вуз А",
      subtitle: "Дедлайн подачи",
      display: "28 февраля 2026",
      daysLeft: 27,
      passed: false,
      critical: true,
      note: null,
    })
    expect(feed[1]).toMatchObject({ kind: "common", note: "общие даты, по csca.cn", precision: "month", display: "март 2026" })
    // a date range uses its latest date
    expect(feed[2]).toMatchObject({ date: "2026-03-31", daysLeft: 58 })
    // sorted ascending
    const dates = feed.map((i) => i.date)
    expect([...dates].sort()).toEqual(dates)
  })

  it("drops past items by default and keeps them with includePast", () => {
    const withPast = deadlineFeed(plan, CATALOG, FIXED, NOW, { includePast: true })
    const past = withPast.filter((i) => i.passed).map((i) => i.id)
    expect(past).toEqual(["csca-2026-01", "a:deadline.scholarship"])
    expect(withPast.find((i) => i.id === "a:deadline.scholarship")?.daysLeft).toBe(-12)
  })

  it("a month-precision date counts as current for the whole month", () => {
    const inMarch = deadlineFeed(plan, CATALOG, FIXED, new Date(2026, 2, 20))
    const csca = inMarch.find((i) => i.id === "csca-2026-03")
    expect(csca).toMatchObject({ daysLeft: 0, passed: false })
    expect(daysLeftLabel(csca!)).toBe("в этом месяце")
    const inApril = deadlineFeed(plan, CATALOG, FIXED, new Date(2026, 3, 1), { includePast: true })
    expect(inApril.find((i) => i.id === "csca-2026-03")?.passed).toBe(true)
  })

  it("the shipped FIXED_DATES all carry a source and a check date and are labelled as common", () => {
    expect(FIXED_DATES.length).toBeGreaterThan(0)
    for (const d of FIXED_DATES) {
      expect(d.source_url).toMatch(/^https:\/\//)
      expect(d.verified_at).toBe("2026-08-31")
      expect(d.note).toMatch(/^общие даты/)
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it("countdown labels", () => {
    expect(daysLeftLabel({ daysLeft: 0, passed: false, precision: "day" })).toBe("сегодня")
    expect(daysLeftLabel({ daysLeft: 1, passed: false, precision: "day" })).toBe("через 1 день")
    expect(daysLeftLabel({ daysLeft: 3, passed: false, precision: "day" })).toBe("через 3 дня")
    expect(daysLeftLabel({ daysLeft: 27, passed: false, precision: "day" })).toBe("через 27 дней")
    expect(daysLeftLabel({ daysLeft: -5, passed: true, precision: "day" })).toBe("прошёл")
  })
})

describe("planSummary / share / export", () => {
  it("summary lists universities with status and readiness, then nearest deadlines", () => {
    let plan = addToPlan(addToPlan(emptyPlan(), "a"), "b")
    plan = setStatus(plan, "a", "preparing")
    plan = setDoc(plan, "a", "passport", true)
    plan = setDoc(plan, "a", "csca", true)
    const text = planSummary(plan, CATALOG, NOW, { brand: "Abitura" })
    expect(text).toContain("Мой план поступления в Китай (Abitura)")
    expect(text).toContain("- Вуз А: готовлю документы, документы 2 из 8 (25%)")
    expect(text).toContain("- Вуз Б: рассматриваю, документы 0 из 9 (0%)")
    expect(text).toContain("Ближайшие дедлайны:")
    expect(text).toContain("- Вуз А, Дедлайн подачи: 28 февраля 2026 (через 27 дней)")
    expect(text).toContain("Составлено 2026-02-01")
    expect(text).not.toMatch(/—/) // no long dashes
  })

  it("empty plan still produces a digest", () => {
    expect(planSummary(emptyPlan(), CATALOG, NOW)).toContain("Вузы: пока не выбраны")
  })

  it("share url encodes the text", () => {
    expect(shareUrl("а б")).toBe("https://t.me/share/url?text=%D0%B0%20%D0%B1")
  })

  it("export → import round-trips and rejects junk", () => {
    const plan = setDoc(addToPlan(emptyPlan(), "a"), "a", "passport", true)
    const json = serializePlan(plan, NOW)
    expect(JSON.parse(json)).toMatchObject({ format: "admitica.cn.plan", version: 1 })
    expect(parsePlan(json)).toEqual(plan)
    expect(parsePlan(JSON.stringify(plan))).toEqual(plan)
    expect(parsePlan("not json")).toBeNull()
    expect(parsePlan('{"hello":1}')).toBeNull()
  })
})

describe("deadline feed with tasks (cabinet)", () => {
  const task = (over: Partial<import("./plan").FeedTask> & { id: string; title: string }) => ({
    dueOn: null,
    doneAt: null,
    universityId: null,
    orgId: null,
    ...over,
  })

  it("open dated tasks join the timeline; done / undated ones do not; a task sorts before a fact on the same day", () => {
    const plan = addToPlan(emptyPlan(), "a")
    const items = deadlineFeed(plan, CATALOG, [], NOW, {
      tasks: [
        task({ id: "t1", title: "Прислать письмо", dueOn: "2026-02-28", orgId: "org", universityId: "a" }),
        task({ id: "t2", title: "Сделано", dueOn: "2026-02-10", doneAt: "2026-02-01T00:00:00Z" }),
        task({ id: "t3", title: "Без даты" }),
        task({ id: "t4", title: "Моя", dueOn: "2026-02-03" }),
      ],
      orgName: "Zhuiqiu",
    })
    // the scholarship deadline (20.01) has passed at NOW and is not in the feed
    expect(items.map((i) => i.id)).toEqual(["task:t4", "task:t1", "a:deadline.fall.application_non_eu"])
    const t1 = items.find((i) => i.id === "task:t1")!
    expect(t1.kind).toBe("task")
    expect(t1.subtitle).toBe("от Zhuiqiu · Вуз А")
    expect(t1.display).toBe("28 февраля 2026")
    expect(t1.source_url).toBeNull()
    expect(t1.taskId).toBe("t1")
    expect(items.find((i) => i.id === "task:t4")!.subtitle).toBe("моя задача")
  })

  it("upcomingWithin keeps the next N days only", () => {
    const plan = addToPlan(emptyPlan(), "a")
    const items = deadlineFeed(plan, CATALOG, [], NOW, { tasks: [task({ id: "t", title: "x", dueOn: "2026-02-05" })] })
    expect(upcomingWithin(items, 7).map((i) => i.id)).toEqual(["task:t"])
    expect(upcomingWithin(items, 30).map((i) => i.id)).toEqual(["task:t", "a:deadline.fall.application_non_eu"])
  })

  it("setNote / normalizePlan keep the student's note", () => {
    const p = setNote(addToPlan(emptyPlan(), "a"), "a", "  заметка  ")
    expect(p.universities[0].note).toBe("заметка")
    expect(setNote(p, "a", "заметка")).toBe(p)
    expect(setNote(p, "a", " ").universities[0]).toEqual({ id: "a", status: "considering", docs: {} })
    expect(normalizePlan({ universities: [{ id: "a", note: "n" }] })!.universities[0].note).toBe("n")
    expect(normalizePlan({ universities: [{ id: "a", note: 5 }] })!.universities[0].note).toBeUndefined()
  })
})
