import type { LucideIcon } from "lucide-react"
import { Archive, BadgeCheck, FlaskConical, PenLine } from "lucide-react"
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
  const archived =
    fact.snapshot?.render_method === "wayback"
      ? formatCheckedAt(fact.snapshot.archived_at ?? fact.verified_at)
      : null
  // A human's decision outranks the way the page was obtained: a value an
  // operator corrected stays «проверено вручную» even when the page it was
  // checked against came from the archive – the archive is then the caveat
  // in the note, not the headline.
  if (fact.origin === "manual") {
    return {
      kind: "manual",
      label: `проверено вручную · ${checked}`,
      note: archived
        ? `Значение введено оператором по архивной копии официальной страницы (archive.org) от ${archived}.`
        : "Значение введено оператором по официальной странице вуза.",
    }
  }
  if (archived) {
    return {
      kind: "wayback",
      label: `по архивной копии от ${archived}`,
      note: `Официальная страница была недоступна, значение взято из архивной копии (archive.org) от ${archived}.`,
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
 * How the four states LOOK – a text badge with a date, in a colour and with an
 * icon that differ per state, so a reader tells them apart without reading:
 *  auto    – red filled badge, check mark: extracted by the pipeline;
 *  manual  – red contour badge, pen: typed in by an operator;
 *  wayback – warning (ochre) badge, archive box: archive.org copy;
 *  demo    – grey badge, flask: the built-in fixture.
 * Single source of truth: ProvenanceBadge, the catalog card and the legend on
 * the landing page all read these two tables.
 */
export const PROVENANCE_VARIANT: Record<ProvenanceKind, "default" | "outline" | "warning" | "secondary"> = {
  auto: "default",
  manual: "outline",
  wayback: "warning",
  demo: "secondary",
}

export const PROVENANCE_ICON: Record<ProvenanceKind, LucideIcon> = {
  auto: BadgeCheck,
  manual: PenLine,
  wayback: Archive,
  demo: FlaskConical,
}
