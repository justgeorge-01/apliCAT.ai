import { useRef, useState } from "react"
import { AnimatePresence, motion, Reorder, useAnimate, useDragControls } from "framer-motion"
import { Check, GripVertical, Heart, Star, X } from "lucide-react"

import { DeadlineBadge, ProgramCard } from "@/components/ProgramCard"
import { ProgramLogo } from "@/components/ProgramLogo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Segmented } from "@/components/ui/segmented"
import { roadmapProgress, lookupItem, type RoadmapProgressInfo } from "@/lib/roadmap"
import type { AnyProgram, Grant, Internship, RoadmapEntry, RoadmapStage, University } from "@/legacy"
import type { Tab } from "@/lib/nav"
import { cn } from "@/lib/utils"

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

/* ---------- type guards over the legacy data union ---------- */
const isUni = (p: AnyProgram): p is University => "program" in p
const isGrant = (p: AnyProgram): p is Grant => "funding" in p
const isIntern = (p: AnyProgram): p is Internship => "role" in p

/* Карточка программы, дедлайн-бейдж и сегмент-контрол – общие компоненты
   (@/components/ProgramCard, @/components/ui/segmented) */

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="flex flex-col items-center gap-0 px-6 py-14 text-center">
        <span className="text-fg-faint">{icon}</span>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">{text}</p>
      </Card>
    </motion.div>
  )
}

/* ---------- Saved view ---------- */
type SavedFilter = "all" | "uni" | "grant" | "intern"

