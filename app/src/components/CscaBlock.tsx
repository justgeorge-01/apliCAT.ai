import { ExternalLink } from "lucide-react"

import { FactItem, FactRow } from "@/components/FactRow"
import { Badge } from "@/components/ui/badge"
import { cscaStatus, factsOf, formatCheckedAt, lastChecked } from "@/data/china"
import type { University } from "@/data/china.types"
import { CSCA_BADGE, CSCA_LABEL } from "@/lib/catalogView"
import { cn } from "@/lib/utils"

/**
 * The phased CSCA roll-out, as the storefront states it (spec §3.1 / §3.3).
 * Not a university fact – a general note with its own source and check date,
 * the same way `FIXED_DATES` in lib/plan.ts carries its provenance.
 */
const CSCA_NOTE = {
  text:
    "CSCA вводится поэтапно: с 2026/27 экзамен обязателен для вузов сети правительственных стипендий и для стипендии CSC. " +
    "Распространение на все вузы и минимальные проходные баллы – план с 2028 года. " +
    "Вузы применяют требование по-разному: статус выше – это то, что заявил именно этот вуз.",
  source_url: "https://csca.cn/",
  source_label: "csca.cn",
  verified_at: "2026-08-31",
}


export interface CscaBlockProps {
  u: University
  className?: string
}

/**
 * The CSCA row of the university card – the one row set apart: a red rule
 * at the left on a faint red wash. Its label is a plain one: the card already
 * carries its single Han kicker («事实 Факты»). Inside:
 * the status badge, the `csca_required` fact with provenance, the
 * `csca_subjects` facts (modules) beneath it, and the honest footnote about
 * the phased roll-out. When the university has not stated the requirement
 * the row reads «вуз не заявил · проверено <дата>».
 */
export function CscaBlock({ u, className }: CscaBlockProps) {
  const status = cscaStatus(u)
  const required = factsOf(u, "requirements.csca_required")
  const subjects = factsOf(u, "requirements.csca_subjects")

  return (
    <FactRow
      label="CSCA"
      facts={required}
      lastCheckedAt={lastChecked(u)}
      critical
      sublabels
      className={cn("my-3 rounded-md border-b-0 border-l-2 border-accent bg-accent-soft px-4 sm:px-5", className)}
      lead={
        <div>
          <Badge variant={CSCA_BADGE[status].variant} className={CSCA_BADGE[status].className}>
            {CSCA_LABEL[status]}
          </Badge>
        </div>
      }
    >
      {subjects.map((f, i) => (
        <FactItem key={`${f.key}:${i}`} fact={f} sublabel={f.label_ru} />
      ))}
      <p className="text-xs leading-relaxed text-fg-muted">
        {CSCA_NOTE.text}{" "}
        <a
          href={CSCA_NOTE.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-semibold whitespace-nowrap text-accent-text hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          {CSCA_NOTE.source_label}
        </a>
        <span> · текст проверен {formatCheckedAt(CSCA_NOTE.verified_at)}</span>
      </p>
    </FactRow>
  )
}

export default CscaBlock
