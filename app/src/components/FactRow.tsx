import type { ReactNode } from "react"
import { ShieldAlert } from "lucide-react"

import { ProvenanceBadge } from "@/components/ProvenanceBadge"
import { formatCheckedAt } from "@/data/china"
import type { Fact } from "@/data/china.types"
import { cn } from "@/lib/utils"

/** «вуз не публикует · проверено 31 августа 2026» / «… · проверка не проводилась». */
function emptyFactText(lastCheckedAt: string | null, label: string = "вуз не публикует"): string {
  return lastCheckedAt
    ? `${label} · проверено ${formatCheckedAt(lastCheckedAt)}`
    : `${label} · проверка не проводилась`
}

export interface FactItemProps {
  fact: Fact
  /** Printed above the value (the fact's own `label_ru` in rows that group several keys). */
  sublabel?: string
}

/** One printed fact: optional sub-label · `display` · academic year · provenance badge. */
export function FactItem({ fact, sublabel }: FactItemProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {sublabel && <div className="text-xs text-fg-faint">{sublabel}</div>}
      {/* the value is printed exactly as the pipeline rendered it – never reformatted here */}
      <div className="text-[15px] leading-snug font-medium break-words text-fg">{fact.display}</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fg-muted">
        {fact.academic_year && <span>учебный год {fact.academic_year}</span>}
        <ProvenanceBadge fact={fact} />
      </div>
    </div>
  )
}

export interface FactRowProps {
  /** Row label, e.g. «Дедлайн подачи». */
  label: string
  /** Facts to print, in order. Empty → «вуз не публикует · проверено …» (the row is never skipped). */
  facts: Fact[]
  /** `University.last_checked_at` – printed in the empty state. */
  lastCheckedAt: string | null
  /** Critical field (deadlines, HSK/IELTS, CSCA): marked with the shield icon, see the line under the card. */
  critical?: boolean
  /** Print each fact's own `label_ru` above its value (rows that group several keys). */
  sublabels?: boolean
  /** Replaces «вуз не публикует» in the empty state, e.g. «вуз не заявил» for CSCA. */
  emptyLabel?: string
  /** Rendered above the facts (e.g. the CSCA status badge). */
  lead?: ReactNode
  /** Rendered under the facts (e.g. the CSCA footnote). */
  children?: ReactNode
  className?: string
}

/**
 * One row of the university card (spec §3.3): label · `display` · academic
 * year · `ProvenanceBadge`. Every fact here has `source_url` + `verified_at`
 * (guaranteed by `normalizeCatalog`), so a badge is always present.
 *
 * Renders a `<div>` group with `<dt>`/`<dd>` – put rows inside a `<dl>`.
 */
export function FactRow({
  label,
  facts,
  lastCheckedAt,
  critical = false,
  sublabels = false,
  emptyLabel,
  lead,
  children,
  className,
}: FactRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-y-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-6",
        className,
      )}
    >
      <dt className="flex items-center gap-1.5 text-[13px] font-medium text-fg-muted">
        <span>{label}</span>
        {critical && (
          <ShieldAlert
            className="size-3.5 shrink-0 text-warning"
            role="img"
            aria-label="критичное поле: сверьтесь с сайтом вуза перед подачей"
          />
        )}
      </dt>
      <dd className="flex min-w-0 flex-col gap-3.5">
        {lead}
        {facts.length > 0 ? (
          facts.map((f, i) => (
            <FactItem key={`${f.key}:${i}`} fact={f} sublabel={sublabels ? f.label_ru : undefined} />
          ))
        ) : (
          <p className="text-sm text-fg-muted">{emptyFactText(lastCheckedAt, emptyLabel)}</p>
        )}
        {children}
      </dd>
    </div>
  )
}

export default FactRow
