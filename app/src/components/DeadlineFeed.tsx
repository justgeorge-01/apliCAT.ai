import { CalendarDays, ExternalLink, ListChecks } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
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

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/**
 * The countdown column of a timeline row: the number of days set large in
 * Playfair, the unit underneath as a small label. «сегодня», «в этом месяце»
 * and «прошёл» have no number and are printed as words. The canonical
 * `daysLeftLabel` text stays in the DOM for assistive tech.
 */
function Countdown({ item }: { item: DeadlineItem }) {
  const label = daysLeftLabel(item)
  const hasNumber = !item.passed && item.daysLeft > 0
  return (
    <div className="shrink-0 text-right">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {hasNumber ? (
          <>
            <div className="font-display text-[28px] leading-none font-bold text-accent-text tabular-nums">
              {item.daysLeft}
            </div>
            <div className="mt-1 text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">
              {pluralRu(item.daysLeft, "день", "дня", "дней")}
            </div>
          </>
        ) : (
          <div
            className={cn(
              "font-display text-base leading-tight font-bold",
              item.passed ? "text-fg-faint" : "text-accent-text",
            )}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  )
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
    <li
      className={cn(
        // the timeline: a hairline of ink runs behind the dots, from the first dot to the last
        "relative pb-5 pl-7 last:pb-0",
        "before:absolute before:top-0 before:bottom-0 before:left-[5.5px] before:w-px before:bg-fg/25",
        "first:before:top-[7px] last:before:bottom-auto last:before:h-[7px] only:before:hidden",
      )}
    >
      {/* the dot: red for a date still ahead, grey once it has passed; the ring lifts it off the line */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[7px] left-0 size-3 rounded-full ring-4 ring-card",
          item.passed ? "bg-fg-faint" : "bg-accent",
        )}
      />

      {/* Header row: the title (and the «общие» seal) on the left, the countdown on the right.
          The date, note and source lines below take the full row width, so nothing is
          squeezed by the countdown column in the narrow aside or at 375px. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {uniId && onOpenUniversity ? (
              <button
                type="button"
                onClick={() => onOpenUniversity(uniId)}
                className={cn(
                  "rounded-md text-left text-sm font-semibold transition-colors duration-200 outline-none hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent/60",
                  item.passed && "text-fg-muted",
                )}
              >
                {item.title}
              </button>
            ) : (
              <span className={cn("text-sm font-semibold", item.passed && "text-fg-muted")}>{item.title}</span>
            )}
            {item.kind === "common" && (
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                общие
              </span>
            )}
            {item.kind === "task" && (
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
                задача
              </span>
            )}
          </div>
          {item.kind !== "common" && item.subtitle && (
            <div className="text-xs text-fg-muted">{item.subtitle}</div>
          )}
        </div>

        <Countdown item={item} />
      </div>

      {/* The date text is printed as is – `fact.display` or `FixedDate.display`. */}
      <div className={cn("mt-1.5 text-sm leading-snug", item.passed && "text-fg-muted")}>{item.display}</div>

      {item.note && <div className="mt-1 text-xs text-fg-faint">{item.note}</div>}
      {/* a task is the user's own entry – it has no source line */}
      {item.source_url && item.verified_at && (
        <SourceLink className="mt-1" url={item.source_url} verifiedAt={item.verified_at} />
      )}
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
 * Лента дедлайнов (spec §3.4, cabinet §4): deadlines of the universities in the
 * plan, the common dates (CSCA sessions, CSC window) and the open tasks with a
 * due date on one ascending timeline with a countdown. Presentational – the
 * page computes the items.
 */
export function DeadlineFeed({ items, hiddenPast, showPast, onToggleShowPast, onOpenUniversity }: DeadlineFeedProps) {
  const hasCritical = items.some((i) => i.critical)
  const canToggle = hiddenPast > 0 || showPast

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <HanziKicker hanzi="截止日期" as="h2">
          Дедлайны
        </HanziKicker>
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
        <ol className="mt-5 flex flex-col">
          {items.map((it) => (
            <DeadlineRow key={it.id} item={it} onOpenUniversity={onOpenUniversity} />
          ))}
        </ol>
      )}

      {hasCritical && (
        <p className="mt-4 border-t border-border pt-3 text-xs text-fg-muted">
          Дедлайны вузов – критичные поля: сверьтесь с сайтом вуза перед подачей.
        </p>
      )}
    </Card>
  )
}
