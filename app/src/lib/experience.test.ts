import { describe, expect, it } from "vitest"

import {
  experienceOf,
  formatWrittenAt,
  groupByTopic,
  layerLabel,
  normalizeExperience,
  normalizeItem,
  type ExperienceItem,
} from "@/data/experience"

const alumni = {
  topic: "dormitory",
  text: "Иностранцы живут в отдельном корпусе по двое, кухня общая на этаж.",
  layer: "alumni",
  source_url: null,
  written_at: "2026-10",
  author: "бакалавриат, набор 2024",
  reviewed_at: "2026-10-05",
}
const retold = {
  topic: "city",
  text: "Зимой в общежитии холодно, отопление включают с 15 ноября.",
  layer: "manual",
  platform: "xiaohongshu",
  source_url: "https://www.xiaohongshu.com/explore/abc",
  written_at: "2025-12-03",
  reviewed_at: "2026-10-05",
}

describe("normalizeItem", () => {
  it("keeps a graduate's answer without a public link", () => {
    const item = normalizeItem(alumni)
    expect(item).not.toBeNull()
    expect(item?.platform).toBe("alumni")
    expect(item?.source_url).toBeNull()
  })

  it("a retold or collected post must link to its source over https", () => {
    expect(normalizeItem(retold)?.source_url).toBe("https://www.xiaohongshu.com/explore/abc")
    expect(normalizeItem({ ...retold, source_url: null })).toBeNull()
    expect(normalizeItem({ ...retold, source_url: "http://example.com/post" })).toBeNull()
    expect(normalizeItem({ ...retold, layer: "auto", source_url: "javascript:alert(1)" })).toBeNull()
  })

  it("drops items without a known topic, text, author date or approval date", () => {
    expect(normalizeItem({ ...alumni, topic: "rumours" })).toBeNull()
    expect(normalizeItem({ ...alumni, text: "  " })).toBeNull()
    expect(normalizeItem({ ...alumni, written_at: "вчера" })).toBeNull()
    expect(normalizeItem({ ...alumni, reviewed_at: undefined })).toBeNull()
    expect(normalizeItem({ ...alumni, layer: "demo" })).toBeNull()
  })

  it("an unknown platform of a retold post reads as a plain «источник»", () => {
    const item = normalizeItem({ ...retold, platform: "weibo" })
    expect(item?.platform).toBe("other")
    expect(layerLabel(item as ExperienceItem)).toBe("пересказ поста, источник")
  })
})

describe("normalizeExperience", () => {
  it("keeps valid items per university and leaves out empty lists", () => {
    const data = normalizeExperience({
      generated_at: "2026-10-05",
      universities: { "tsinghua-university": [alumni, { topic: "x" }], "fudan-university": [{}] },
    })
    expect(experienceOf(data, "tsinghua-university")).toHaveLength(1)
    expect(experienceOf(data, "fudan-university")).toEqual([])
    expect(experienceOf(data, "constructor")).toEqual([])
  })

  it("refuses something that is not an experience file", () => {
    expect(() => normalizeExperience([])).toThrow()
    expect(() => normalizeExperience({ universities: [] })).toThrow()
  })
})

describe("reading", () => {
  it("groups by topic in reading order, newest first inside a topic", () => {
    const a = normalizeItem(alumni) as ExperienceItem
    const older = normalizeItem({ ...alumni, written_at: "2024-05", text: "Раньше было по четверо." }) as ExperienceItem
    const city = normalizeItem(retold) as ExperienceItem
    const groups = groupByTopic([city, older, a])
    expect(groups.map((g) => g.id)).toEqual(["dormitory", "city"])
    expect(groups[0].items.map((i) => i.written_at)).toEqual(["2026-10", "2024-05"])
  })

  it("names each layer in words", () => {
    expect(layerLabel(normalizeItem(alumni) as ExperienceItem)).toBe("выпускник партнёрского агентства")
    expect(layerLabel(normalizeItem(retold) as ExperienceItem)).toBe("пересказ поста, Xiaohongshu")
    expect(
      layerLabel(normalizeItem({ ...retold, layer: "auto", platform: "youtube", source_url: "https://youtu.be/x" }) as ExperienceItem),
    ).toBe("YouTube, собрано автоматически")
  })

  it("prints the author's date as month and year", () => {
    expect(formatWrittenAt("2025-12-03")).toBe("декабрь 2025")
    expect(formatWrittenAt("2026-10")).toBe("октябрь 2026")
  })
})
