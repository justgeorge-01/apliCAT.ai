/**
 * University card components (spec §3.3): provenance badge states, the empty
 * fact row, verbatim `display`, the CSCA block. Rendered to static markup –
 * no DOM environment is installed, and what matters here is the text.
 */
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import type { Fact, University } from "@/data/china.types"
import { CscaBlock } from "./CscaBlock"
import { FactItem, FactRow } from "./FactRow"
import { ProvenanceBadge } from "./ProvenanceBadge"

const SOURCE = "https://www.example-university.edu.cn/admissions/fees"

function fact(over: Partial<Fact> = {}): Fact {
  return {
    key: "fees.tuition_year_non_eu",
    label_ru: "Стоимость обучения в год (иностранцы)",
    value: { amount_minor: 9_300_000, currency: "CNY" },
    display: "93 000 ¥ в год",
    academic_year: "2026/2027",
    quote: "International Students: RMB 93,000 per academic year.",
    source_url: SOURCE,
    verified_at: "2026-08-31",
    origin: "auto",
    certainty: "verified",
    snapshot: { render_method: "fetch", fetched_at: "2026-08-30", archived_at: null },
    ...over,
  }
}

function uni(facts: Fact[], last_checked_at: string | null = "2026-08-31"): University {
  return {
    id: "demo-u",
    name: "Demo University",
    name_ru: "Демонстрационный университет",
    city: "Beijing",
    country: "CN",
    website: "https://www.example-university.edu.cn/",
    last_checked_at,
    facts,
    coverage: { published: facts.length, expected: 8 },
  }
}

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe("ProvenanceBadge", () => {
  it("auto: «проверено автоматически · <дата>»", () => {
    const out = html(<ProvenanceBadge fact={fact()} />)
    expect(out).toContain("проверено автоматически · 31 августа 2026")
    expect(out).toContain('aria-expanded="false"')
  })

  it("manual: «проверено вручную · <дата>»", () => {
    const out = html(<ProvenanceBadge fact={fact({ origin: "manual", snapshot: null })} />)
    expect(out).toContain("проверено вручную · 31 августа 2026")
  })

  it("wayback: «по архивной копии от <archived_at>» wins over origin", () => {
    const out = html(
      <ProvenanceBadge
        fact={fact({
          origin: "auto",
          snapshot: { render_method: "wayback", fetched_at: "2026-08-30", archived_at: "2026-07-15" },
        })}
      />,
    )
    expect(out).toContain("по архивной копии от 15 июля 2026")
    expect(out).not.toContain("проверено автоматически")
  })

  it("demo: plainly grey «демо» badge", () => {
    const out = html(<ProvenanceBadge fact={fact({ origin: "demo", snapshot: null, quote: null })} />)
    expect(out).toContain("демо · 31 августа 2026")
    expect(out).toContain('data-variant="secondary"')
  })

  it("non-verified certainty is flagged in the badge", () => {
    expect(html(<ProvenanceBadge fact={fact({ certainty: "estimate" })} />)).toContain("оценка")
    expect(html(<ProvenanceBadge fact={fact({ certainty: "community_estimate" })} />)).toContain(
      "оценка сообщества",
    )
    expect(html(<ProvenanceBadge fact={fact()} />)).not.toContain("оценка")
  })

  it("is collapsed by default – quote and link appear only on click", () => {
    const out = html(<ProvenanceBadge fact={fact()} />)
    expect(out).not.toContain(SOURCE)
    expect(out).not.toContain("RMB 93,000")
  })
})

