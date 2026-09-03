import { Badge } from "@/components/ui/badge"
import { cscaStatus, factOf, formatCheckedAt, type CscaStatus } from "@/data/china"
import type { University } from "@/data/china.types"
import { cn } from "@/lib/utils"

const LABELS: Record<CscaStatus, string> = {
  required: "CSCA требуется",
  not_required: "CSCA не требуется",
  unknown: "CSCA: не опубликовано",
}

/**
 * Printed-label look, no icons: «требуется» is a red label with a thin red
 * rim, «не требуется» an ink contour, «не опубликовано» a dashed contour –
 * three states told apart by colour AND by the words.
 */
const STYLES: Record<CscaStatus, { variant: "default" | "outline"; className: string }> = {
  required: { variant: "default", className: "border-accent/40 font-semibold" },
  not_required: { variant: "outline", className: "border-fg/40 text-fg" },
  unknown: { variant: "outline", className: "border-dashed text-fg-muted" },
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
  const style = STYLES[status]

  return (
    <Badge variant={style.variant} className={cn(style.className, className)} title={title} data-status={status}>
      {LABELS[status]}
    </Badge>
  )
}
