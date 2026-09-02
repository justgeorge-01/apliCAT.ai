import { Check, ClipboardList, Minus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cscaStatus, factOf, formatCheckedAt } from "@/data/china"
import type { University } from "@/data/china.types"

const LABELS = {
  required: "CSCA требуется",
  not_required: "CSCA не требуется",
  unknown: "CSCA: не опубликовано",
} as const

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
  const variant = status === "required" ? "default" : status === "not_required" ? "secondary" : "outline"
  const Icon = status === "required" ? ClipboardList : status === "not_required" ? Check : Minus

  return (
    <Badge variant={variant} className={className} title={title} data-status={status}>
      <Icon aria-hidden="true" />
      {LABELS[status]}
    </Badge>
  )
}
