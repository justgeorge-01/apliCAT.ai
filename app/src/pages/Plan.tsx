import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ClipboardList, CloudUpload } from "lucide-react"

import { DeadlineFeed } from "@/components/DeadlineFeed"
import { MentorCard } from "@/components/MentorCard"
import { UniversityList } from "@/components/PlanUniversities"
import { fadeUp, stagger } from "@/lib/motion"
import { PlanBackup, SharePlan } from "@/components/SharePlan"
import { TasksPanel } from "@/components/TasksPanel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { useToast } from "@/components/ui/use-toast"
import { findUniversity } from "@/data/china"
import type { Catalog } from "@/data/china.types"
import { useCabinet } from "@/auth/useCabinet"
import { errorMessageRu } from "@/lib/cabinet"
import { getPartner } from "@/lib/partner"
import {
  FIXED_DATES,
  daysLeftLabel,
  deadlineFeed,
  loadPlan,
  planSummary,
  removeFromPlan,
  setDoc,
  setNote,
  setStatus,
  upcomingWithin,
  type Plan,
} from "@/lib/plan"
import { localPlanStore, type PlanStore } from "@/lib/planStore"
import { pluralRu } from "@/lib/catalogView"
import { useNow } from "@/lib/useNow"

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

/* ---------- «перенести план в аккаунт» ---------- */

function TransferOffer({ universities, tasks, running, onRun }: { universities: number; tasks: number; running: boolean; onRun: () => void }) {
  const parts: string[] = []
  if (universities) parts.push(`${universities} ${pluralRu(universities, "вуз", "вуза", "вузов")}`)
  if (tasks) parts.push(`${tasks} ${pluralRu(tasks, "задача", "задачи", "задач")}`)
  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 border-accent p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-accent-text">В этом браузере есть план: {parts.join(", ")}</div>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              Аккаунт пока пуст. Перенести план с документами и статусами в аккаунт? Копия в браузере останется.
            </p>
          </div>
          <Button onClick={onRun} disabled={running}>
            <CloudUpload />
            Перенести в аккаунт
          </Button>
        </div>
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
   * passes `plan` and receives every change via `onPlanChange`. Without `plan`
   * the page loads from the store on mount and owns the state itself.
   */
  plan?: Plan
  onPlanChange?: (plan: Plan) => void
  /** Where the plan is written (cabinet spec §4): local by default, the account when signed in. */
  store?: PlanStore
  /** Guests with the cabinet enabled: «сохранить план в аккаунте» leads to sign-in. */
  onSignIn?: () => void
}

/**
 * «Мой план» (spec §3.4, cabinet §4): tasks and the next seven days, per-
 * university documents / status / note with the mentor's comment, the deadline
 * feed, share digest, backup, the mentor card. Everything is derived from the
 * catalog facts (printed as `display`) and the plan in the store.
 */
