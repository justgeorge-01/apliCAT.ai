import { ListChecks } from "lucide-react"

import { SourceLink } from "@/components/DeadlineFeed"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
 */
export function DocChecklist({ university: u, entry, onToggle }: DocChecklistProps) {
  const items = docChecklist(u).filter((d) => d.origin === "base" || (d.source_url && d.verified_at))
  const progress = docProgress(entry, u)
  const hasUniList = items.some((d) => d.origin === "university")

  return (
    <section aria-label="Документы">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-fg-muted uppercase">
          <ListChecks className="size-3.5 text-accent-text" />
          Документы
        </div>
        <span className="text-xs font-semibold text-fg-muted">
          {progress.done} из {progress.total} · {progress.pct}%
        </span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10"
        role="progressbar"
        aria-label="Готовность документов"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
      >
        {/* scaleX instead of width: only transform/opacity are animated (DESIGN.md) */}
        <div
          className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${progress.pct / 100})` }}
        />
      </div>

      <ul className="mt-2 flex flex-col">
        {items.map((d) => {
          const id = `doc-${u.id}-${d.id}`
          const done = Boolean(entry.docs[d.id])
          return (
            <li key={d.id} className="flex items-start gap-3 py-2">
              <Checkbox
                id={id}
                checked={done}
                onCheckedChange={(v) => onToggle(d.id, v === true)}
                className="mt-0.5"
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

      <p className="mt-1 text-xs text-fg-faint">
        {hasUniList
          ? "Базовый список дополнен перечнем с официальной страницы вуза."
          : "Базовый список – общий ориентир; точный перечень смотрите на сайте вуза."}
      </p>
    </section>
  )
}
