import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CircleAlert, ClipboardList, Trash2 } from "lucide-react"

import { DeadlineFeed, SourceLink } from "@/components/DeadlineFeed"
import { DocChecklist } from "@/components/DocChecklist"
import { PlanBackup, SharePlan } from "@/components/SharePlan"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Label } from "@/components/ui/label"
import { applicationDeadline, findUniversity, formatCheckedAt, lastChecked } from "@/data/china"
import type { Catalog, University } from "@/data/china.types"
import { getPartner } from "@/lib/partner"
import { cn } from "@/lib/utils"
import {
  FIXED_DATES,
  PLAN_STATUSES,
  PLAN_STATUS_LABELS_RU,
  daysLeftLabel,
  deadlineFeed,
  loadPlan,
  planSummary,
  removeFromPlan,
  savePlan,
  setDoc,
  setStatus,
  type Plan,
  type PlanEntry,
  type PlanStatus,
} from "@/lib/plan"

/* ---------- shared motion presets (ease-out, 200–300ms) ---------- */
const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/* ---------- helpers ---------- */

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/** Current time, refreshed once a minute so countdowns stay honest in a long-open tab. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/* ---------- status segments ---------- */

/**
 * The application status as segments (the Segmented look: paper track, red
 * active segment). A local grid rather than `Segmented` because four Russian
 * labels do not fit a 375px track without scrolling – here they wrap 2 x 2 on
 * narrow screens and sit in one row from `sm`.
 */
