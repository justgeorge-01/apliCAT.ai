import type { University } from "@/data/china.types"
import { coverageText } from "@/lib/catalogView"
import { cn } from "@/lib/utils"

/**
 * «7 из 11 фактов проверено · проверено 2 сентября 2026» – coverage and the
 * date of the last check, straight from the export (`coverage`,
 * `last_checked_at`). Drawn as a thin scale: a hairline track across the card
 * with a red fill for the published share, the words beneath it. A university
 * without facts has an empty track and reads «данные не опубликованы ·
 * проверка не проводилась».
 *
 * The scale is decorative (aria-hidden) – the sentence carries the numbers.
 */
export function CoverageLine({ u, className }: { u: University; className?: string }) {
  const { published, facts, checked } = coverageText(u)
  const { expected } = u.coverage
  const share = expected > 0 ? Math.min(1, Math.max(0, published / expected)) : 0

  return (
    <div className={cn("min-w-0 text-xs text-fg-muted", className)} data-slot="coverage-line">
      <div className="h-0.5 w-full bg-border-strong" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={cn(published > 0 && "font-semibold text-fg")}>{facts}</span>
        <span className="text-fg-faint" aria-hidden="true">
          ·
        </span>
        <span>{checked}</span>
      </div>
    </div>
  )
}
