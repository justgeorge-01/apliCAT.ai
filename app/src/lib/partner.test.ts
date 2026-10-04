import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { hasLead, partnerBySlug, resolvePartnerSlug } from "./partner"
import { DEFAULT_PARTNER_SLUG, PARTNERS } from "./partners"

// A fixture partner for the resolver: the public registry carries none.
beforeAll(() => {
  PARTNERS.demo = {
    slug: "demo",
    name: "Демо-агентство",
    lead: { label: "Обсудить с наставником", url: "https://t.me/example" },
    expertPage: { title: "Демо", paragraphs: ["Текст."] },
  }
})
afterAll(() => {
  delete PARTNERS.demo
})

describe("partner resolution", () => {
  it("defaults to abitura, which has no lead", () => {
    expect(DEFAULT_PARTNER_SLUG).toBe("abitura")
    expect(resolvePartnerSlug("", undefined)).toBe("abitura")
    expect(hasLead(partnerBySlug("abitura"))).toBe(false)
  })

  it("?partner= wins over the build-time env; unknown slugs fall back", () => {
    expect(resolvePartnerSlug("?partner=demo", undefined)).toBe("demo")
    expect(resolvePartnerSlug("?x=1&partner=DEMO", "abitura")).toBe("demo")
    expect(resolvePartnerSlug("", "demo")).toBe("demo")
    expect(resolvePartnerSlug("?partner=abitura", "demo")).toBe("abitura")
    expect(resolvePartnerSlug("?partner=nobody", "demo")).toBe("demo")
    expect(resolvePartnerSlug("?partner=../evil", "nobody")).toBe("abitura")
    expect(partnerBySlug("nobody").slug).toBe("abitura")
  })

  it("the public registry carries no partner besides the default", () => {
    expect(Object.keys(PARTNERS).filter((k) => k !== "demo")).toEqual(["abitura"])
  })

  it("the demo partner has a clickable lead and an expert page", () => {
    const z = PARTNERS.demo
    expect(hasLead(z)).toBe(true)
    expect(z.lead?.url).toMatch(/^https:\/\/t\.me\//)
    expect(z.lead?.label).toBe("Обсудить с наставником")
    expect(z.expertPage?.paragraphs.length).toBeGreaterThan(0)
  })
})