function Saved({
  savedIds,
  priorities,
  toggleSave,
  togglePrio,
  openDetail,
}: {
  savedIds: string[]
  priorities: string[]
  toggleSave: (id: string) => void
  togglePrio: (id: string) => void
  openDetail: (item: AnyProgram) => void
}) {
  const [filter, setFilter] = useState<SavedFilter>("all")
  let items = savedIds.map(lookupItem).filter((x): x is AnyProgram => Boolean(x))
  if (filter === "uni") items = items.filter(isUni)
  if (filter === "grant") items = items.filter(isGrant)
  if (filter === "intern") items = items.filter(isIntern)

  return (
    <div>
      <motion.div variants={fadeUp} className="mb-6">
        <Segmented<SavedFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "Все" },
            { id: "uni", label: "Университеты" },
            { id: "grant", label: "Гранты" },
            { id: "intern", label: "Стажировки" },
          ]}
        />
      </motion.div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-9" />}
          title="Ничего не сохранено"
          text="Нажмите на сердечко на карточке программы, и она появится здесь"
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((u) => (
            <ProgramCard
              key={u.id}
              u={u}
              saved
              prio={priorities.includes(u.id)}
              toggleSave={toggleSave}
              togglePrio={togglePrio}
              onOpen={openDetail}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

/* ---------- Priority view: drag-to-reorder + inline roadmaps ---------- */

/* Sink → Float pickup (cinematic, physical):
   phase 1 sinks the card into the surface, phase 2 floats it above the list,
   phase 3 lands it without a bounce. Phases animate the INNER Card element –
   the drag gesture owns the Reorder.Item's own y motion value, so animating
   the item itself would fight the pointer. */
const FLOAT_SHADOW = "0 20px 48px -8px rgba(0,0,0,0.16), 0 6px 16px -4px rgba(0,0,0,0.09)"
const REST_SHADOW = "0 1px 3px rgba(0,0,0,0.06)"
const SETTLE_EASE = [0.32, 0.72, 0, 1] as const

function PriorityRow({
  p,
  index,
  isOpen,
  rm,
  prog,
  stages,
  stage,
  onToggleExpand,
  onMove,
  onSetActiveStage,
  onToggleCheck,
  togglePrio,
  openDetail,
}: {
  p: AnyProgram
  index: number
  isOpen: boolean
  rm: RoadmapEntry | undefined
  prog: RoadmapProgressInfo | null
  stages: RoadmapStage[] | null
  stage: RoadmapStage | null
  onToggleExpand: (p: AnyProgram) => void
  onMove: (id: string, dir: number) => void
  onSetActiveStage: (id: string) => void
  onToggleCheck: (itemId: string, stageId: string, idx: number) => void
  togglePrio: (id: string) => void
  openDetail: (item: AnyProgram) => void
}) {
  const dragControls = useDragControls()
  const [scope, animate] = useAnimate()
  const [isDragging, setIsDragging] = useState(false)
  // Framer only starts a drag session after 3px of pointer travel, so a plain
  // click/tap on the handle gets NO onDragStart/onDragEnd – these refs let a
  // pointerup fallback land the card and cancel a pending Float phase.
  const pickupGen = useRef(0)
  const pickedUp = useRef(false)
  const dragActive = useRef(false)
  // The browser fires the post-drag click on the common ancestor of the down/up
  // targets – the row header – which would toggle the roadmap. Swallow it.
  const suppressClick = useRef(false)

  const startDrag = async (e: React.PointerEvent) => {
    e.preventDefault()
    suppressClick.current = true
    pickedUp.current = true
    dragControls.start(e)
    const gen = ++pickupGen.current
    // Phase 1 – Sink: the card presses into the surface before lift-off
    await animate(scope.current, { y: 6, scale: 0.97 }, { duration: 0.08, ease: [0.55, 0, 1, 0.45] })
    if (pickupGen.current !== gen) return // already settled (fast release) – don't float
    // Phase 2 – Float: hovers above the list with a slight overshoot
    animate(
      scope.current,
      { y: -4, scale: 1.04, boxShadow: FLOAT_SHADOW },
      { duration: 0.14, ease: [0.34, 1.56, 0.64, 1] },
    )
  }

  const settle = async () => {
    pickupGen.current++ // invalidate any pickup phase still in flight
    pickedUp.current = false
    setIsDragging(false)
    // the post-pointerup click (if any) dispatches before timers run
    setTimeout(() => {
      suppressClick.current = false
    }, 0)
    // Phase 3 – Drop: quiet, authoritative landing, no bounce
    await animate(scope.current, { y: 0, scale: 1, boxShadow: REST_SHADOW }, { duration: 0.28, ease: SETTLE_EASE })
    // hand the resting shadow back to the theme stylesheet (light theme styles cards itself)
    if (scope.current) scope.current.style.boxShadow = ""
  }

  // A press that never crossed the 3px drag threshold gets no onDragEnd –
  // land the card from the handle's own pointerup/pointercancel instead.
  const settleIfNoDrag = () => {
    if (pickedUp.current && !dragActive.current) settle()
  }

  return (
    <Reorder.Item
      as="div"
      value={p.id}
      layout
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => {
        dragActive.current = true
        setIsDragging(true)
      }}
      onDragEnd={() => {
        dragActive.current = false
        settle()
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ layout: { duration: 0.2, ease: SETTLE_EASE }, opacity: { duration: 0.25, ease: EASE } }}
      style={{
        position: "relative",
        zIndex: isDragging ? 50 : "auto",
        willChange: isDragging ? "transform" : "auto",
      }}
      aria-roledescription="sortable"
      aria-describedby="prio-dnd-hint"
    >
      <Card ref={scope} className="group gap-0 overflow-hidden p-0">
        <div
          className="flex cursor-pointer flex-wrap items-center gap-3 p-4 transition-colors duration-200 hover:bg-fg/5 sm:gap-4"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false // stray click from a handle press/drag
              return
            }
            onToggleExpand(p)
          }}
        >
          <button
            type="button"
            className="-mr-1 -ml-2 shrink-0 cursor-grab touch-none rounded-md p-1 text-fg-faint opacity-0 transition-opacity duration-150 outline-none select-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/60 active:cursor-grabbing max-lg:opacity-100 pointer-coarse:opacity-100"
            aria-label={`Изменить позицию: ${p.name}`}
            onPointerDown={startDrag}
            onPointerUp={settleIfNoDrag}
            onPointerCancel={settleIfNoDrag}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                e.stopPropagation()
                onMove(p.id, e.key === "ArrowUp" ? -1 : 1)
              } else if (e.key === " " || e.key === "Enter") {
                e.preventDefault() // reorder is immediate via arrows; pointer handles grab/drop
              }
            }}
          >
            <GripVertical size={14} />
          </button>

          <div
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold",
              index < 3 ? "bg-accent text-accent-fg" : "bg-card-2 text-fg-muted",
            )}
          >
            {index + 1}
          </div>

          <ProgramLogo item={p} className="size-9 rounded-xl text-sm font-semibold" />

          <div className="min-w-0 flex-1 basis-40">
            <div className="truncate text-sm font-medium">{p.name}</div>
            <div className="truncate text-xs text-fg-muted">
              {isUni(p) ? p.program : isIntern(p) ? p.role : p.org} · {p.country}
            </div>
            {prog && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-fg/8">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={false}
                    animate={{ width: `${prog.pct}%` }}
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                </div>
                <span className="text-[11px] whitespace-nowrap text-fg-muted">
                  {prog.pct}% · этап {Math.min(prog.done + 1, prog.total)}/{prog.total}
                </span>
              </div>
            )}
          </div>

          <DeadlineBadge days={p.deadlineDays} />
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              openDetail(p)
            }}
          >
            Детали
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-fg-faint hover:text-danger"
            aria-label="Убрать из приоритетов"
            onClick={(e) => {
              e.stopPropagation()
              togglePrio(p.id)
            }}
          >
            <X />
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {isOpen && stages && (
            <motion.div
              key="rm"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="border-t border-border bg-card-2/40 p-4">
                {/* stage rail */}
                <div className="flex gap-2 overflow-x-auto pb-1.5">
                  {stages.map((s, si) => {
                    const st = rm?.checks?.[s.id] ?? []
                    const full = s.checklist.length > 0 && s.checklist.every((_, ci) => st[ci])
                    const isActive = stage?.id === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSetActiveStage(s.id)}
                        className={cn(
                          "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                          isActive
                            ? "border-accent bg-accent-soft"
                            : "border-border bg-card hover:border-border-strong",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-5.5 shrink-0 place-items-center rounded-full border text-[11px] font-medium",
                            full
                              ? "border-transparent bg-accent text-accent-fg"
                              : "border-border bg-card-2 text-fg-muted",
                          )}
                        >
                          {full ? <Check className="size-3" strokeWidth={3} /> : si + 1}
                        </span>
                        <span>
                          <span className="block text-xs font-medium whitespace-nowrap">{s.name}</span>
                          <span className="block text-[10.5px] whitespace-nowrap text-fg-muted">{s.date}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* stage detail + checklist */}
                {stage && (
                  <div className="mt-3 rounded-xl border border-border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm font-semibold">{stage.name}</strong>
                      <Badge>{stage.date}</Badge>
                    </div>
                    <p className="mb-3 text-[13px] leading-relaxed text-fg-muted">{stage.details}</p>
                    <div className="flex flex-col gap-0.5">
                      {stage.checklist.map((c, ci) => {
                        const st = rm?.checks?.[stage.id] ?? []
                        const on = !!st[ci]
                        return (
                          <div
                            key={ci}
                            onClick={() => onToggleCheck(p.id, stage.id, ci)}
                            className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-200 select-none hover:bg-fg/5"
                          >
                            <Checkbox
                              checked={on}
                              onCheckedChange={() => onToggleCheck(p.id, stage.id, ci)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <span
                              className={cn(
                                "text-[13px] leading-relaxed",
                                on && "text-fg-muted line-through",
                              )}
                            >
                              {c}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </Reorder.Item>
  )
}

function Priority({
  priorities,
  setPriorities,
  togglePrio,
  roadmaps,
  setRoadmaps,
  openDetail,
}: {
  priorities: string[]
  setPriorities: (ids: string[]) => void
  togglePrio: (id: string) => void
  roadmaps: RoadmapEntry[]
  setRoadmaps: (r: RoadmapEntry[]) => void
  openDetail: (item: AnyProgram) => void
}) {
  const items = priorities.map(lookupItem).filter((x): x is AnyProgram => Boolean(x))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeStage, setActiveStage] = useState<string | null>(null) // stage id within expanded roadmap

  // Keyboard reorder (drag handle ArrowUp/ArrowDown) – by id, not index,
  // so unresolved priority ids can never shift the wrong row.
  const move = (id: string, dir: number) => {
    const arr = [...priorities]
    const i = arr.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setPriorities(arr)
  }

  const rmFor = (itemId: string) => roadmaps.find((r) => r.itemId === itemId)

  const toggleExpand = (p: AnyProgram) => {
    if (!isUni(p)) {
      openDetail(p) // grants/internships: no roadmap, open detail
      return
    }
    if (expandedId === p.id) {
      setExpandedId(null)
      return
    }
    if (!rmFor(p.id)) {
      setRoadmaps([...roadmaps, { id: "rm" + Date.now(), itemId: p.id, step: 0, checks: {} }])
    }
    setExpandedId(p.id)
    setActiveStage(null)
  }

  const toggleCheck = (itemId: string, stageId: string, idx: number) => {
    setRoadmaps(
      roadmaps.map((r) => {
        if (r.itemId !== itemId) return r
        const checks: Record<string, boolean[]> = { ...(r.checks || {}) }
        const arr = [...(checks[stageId] || [])]
        arr[idx] = !arr[idx]
        checks[stageId] = arr
        return { ...r, checks }
      }),
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Star className="size-9" />}
        title="Список приоритетов пуст"
        text="Отметьте программу как приоритетную (звёздочка), чтобы она появилась здесь и в дашборде"
      />
    )
  }

  const ids = items.map((x) => x.id)

  return (
    <div>
      <motion.div variants={fadeUp} className="mb-4 text-[13px] text-fg-muted">
        Нажмите на вуз, чтобы раскрыть его роадмап. Перетаскивайте карточки за ручку: первые три видны на главной.
      </motion.div>
      <span id="prio-dnd-hint" className="sr-only">
        Перетащите мышью или используйте стрелки вверх и вниз на ручке, чтобы изменить позицию в списке
      </span>

      <Reorder.Group
        as="div"
        axis="y"
        values={ids}
        onReorder={(next: string[]) =>
          // unresolved ids (not rendered as rows) keep their place at the tail
          setPriorities([...next, ...priorities.filter((id) => !next.includes(id))])
        }
        className="flex flex-col gap-3"
      >
        {items.map((p, i) => {
          const isOpen = expandedId === p.id
          const rm = rmFor(p.id)
          const prog = rm && isUni(p) ? roadmapProgress(rm, p) : null
          const stages = isOpen && isUni(p) ? window.buildRoadmapStages(p) : null
          const stage = stages
            ? (stages.find((s) => s.id === activeStage) ??
              stages.find((s) => s.name === prog?.currentName) ??
              stages[0] ??
              null)
            : null

          return (
            <PriorityRow
              key={p.id}
              p={p}
              index={i}
              isOpen={isOpen}
              rm={rm}
              prog={prog}
              stages={stages}
              stage={stage}
              onToggleExpand={toggleExpand}
              onMove={move}
              onSetActiveStage={setActiveStage}
              onToggleCheck={toggleCheck}
              togglePrio={togglePrio}
              openDetail={openDetail}
            />
          )
        })}
      </Reorder.Group>
    </div>
  )
}

/* ---------- page ---------- */
export interface ProgramsProps {
  subTab: Tab // "p_saved" | "p_priority"
  setTab: (t: Tab) => void
  savedIds: string[]
  priorities: string[]
  setPriorities: (ids: string[]) => void
  toggleSave: (id: string) => void
  togglePrio: (id: string) => void
  roadmaps: RoadmapEntry[]
  setRoadmaps: (r: RoadmapEntry[]) => void
  openDetail: (item: AnyProgram) => void
}

type ProgramsView = "p_saved" | "p_priority"

export default function Programs({
  subTab,
  setTab,
  savedIds,
  priorities,
  setPriorities,
  toggleSave,
  togglePrio,
  roadmaps,
  setRoadmaps,
  openDetail,
}: ProgramsProps) {
  // p_roadmap was merged into priorities in legacy – anything not p_saved shows priorities.
  // Derived from the app tab so the sidebar highlight always matches the page.
  const view: ProgramsView = subTab === "p_saved" ? "p_saved" : "p_priority"

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Мои программы</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {savedIds.length} сохранено · {priorities.length} приоритетов
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-6">
        <Segmented<ProgramsView>
          value={view}
          onChange={(v) => setTab(v)}
          options={[
            { id: "p_saved", label: "Сохранённые" },
            { id: "p_priority", label: "Приоритеты и роадмап" },
          ]}
        />
      </motion.div>

      <motion.div key={view} variants={stagger} initial="hidden" animate="show">
        {view === "p_saved" ? (
          <Saved
            savedIds={savedIds}
            priorities={priorities}
            toggleSave={toggleSave}
            togglePrio={togglePrio}
            openDetail={openDetail}
          />
        ) : (
          <Priority
            priorities={priorities}
            setPriorities={setPriorities}
            togglePrio={togglePrio}
            roadmaps={roadmaps}
            setRoadmaps={setRoadmaps}
            openDetail={openDetail}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