export default function PlanPage({ catalog, onOpenUniversity, onOpenCatalog, plan: controlled, onPlanChange, store = localPlanStore, onSignIn }: PlanPageProps) {
  const toast = useToast()
  const cabinet = useCabinet()
  const [inner, setInner] = useState<Plan>(() => controlled ?? loadPlan())
  const plan = controlled ?? inner
  const now = useNow()
  const [showPast, setShowPast] = useState(false)

  // Uncontrolled mode: load from the store once.
  useEffect(() => {
    if (controlled !== undefined) return
    let alive = true
    store.load().then((p) => {
      if (alive) setInner(p)
    })
    return () => {
      alive = false
    }
  }, [controlled, store])

  const update = useCallback(
    (fn: (p: Plan) => Plan) => {
      const next = fn(plan)
      if (next === plan) return
      setInner(next)
      onPlanChange?.(next)
      store.save(next).catch((e: unknown) => toast(errorMessageRu(e)))
    },
    [plan, onPlanChange, store, toast],
  )

  const orgName = cabinet.org?.name ?? null
  const feedAll = useMemo(
    () => deadlineFeed(plan, catalog, FIXED_DATES, now, { includePast: true, tasks: cabinet.tasks, orgName }),
    [plan, catalog, now, cabinet.tasks, orgName],
  )
  const feedItems = useMemo(() => (showPast ? feedAll : feedAll.filter((i) => !i.passed)), [feedAll, showPast])
  const hiddenPast = feedAll.length - feedAll.filter((i) => !i.passed).length
  const nextItem = feedAll.find((i) => !i.passed) ?? null
  const upcoming = useMemo(() => upcomingWithin(feedAll, 7), [feedAll])

  const summary = useMemo(() => planSummary(plan, catalog, now, { brand: getPartner().name }), [plan, catalog, now])

  const universities = useMemo(
    () =>
      plan.universities.flatMap((e) => {
        const u = findUniversity(catalog, e.id)
        return u ? [{ id: u.id, name: u.name_ru ?? u.name }] : []
      }),
    [plan, catalog],
  )

  const count = plan.universities.length
  const isEmpty = count === 0
  const signed = cabinet.signed

  const tasksPanel = (
    <motion.div variants={fadeUp}>
      <TasksPanel
        tasks={cabinet.tasks}
        upcoming={upcoming}
        viewer={cabinet.taskViewer}
        universities={universities}
        orgName={orgName}
        localOnly={!signed}
        onAdd={cabinet.addTask}
        onToggle={(id) => void cabinet.toggleTask(id)}
        onEdit={cabinet.editTask}
        onDelete={(id) => void cabinet.deleteTask(id)}
        onOpenUniversity={onOpenUniversity}
      />
    </motion.div>
  )

  const mentorCard = cabinet.enabled ? (
    <motion.div variants={fadeUp}>
      <MentorCard org={cabinet.org} signed={signed} onSignIn={onSignIn} onJoin={async (code) => (await cabinet.joinOrg(code)) !== null} />
    </motion.div>
  ) : null

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
        <HanziKicker hanzi="我的计划">Мой план</HanziKicker>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-accent-text sm:text-4xl">
          {isEmpty ? "План пока пуст" : `${count} ${pluralRu(count, "вуз", "вуза", "вузов")} в плане`}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {isEmpty
            ? signed
              ? "Вузы, дедлайны, документы и задачи – в аккаунте, а не только в этом браузере"
              : "Вузы, дедлайны, документы и статусы – в одном месте, только в вашем браузере"
            : nextItem
              ? `Ближайшая дата: ${nextItem.title}, ${daysLeftLabel(nextItem)}`
              : "Ближайших дат нет"}
        </p>
      </motion.div>

      {cabinet.transfer.offer && (
        <div className="mb-4">
          <TransferOffer
            universities={cabinet.transfer.offer.universities}
            tasks={cabinet.transfer.offer.tasks}
            running={cabinet.transfer.running}
            onRun={() => void cabinet.transfer.run()}
          />
        </div>
      )}

      {isEmpty ? (
        /* Empty plan: the empty state leads; tasks, the common dates, the
           mentor card and the import (restore a backup) stay available below it. */
        <div className="flex flex-col gap-4">
          <EmptyState onOpenCatalog={onOpenCatalog} />
          {tasksPanel}
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
            <div className="flex flex-col gap-4">
              {mentorCard}
              <motion.div variants={fadeUp}>
                <PlanBackup plan={plan} onImport={(p) => update(() => p)} signed={signed} />
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tasksPanel}
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
              {mentorCard}
              <motion.div variants={fadeUp}>
                <SharePlan text={summary} />
              </motion.div>
              <motion.div variants={fadeUp}>
                <PlanBackup plan={plan} onImport={(p) => update(() => p)} signed={signed} />
              </motion.div>
            </aside>

            <div className="lg:order-1">
              <UniversityList
                catalog={catalog}
                plan={plan}
                notes={cabinet.notes}
                orgName={orgName}
                onStatus={(id, s) => update((p) => setStatus(p, id, s))}
                onDoc={(id, docId, done) => update((p) => setDoc(p, id, docId, done))}
                onNote={(id, note) => update((p) => setNote(p, id, note))}
                onRemove={(id) => update((p) => removeFromPlan(p, id))}
                onOpen={onOpenUniversity}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
