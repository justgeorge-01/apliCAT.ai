import { ShieldCheck } from "lucide-react"

import type { University } from "@/data/china.types"
import { coverageText } from "@/lib/catalogView"
import { cn } from "@/lib/utils"

/**
 * «7 из 8 фактов проверено · проверено 31 августа 2026» – coverage and the
 * date of the last check, straight from the export (`coverage`,
 * `last_checked_at`). A university without facts reads
 * «данные не опубликованы · проверка не проводилась».
 */
export function CoverageLine({ u, className }: { u: University; className?: string }) {
  const { published, facts, checked } = coverageText(u)
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-muted", className)}>
      <ShieldCheck
        className={cn("size-3.5 shrink-0", published > 0 ? "text-accent-text" : "text-fg-faint")}
        aria-hidden="true"
      />
      <span>{facts}</span>
      <span className="text-fg-faint" aria-hidden="true">
        ·
      </span>
      <span>{checked}</span>
    </div>
  )
}
