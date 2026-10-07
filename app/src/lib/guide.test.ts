import { describe, expect, it } from "vitest"

import { formatMonth, groupLinks, guideOf, linkStats, normalizeGuide, normalizeLink, sourceHost } from "@/data/guide"
import { parseRoute, routeHref, universityHref } from "@/guide/route"

const zh = {
  url: "https://www.bilibili.com/video/BV1xx411c7mD",
  title_orig: "清华留学生宿舍参观",
  title_ru: "Экскурсия по общежитию для иностранцев в Цинхуа",
  summary_ru: "Студентка показывает двухместную комнату и общую кухню.",
  lang: "zh",
  platform: "bilibili",
  topic: "dorm",
  published: "2025-03",
  basis: "page",
}
const ru = {
  url: "https://t-j.ru/study-in-china/",
  title_ru: "Как я учусь в Китае",
  lang: "ru",
  platform: "media",
  topic: "dorm",
  published: "2024-11-02",
}

describe("normalizeLink", () => {
  it("keeps a complete link and cuts the date to a month", () => {
    expect(normalizeLink(ru)?.published).toBe("2024-11")
    expect(normalizeLink(zh)?.platform).toBe("bilibili")
  })

  it("drops a link that is not https, has no Russian title or an unknown topic or language", () => {
    expect(normalizeLink({ ...zh, url: "http://example.com" })).toBeNull()
    expect(normalizeLink({ ...zh, url: "javascript:alert(1)" })).toBeNull()
    expect(normalizeLink({ ...zh, title_ru: " " })).toBeNull()
    expect(normalizeLink({ ...zh, topic: "gossip" })).toBeNull()
    expect(normalizeLink({ ...zh, lang: "fr" })).toBeNull()
  })

  it("an unknown platform reads as a plain site", () => {
    expect(normalizeLink({ ...zh, platform: "weibo" })?.platform).toBe("other")
  })
})

describe("normalizeGuide", () => {
  it("keeps one copy of an address, drops an unsourced description, validates the Telegram ids", () => {
    const g = normalizeGuide({
      generated_at: "2026-10-04",
      telegram_channel: "@abitura_china",
      universities: {
        "tsinghua-university": {
          name_zh: "清华大学",
          description: { text_ru: "Университет в Пекине.", sources: ["https://www.tsinghua.edu.cn/"] },
          links: [zh, zh, ru, { url: "nope" }],
          discussion: "abitura_china/12",
        },
        "fudan-university": {
          description: { text_ru: "Без источника.", sources: ["http://x.test"] },
          links: [],
          discussion: "https://evil.example/1",
        },
      },
    })
    const t = guideOf(g, "tsinghua-university")
    expect(t?.links).toHaveLength(2)
    expect(t?.discussion).toBe("abitura_china/12")
    expect(g.telegram_channel).toBe("abitura_china")
    const f = guideOf(g, "fudan-university")
    expect(f?.description).toBeNull()
    expect(f?.discussion).toBeNull()
    expect(guideOf(g, "constructor")).toBeNull()
  })

  it("refuses something that is not a guide file", () => {
    expect(() => normalizeGuide(null)).toThrow()
    expect(() => normalizeGuide({ universities: [] })).toThrow()
  })
})

describe("reading", () => {
  const links = [normalizeLink(zh)!, normalizeLink(ru)!, normalizeLink({ ...zh, url: "https://youtu.be/x", platform: "youtube", topic: "russians", lang: "ru" })!]

  it("groups by topic in reading order, Russian first inside a topic", () => {
    const groups = groupLinks(links)
    expect(groups.map((g) => g.id)).toEqual(["russians", "dorm"])
    expect(groups[1].links.map((l) => l.lang)).toEqual(["ru", "zh"])
  })

  it("filters by the language of the original", () => {
    expect(groupLinks(links, "zh").flatMap((g) => g.links)).toHaveLength(1)
  })

  it("counts links, Russian ones and videos", () => {
    expect(linkStats(links)).toEqual({ total: 3, ru: 2, zh: 1, en: 0, video: 2 })
  })

  it("prints months and source hosts", () => {
    expect(formatMonth("2025-03")).toBe("март 2025")
    expect(sourceHost("https://www.tsinghua.edu.cn/en/")).toBe("tsinghua.edu.cn")
  })
})

describe("guide routes", () => {
  it("parses the three pages and falls back to the catalog", () => {
    expect(parseRoute("")).toEqual({ page: "home" })
    expect(parseRoute("#/")).toEqual({ page: "home" })
    expect(parseRoute("#/about")).toEqual({ page: "about" })
    expect(parseRoute("#/u/tsinghua-university")).toEqual({ page: "university", id: "tsinghua-university" })
    expect(parseRoute("#/u/../../etc")).toEqual({ page: "home" })
    expect(parseRoute("#/u/%E0%A4%A")).toEqual({ page: "home" })
    expect(parseRoute("#/whatever")).toEqual({ page: "home" })
  })

  it("builds the addresses back", () => {
    expect(universityHref("fudan-university")).toBe("#/u/fudan-university")
    expect(routeHref({ page: "about" })).toBe("#/about")
    expect(parseRoute(universityHref("xi-an-jiaotong-university"))).toEqual({ page: "university", id: "xi-an-jiaotong-university" })
  })
})

describe("ключ Supabase для форума", () => {
  it("старый anon-ключ идёт и в apikey, и в Authorization; новый publishable – только в apikey", async () => {
    const { restHeaders } = await import("@/data/forum")
    expect(restHeaders("eyJhbGciOi.x.y")).toMatchObject({ apikey: "eyJhbGciOi.x.y", Authorization: "Bearer eyJhbGciOi.x.y" })
    const h = restHeaders("sb_publishable_abc")
    expect(h.apikey).toBe("sb_publishable_abc")
    expect(h.Authorization).toBeUndefined()
  })
})
