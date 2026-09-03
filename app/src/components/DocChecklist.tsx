import { SourceLink } from "@/components/DeadlineFeed"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import type { University } from "@/data/china.types"
import { docChecklist, docProgress, type PlanEntry } from "@/lib/plan"
import { cn } from "@/lib/utils"

export interface DocChecklistProps {
  university: University
  entry: PlanEntry
  onToggle: (docId: string, done: boolean) => void
}

/**
 * Документы по вузу (spec §3.4): the base list plus the university's own
 * `docs.required_list` from the export, each with a checkbox. Items that come
 * from the university carry their provenance line; items without it are not
 * shown (the export guarantees it, this is a belt-and-braces filter).
 *
 * Paper ledger look: a thin rule between items, a square box in an ink frame,
 * a red check mark once the document is ready; the progress is a hairline.
 */
export function DocChecklist({ university: u, entry, onToggle }: DocChecklistProps) {
  const items = docChecklist(u).filter((d) => d.origin === "base" || (d.source_url && d.verified_at))
  const progress = docProgress(entry, u)
  const hasUniList = items.some((d) => d.origin === "university")

  return (
    <section aria-label="Документы">
      <div className="flex items-end justify-between gap-3">
        <HanziKicker hanzi="文件">Документы</HanziKicker>
        <span className="text-xs text-fg-muted">
          <span className="font-display text-base leading-none font-bold text-accent-text tabular-nums">
            {progress.done}
          </span>{" "}
          из {progress.total} · {progress.pct}%
        </span>
      </div>

      <div
        className="mt-2.5 h-1 w-full overflow-hidden bg-fg/12"
        role="progressbar"
        aria-label="Готовность документов"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
      >
        {/* scaleX instead of width: only transform/opacity are animated (DESIGN.md) */}
        <div
          className="h-full origin-left bg-accent transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${progress.pct / 100})` }}
        />
      </div>

      <ul className="mt-1 flex flex-col divide-y divide-border">
        {items.map((d) => {
          const id = `doc-${u.id}-${d.id}`
          const done = Boolean(entry.docs[d.id])
          return (
            <li key={d.id} className="flex items-start gap-3 py-2.5">
              <Checkbox
                id={id}
                checked={done}
                onCheckedChange={(v) => onToggle(d.id, v === true)}
                className="mt-0.5 rounded-[2px] border-fg/70 bg-card data-[state=checked]:border-fg data-[state=checked]:bg-card data-[state=checked]:text-accent-text"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={id}
                  className={cn("block cursor-pointer text-sm leading-snug", done && "text-fg-muted line-through")}
                >
                  {d.label}
                </label>
                {d.origin === "university" && d.source_url && d.verified_at && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant="outline">по списку вуза</Badge>
                    <SourceLink url={d.source_url} verifiedAt={d.verified_at} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-xs text-fg-faint">
        {hasUniList
          ? "Базовый список дополнен перечнем с официальной страницы вуза."
          : "Базовый список – общий ориентир; точный перечень смотрите на сайте вуза."}
      </p>
    </section>
  )
}