function StatusSegments({
  value,
  onChange,
  labelledBy,
}: {
  value: PlanStatus
  onChange: (status: PlanStatus) => void
  labelledBy: string
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 sm:grid-cols-4"
    >
      {PLAN_STATUSES.map((s) => {
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(s)}
            className={cn(
              "rounded-md px-2 py-2 text-center text-[13px] leading-tight font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
              on ? "bg-accent font-semibold text-accent-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg",
            )}
          >
            {PLAN_STATUS_LABELS_RU[s]}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- university block ---------- */

function UniversityBlock({
  university: u,
  entry,
  onStatus,
  onDoc,
  onRemove,
  onOpen,
}: {
  university: University
  entry: PlanEntry
  onStatus: (status: PlanStatus) => void
  onDoc: (docId: string, done: boolean) => void
  onRemove: () => void
  onOpen: () => void
}) {
  const deadline = applicationDeadline(u)
  const checked = lastChecked(u)
  const statusId = `status-${u.id}`

  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-md text-left font-display text-lg leading-tight font-bold tracking-tight transition-colors duration-200 outline-none hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {u.name_ru ?? u.name}
            </button>
            <div className="mt-0.5 text-xs text-fg-muted">
              {u.city}
              {u.name_ru ? ` · ${u.name}` : ""}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Убрать из плана" title="Убрать из плана" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <Label id={statusId} className="mb-1.5">
              Статус
            </Label>
            <StatusSegments value={entry.status} onChange={onStatus} labelledBy={statusId} />
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5">Дедлайн подачи</Label>
            {deadline ? (
              <>
                {/* printed as is – `fact.display` */}
                <div className="text-sm leading-snug">{deadline.display}</div>
                <SourceLink className="mt-1" url={deadline.source_url} verifiedAt={deadline.verified_at} />
              </>
            ) : (
              <div className="text-sm text-fg-muted">
                {checked ? `вуз не публикует · проверено ${formatCheckedAt(checked)}` : "не опубликовано"}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <DocChecklist university={u} entry={entry} onToggle={onDoc} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpen}>
            Открыть карточку вуза
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

/** An entry whose id is not in the current catalog (a plan imported from another data version). */
function UnknownBlock({ id, onRemove }: { id: string; onRemove: () => void }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Вуз «{id}» не найден в каталоге</div>
              <div className="mt-0.5 text-xs text-fg-muted">
                Возможно, план из другой версии данных. Уберите запись или дождитесь обновления каталога.
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Убрать из плана" title="Убрать из плана" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

/* ---------- empty state ---------- */

function EmptyState({ onOpenCatalog }: { onOpenCatalog?: () => void }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="flex flex-col items-center gap-0 px-6 py-12 text-center">
        <ClipboardList className="size-9 text-fg-faint" strokeWidth={1.5} />
        <h2 className="mt-4 font-display text-xl font-bold text-accent-text">Начните с каталога</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          Добавьте вузы из каталога кнопкой «В мой план»: здесь появятся их дедлайны, чек-листы документов и
          статусы подачи.
        </p>
        {onOpenCatalog && (
          <Button className="mt-6" onClick={onOpenCatalog}>
            Открыть каталог
          </Button>
        )}
      </Card>
    </motion.div>
  )
}

/* ---------- page ---------- */

export interface PlanPageProps {
  /** The loaded catalog (`loadCatalog()` in the shell). */
  catalog: Catalog
  /** Open the university card (Detail) by catalog id. */
  onOpenUniversity: (id: string) => void
  /** Go to the catalog tab – the empty state's button; hidden when absent. */
  onOpenCatalog?: () => void
  /**
   * Optional controlled mode. When the shell keeps the plan in its own state
   * (e.g. to share it with Detail's «В мой план» or a sidebar counter) it
   * passes `plan` and receives every change via `onPlanChange`. The page
   * still persists each change with `savePlan`. Without `plan` the page loads
   * from `admitica.cn.plan` on mount and owns the state itself.
   */
  plan?: Plan
  onPlanChange?: (plan: Plan) => void
}

/**
 * «Мой план» (spec §3.4): deadline feed, per-university documents and status,
 * share digest, JSON backup. Everything is derived from the catalog facts
 * (printed as `display`) and the plan in localStorage.
 */
export default function PlanPage({ catalog, onOpenUniversity, onOpenCatalog, plan: controlled, onPlanChange }: PlanPageProps) {
  const [inner, setInner] = useState<Plan>(() => controlled ?? loadPlan())
  const plan = controlled ?? inner
  const now = useNow()
  const [showPast, setShowPast] = useState(false)

  const update = useCallback(
    (fn: (p: Plan) => Plan) => {
      const next = fn(plan)
      if (next === plan) return
      savePlan(next)
      setInner(next)
      onPlanChange?.(next)
    },
    [plan, onPlanChange],
  )

  const feedAll = useMemo(() => deadlineFeed(plan, catalog, FIXED_DATES, now, { includePast: true }), [plan, catalog, now])
  const feedItems = useMemo(() => (showPast ? feedAll : feedAll.filter((i) => !i.passed)), [feedAll, showPast])
  const hiddenPast = feedAll.length - feedAll.filter((i) => !i.passed).length
  const nextItem = feedAll.find((i) => !i.passed) ?? null

  const summary = useMemo(
    () => planSummary(plan, catalog, now, { brand: getPartner().name }),
    [plan, catalog, now],
  )

  const count = plan.universities.length
  const isEmpty = count === 0

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
        <HanziKicker hanzi="我的计划">Мой план</HanziKicker>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-accent-text sm:text-4xl">
          {isEmpty ? "План пока пуст" : `${count} ${pluralRu(count, "вуз", "вуза", "вузов")} в плане`}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {isEmpty
            ? "Вузы, дедлайны, документы и статусы – в одном месте, только в вашем браузере"
            : nextItem
              ? `Ближайшая дата: ${nextItem.title}, ${daysLeftLabel(nextItem)}`
              : "Ближайших дат нет"}
        </p>
      </motion.div>

      {isEmpty ? (
        /* Empty plan: the empty state leads; the common dates and the import
           (restore a backup) stay available below it. */
        <div className="flex flex-col gap-4">
          <EmptyState onOpenCatalog={onOpenCatalog} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <motion.div variants={fadeUp}>
              <DeadlineFeed
                items={feedItems}
                hiddenPast={hiddenPast}
                showPast={showPast}
                onToggleShowPast={() => setShowPast((s) => !s)}
                onOpenUniversity={onOpenUniversity}
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <PlanBackup plan={plan} onImport={(p) => update(() => p)} />
            </motion.div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
          {/* Feed first in DOM so it leads on mobile; on desktop it sits in the right column. */}
          <aside className="flex flex-col gap-4 lg:order-2">
            <motion.div variants={fadeUp}>
              <DeadlineFeed
                items={feedItems}
                hiddenPast={hiddenPast}
                showPast={showPast}
                onToggleShowPast={() => setShowPast((s) => !s)}
                onOpenUniversity={onOpenUniversity}
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <SharePlan text={summary} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <PlanBackup plan={plan} onImport={(p) => update(() => p)} />
            </motion.div>
          </aside>

          <div className="flex flex-col gap-4 lg:order-1">
            {plan.universities.map((entry) => {
              const u = findUniversity(catalog, entry.id)
              if (!u) {
                return (
                  <UnknownBlock key={entry.id} id={entry.id} onRemove={() => update((p) => removeFromPlan(p, entry.id))} />
                )
              }
              return (
                <UniversityBlock
                  key={entry.id}
                  university={u}
                  entry={entry}
                  onStatus={(s) => update((p) => setStatus(p, entry.id, s))}
                  onDoc={(docId, done) => update((p) => setDoc(p, entry.id, docId, done))}
                  onRemove={() => update((p) => removeFromPlan(p, entry.id))}
                  onOpen={() => onOpenUniversity(entry.id)}
                />
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
