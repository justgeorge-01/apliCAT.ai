import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

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

const CRITICAL_FIELD_LABEL = "критичное поле: сверьтесь с сайтом вуза перед подачей"

/**
 * The mark of a critical field (deadlines, HSK/IELTS, CSCA): a small warning
 * triangle. It is not a provenance state – the provenance badge stands on the
 * value, this stands on the LABEL and says «check this one on the site before
 * you apply». Next to a row label it names the field itself (role="img" +
 * label); in the disclaimer line under the card the text next to it carries
 * the meaning, so there it is `decorative`.
 */
export function CriticalMark({ decorative = false, className }: { decorative?: boolean; className?: string }) {
  return (
    <AlertTriangle
      className={cn("size-3.5 shrink-0 text-warning", className)}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": CRITICAL_FIELD_LABEL })}
    >
      {decorative ? null : <title>{CRITICAL_FIELD_LABEL}</title>}
    </AlertTriangle>
  )
}

export interface FactItemProps {
  fact: Fact
  /** Printed above the value (the fact's own `label_ru` in rows that group several keys). */
  sublabel?: string
}

/**
 * One printed fact, one ledger line: optional sub-label · `display` set large
 * in the display face · academic year – and the provenance badge at the right
 * end. The badge's quote panel is full-width and wraps under the line.
 */
export function FactItem({ fact, sublabel }: FactItemProps) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-48">
        {sublabel && <div className="mb-0.5 text-xs text-fg-muted">{sublabel}</div>}
        {/* the value is printed exactly as the pipeline rendered it – never reformatted here */}
        <div className="font-display text-lg leading-snug font-bold break-words text-fg sm:text-xl">
          {fact.display}
        </div>
        {fact.academic_year && <div className="mt-0.5 text-xs text-fg-muted">учебный год {fact.academic_year}</div>}
      </div>
      <ProvenanceBadge fact={fact} className="mt-0.5 sm:mt-1" />
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
  /** Critical field (deadlines, HSK/IELTS, CSCA): marked with the warning mark, see the line under the card. */
  critical?: boolean
  /** Print each fact's own `label_ru` above its value (rows that group several keys). */
  sublabels?: boolean
  /** Replaces «вуз не публикует» in the empty state. */
  emptyLabel?: string
  /** Rendered above the facts (e.g. the CSCA status badge). */
  lead?: ReactNode
  /** Rendered under the facts (e.g. the CSCA footnote). */
  children?: ReactNode
  className?: string
}

/**
 * One row of the university card (spec §3.3), set like a ledger on paper:
 * label at the left (Noto Sans 600), the `display` value large, the
 * provenance badge at the right, a thin rule under the row. Every fact here
 * has `source_url` + `verified_at` (guaranteed by `normalizeCatalog`), so a
 * badge is always present.
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
        "grid grid-cols-1 gap-y-2.5 border-b border-border py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-x-6 sm:py-5",
        className,
      )}
    >
      <dt className="flex items-center gap-2 text-[13px] leading-snug font-semibold text-fg-muted sm:pt-1">
        <span>{label}</span>
        {critical && <CriticalMark />}
      </dt>
      <dd className="flex min-w-0 flex-col gap-4">
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
