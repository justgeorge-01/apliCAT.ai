import { CalendarDays, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Kicker } from "@/components/ui/kicker"
import { formatCheckedAt } from "@/data/china"
import { daysLeftLabel, type DeadlineItem } from "@/lib/plan"
import { cn } from "@/lib/utils"

/**
 * «источник · проверено 31 августа 2026» – the provenance line that every
 * printed fact / date carries (spec: no fact without a source and a date).
 * `verifiedAt` is metadata, so it goes through `formatCheckedAt`; fact VALUES
 * are never formatted here.
 */
export function SourceLink({
  url,
  verifiedAt,
  label = "источник",
  className,
}: {
  url: string
  verifiedAt: string
  label?: string
  className?: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-xs text-fg-muted underline-offset-2 transition-colors duration-200 hover:text-accent-text hover:underline",
        className,
      )}
    >
      <ExternalLink className="size-3 shrink-0" />
      <span className="truncate">
        {label} · проверено {formatCheckedAt(verifiedAt)}
      </span>
    </a>
  )
}

/** Countdown badge tone: passed is quiet, a week is warning, a month is accent, later is neutral. */
function countdownVariant(item: DeadlineItem): "outline" | "warning" | "default" | "secondary" {
  if (item.passed) return "outline"
  if (item.daysLeft <= 7) return "warning"
  if (item.daysLeft <= 30) return "default"
  return "secondary"
}

function DeadlineRow({
  item,
  onOpenUniversity,
}: {
  item: DeadlineItem
  onOpenUniversity?: (id: string) => void
}) {
  const uniId = item.kind === "university" ? item.universityId : null
  return (
    <li className={cn("border-t border-border py-3 first:border-t-0", item.passed && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {uniId && onOpenUniversity ? (
              <button
                type="button"
                onClick={() => onOpenUniversity(uniId)}
                className="rounded-md text-left text-sm font-semibold transition-colors duration-200 outline-none hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {item.title}
              </button>
            ) : (
              <span className="text-sm font-semibold">{item.title}</span>
            )}
            {item.kind === "common" && <Badge variant="outline">общие</Badge>}
          </div>
          {item.kind === "university" && item.subtitle && (
            <div className="text-xs text-fg-muted">{item.subtitle}</div>
          )}
        </div>
        <Badge variant={countdownVariant(item)} className="shrink-0">
          {daysLeftLabel(item)}
        </Badge>
      </div>

      {/* The date text is printed as is – `fact.display` or `FixedDate.display`. */}
      <div className="mt-1.5 text-sm leading-snug">{item.display}</div>

      {item.note && <div className="mt-1 text-xs text-fg-faint">{item.note}</div>}
      <SourceLink className="mt-1" url={item.source_url} verifiedAt={item.verified_at} />
    </li>
  )
}

export interface DeadlineFeedProps {
  /** Items to print, already sorted by date – see `deadlineFeed` in lib/plan. */
  items: DeadlineItem[]
  /** How many passed items are hidden while `showPast` is false. */
  hiddenPast: number
  showPast: boolean
  onToggleShowPast: () => void
  onOpenUniversity?: (id: string) => void
}

/**
 * Лента дедлайнов (spec §3.4): deadlines of the universities in the plan and
 * the common dates (CSCA sessions, CSC window) in one ascending list with a
 * countdown. Presentational – the page computes the items.
 */
export function DeadlineFeed({ items, hiddenPast, showPast, onToggleShowPast, onOpenUniversity }: DeadlineFeedProps) {
  const hasCritical = items.some((i) => i.critical)
  const canToggle = hiddenPast > 0 || showPast

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <Kicker as="h2" className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-accent-text" />
          Лента дедлайнов
        </Kicker>
        {canToggle && (
          <Button variant="ghost" size="xs" onClick={onToggleShowPast}>
            {showPast ? "Скрыть прошедшие" : `Прошедшие (${hiddenPast})`}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          Ближайших дат нет.
          {hiddenPast > 0 ? ` Прошедших: ${hiddenPast}.` : ""}
        </p>
      ) : (
        <ol className="mt-2 flex flex-col">
          {items.map((it) => (
            <DeadlineRow key={it.id} item={it} onOpenUniversity={onOpenUniversity} />
          ))}
        </ol>
      )}

      {hasCritical && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-fg-muted">
          Дедлайны вузов – критичные поля: сверьтесь с сайтом вуза перед подачей.
        </p>
      )}
    </Card>
  )
}
