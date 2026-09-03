import type { SealProps } from "@/components/ui/seal"
import { formatCheckedAt } from "@/data/china"
import type { Fact } from "@/data/china.types"

/**
 * The four provenance states of a fact (spec §3.3):
 *  - auto    – extracted by the pipeline from a fetch/browser snapshot;
 *  - manual  – typed in by an operator in the Пульт;
 *  - wayback – the official page was unreachable, the value comes from an
 *              archive.org copy (`snapshot.render_method === "wayback"`);
 *  - demo    – the built-in fixture, plainly grey.
 */
export type ProvenanceKind = "auto" | "manual" | "wayback" | "demo"

export interface Provenance {
  kind: ProvenanceKind
  /** Badge text, e.g. «проверено автоматически · 31 августа 2026». */
  label: string
  /** One-line explanation inside the expanded panel. */
  note: string
}

export function provenanceOf(fact: Fact): Provenance {
  const checked = formatCheckedAt(fact.verified_at)
  if (fact.origin === "demo") {
    return {
      kind: "demo",
      label: `демо · ${checked}`,
      note: "Демо-факт: перенесён вручную с официальной страницы, конвейер проверки не проходил.",
    }
  }
  if (fact.snapshot?.render_method === "wayback") {
    const archived = formatCheckedAt(fact.snapshot.archived_at ?? fact.verified_at)
    return {
      kind: "wayback",
      label: `по архивной копии от ${archived}`,
      note: `Официальная страница была недоступна, значение взято из архивной копии (archive.org) от ${archived}.`,
    }
  }
  if (fact.origin === "manual") {
    return {
      kind: "manual",
      label: `проверено вручную · ${checked}`,
      note: "Значение введено оператором по официальной странице вуза.",
    }
  }
  const fetched = fact.snapshot?.fetched_at ? formatCheckedAt(fact.snapshot.fetched_at) : null
  return {
    kind: "auto",
    label: `проверено автоматически · ${checked}`,
    note: fetched
      ? `Значение извлечено конвейером из снимка официальной страницы от ${fetched}.`
      : "Значение извлечено конвейером из снимка официальной страницы.",
  }
}

/**
 * The seal (印章) of each state – the product's main visual mark. Solid red
 * for a real check, contour for an archive copy or the demo fixture; the
 * glyph names the state and the Russian label next to it is its meaning:
 *  印 «печать» – checked by the pipeline;  手 «рукой» – typed in by an operator;
 *  档 «архив» – archive.org copy;          试 «проба» – demo fixture.
 */
const SEALS: Record<ProvenanceKind, Pick<SealProps, "glyph" | "variant" | "tone">> = {
  auto: { glyph: "印", variant: "solid", tone: "accent" },
  manual: { glyph: "手", variant: "solid", tone: "accent" },
  wayback: { glyph: "档", variant: "outline", tone: "warning" },
  demo: { glyph: "试", variant: "outline", tone: "muted" },
}

/**
 * The seal of one fact – the single source of truth for the four states, so
 * the compact mark on the catalog card and the full badge on the detail page
 * can never disagree.
 */
export function sealOfFact(fact: Fact): Pick<SealProps, "glyph" | "variant" | "tone"> {
  return SEALS[provenanceOf(fact).kind]
}
