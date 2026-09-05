import { describe, expect, it } from "vitest"

import type { Fact } from "@/data/china.types"
import { provenanceOf } from "@/lib/provenance"

const base: Fact = {
  key: "requirements.language_of_instruction",
  label_ru: "Язык обучения",
  value: { value: "Chinese" },
  display: "китайский",
  academic_year: null,
  degree_scope: null,
  intake_round: null,
  quote: "taught in Chinese",
  source_url: "https://u.edu.cn/x",
  verified_at: "2026-09-05",
  origin: "auto",
  certainty: "verified",
  snapshot: { render_method: "fetch", fetched_at: "2026-09-05", archived_at: null },
}

describe("provenanceOf – which of the four states a fact is in", () => {
  it("a direct pipeline read is «проверено автоматически»", () => {
    expect(provenanceOf(base).kind).toBe("auto")
  })
  it("an archive copy is «по архивной копии от <дата>»", () => {
    const p = provenanceOf({ ...base, snapshot: { render_method: "wayback", fetched_at: "2026-09-05", archived_at: "2026-05-11" } })
    expect(p.kind).toBe("wayback")
    expect(p.label).toMatch(/по архивной копии от/)
  })
  it("a human correction outranks the archive: manual headline, archive in the note", () => {
    const p = provenanceOf({
      ...base,
      origin: "manual",
      snapshot: { render_method: "wayback", fetched_at: "2026-09-05", archived_at: "2026-05-11" },
    })
    expect(p.kind).toBe("manual")
    expect(p.label).toMatch(/проверено вручную/)
    expect(p.note).toMatch(/архивной копии/)
  })
  it("a demo fact is demo whatever else it says", () => {
    expect(provenanceOf({ ...base, origin: "demo" }).kind).toBe("demo")
  })
})