describe("FactRow", () => {
  it("prints display verbatim, the academic year and a badge", () => {
    const out = html(<FactRow label="Стоимость обучения в год" facts={[fact()]} lastCheckedAt="2026-08-31" />)
    expect(out).toContain("93 000 ¥ в год")
    expect(out).toContain("учебный год 2026/2027")
    expect(out).toContain("проверено автоматически")
    expect(out).toContain("<dt")
    expect(out).toContain("<dd")
  })

  it("empty fact: «вуз не публикует · проверено <last_checked_at>», the row is kept", () => {
    const out = html(<FactRow label="Общежитие в месяц" facts={[]} lastCheckedAt="2026-08-31" />)
    expect(out).toContain("Общежитие в месяц")
    expect(out).toContain("вуз не публикует · проверено 31 августа 2026")
  })

  it("empty fact without a check: «проверка не проводилась»", () => {
    const out = html(<FactRow label="Общежитие в месяц" facts={[]} lastCheckedAt={null} />)
    expect(out).toContain("вуз не публикует · проверка не проводилась")
  })

  it("emptyLabel replaces «вуз не публикует»", () => {
    const out = html(<FactRow label="CSCA" facts={[]} lastCheckedAt="2026-08-31" emptyLabel="вуз не заявил" />)
    expect(out).toContain("вуз не заявил · проверено 31 августа 2026")
  })

  it("FactItem alone prints the value with its badge", () => {
    const out = html(<FactItem fact={fact()} sublabel="Стоимость" />)
    expect(out).toContain("Стоимость")
    expect(out).toContain("93 000 ¥ в год")
    expect(out).toContain("проверено автоматически")
  })

  it("sublabels come from each fact's label_ru", () => {
    const hsk = fact({ key: "requirements.hsk_min", label_ru: "Минимальный HSK", value: { value: 5 }, display: "HSK 5" })
    const out = html(<FactRow label="Язык обучения и сертификат" facts={[hsk]} lastCheckedAt="2026-08-31" sublabels />)
    expect(out).toContain("Минимальный HSK")
    expect(out).toContain("HSK 5")
  })

  it("critical rows carry the shield marker", () => {
    const out = html(<FactRow label="Дедлайн подачи" facts={[]} lastCheckedAt={null} critical />)
    expect(out).toContain("критичное поле")
    expect(html(<FactRow label="Общежитие" facts={[]} lastCheckedAt={null} />)).not.toContain("критичное поле")
  })
})

describe("CscaBlock", () => {
  const required = fact({
    key: "requirements.csca_required",
    label_ru: "Требуется CSCA",
    value: { value: true },
    display: "требуется с 2026/27",
    origin: "demo",
    snapshot: null,
    quote: null,
  })

  it("required: status badge + the fact with its badge", () => {
    const out = html(<CscaBlock u={uni([required])} />)
    expect(out).toContain("Требуется")
    expect(out).toContain("требуется с 2026/27")
    expect(out).toContain("демо · 31 августа 2026")
  })

  it("not required", () => {
    const out = html(<CscaBlock u={uni([{ ...required, value: { value: false }, display: "не требуется" }])} />)
    expect(out).toContain("Не требуется")
  })

  it("unknown: «вуз не заявил · проверено <дата>»", () => {
    const out = html(<CscaBlock u={uni([])} />)
    expect(out).toContain("Вуз не заявил")
    expect(out).toContain("вуз не заявил · проверено 31 августа 2026")
  })

  it("modules are listed even when the requirement itself is not stated", () => {
    const subjects = fact({
      key: "requirements.csca_subjects",
      label_ru: "Модули CSCA",
      value: { items: ["математика", "физика"] },
      display: "математика, физика",
    })
    const out = html(<CscaBlock u={uni([subjects])} />)
    expect(out).toContain("Вуз не заявил")
    expect(out).toContain("вуз не заявил · проверено 31 августа 2026")
    expect(out).toContain("Модули CSCA")
    expect(out).toContain("математика, физика")
  })

  it("always prints the phased roll-out note with its source and check date", () => {
    const out = html(<CscaBlock u={uni([])} />)
    expect(out).toContain("2026/27")
    expect(out).toContain("2028")
    expect(out).toContain('href="https://csca.cn/"')
    expect(out).toContain("текст проверен 31 августа 2026")
  })
})
