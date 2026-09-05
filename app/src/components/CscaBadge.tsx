import { Badge } from "@/components/ui/badge"
import { cscaStatus, factOf, formatCheckedAt, type CscaStatus } from "@/data/china"
import type { University } from "@/data/china.types"
import { CSCA_BADGE } from "@/lib/catalogView"
import { cn } from "@/lib/utils"

const LABELS: Record<CscaStatus, string> = {
  required: "CSCA требуется",
  not_required: "CSCA не требуется",
  unknown: "CSCA: не опубликовано",
}

/**
 * CSCA badge of a university card (spec §3.2): required / not required /
 * «не опубликовано». Derived from `requirements.csca_required`; the tooltip
 * carries the fact's own `display` and verification date. Informational only –
 * never a verdict about the applicant.
 */
export function CscaBadge({ u, className }: { u: University; className?: string }) {
  const status = cscaStatus(u)
  const fact = factOf(u, "requirements.csca_required")
  const title = fact
    ? `${fact.display} · проверено ${formatCheckedAt(fact.verified_at)}`
    : "Вуз не заявил, требуется ли CSCA"
  const style = CSCA_BADGE[status]

  return (
    <Badge variant={style.variant} className={cn(style.className, className)} title={title} data-status={status}>
      {LABELS[status]}
    </Badge>
  )
}
