import { describe, expect, it } from "vitest"

import { hasLead, partnerBySlug, resolvePartnerSlug } from "./partner"
import { DEFAULT_PARTNER_SLUG, PARTNERS } from "./partners"

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

  it("the demo partner has a clickable lead and an expert page", () => {
    const z = PARTNERS.demo
    expect(hasLead(z)).toBe(true)
    expect(z.lead?.url).toMatch(/^https:\/\/t\.me\//)
    expect(z.lead?.label).toBe("Обсудить с наставником")
    expect(z.expertPage?.paragraphs.length).toBeGreaterThan(0)
  })
})
