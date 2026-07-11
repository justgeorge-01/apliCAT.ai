import { useEffect, useRef } from "react"
import { motion, animate, useReducedMotion } from "framer-motion"
import { ArrowRight, ArrowUpRight, Calendar, Check, Flame, GraduationCap, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DeadlineBadge } from "@/components/ProgramCard"
import { ProgramLogo } from "@/components/ProgramLogo"
import { usePersist } from "@/lib/persist"
import { roadmapProgress, lookupItem } from "@/lib/roadmap"
import type { AnyProgram, RoadmapEntry } from "@/legacy"
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

/* ---------- content ---------- */
const QUOTES = [
  { t: "Подавайтесь в несколько вузов: пара амбициозных, пара надёжных и один запасной.", a: "Список вузов" },
  { t: "Начинайте эссе за месяц до дедлайна – на правки уходит больше времени, чем кажется.", a: "Эссе" },
  { t: "Один сильный мотивационный текст лучше, чем десять шаблонных под копирку.", a: "Эссе" },
  { t: "Проверьте требования к языку заранее: сертификат IELTS или TOEFL делается не за день.", a: "Документы" },
  { t: "Списывайте дедлайны прямо из официального письма вуза, а не из чужих таблиц.", a: "Дедлайны" },
  { t: "Просите рекомендателя заранее – за две-три недели, а не накануне срока.", a: "Рекомендации" },
]

/* ---------- tiny count-up number ---------- */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = String(to) + suffix
      return
    }
    const controls = animate(0, to, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = String(Math.round(v)) + suffix
      },
    })
    return () => controls.stop()
  }, [to, suffix, reduced])
  return <span ref={ref}>0{suffix}</span>
}

/* ---------- greeting helpers (как в legacy) ---------- */
const greetByHour = () => {
  const h = new Date().getHours()
  if (h < 6) return "Доброй ночи"
  if (h < 12) return "Доброе утро"
  if (h < 18) return "Добрый день"
  return "Добрый вечер"
}
const todayName = () =>
  new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })

/* ---------- cards ---------- */
function GoalCard({ roadmaps, onOpen }: { roadmaps: RoadmapEntry[]; onOpen: () => void }) {
  const progs = roadmaps
    .map((r) => ({ r, item: lookupItem(r.itemId) }))
    .filter((x): x is { r: RoadmapEntry; item: AnyProgram } => Boolean(x.item))
    .map((x) => ({ ...x, p: roadmapProgress(x.r, x.item) }))

  const pct = progs.length ? Math.round(progs.reduce((s, x) => s + x.p.pct, 0) / progs.length) : 0
  const current = progs[0] ?? null

  return (
    <Card className="relative overflow-hidden p-6 sm:p-7 lg:col-span-2">
      <div className="hero-glow pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-fg-muted uppercase">
          <GraduationCap className="size-3.5 text-accent-text" />
          Цель – поступление
        </div>
        <div className="mt-3 text-6xl font-bold tracking-tight sm:text-7xl">
          <CountUp to={pct} suffix="%" />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-fg/8">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          />
        </div>
        <div className="mt-auto flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm leading-relaxed text-fg-muted">
            {current ? (
              <>
                Сейчас: <span className="font-semibold text-fg">{current.item.name}</span>
                <br />
                Этап {Math.min(current.p.done + 1, current.p.total)} из {current.p.total}
                {current.p.currentName ? `: ${current.p.currentName}` : " – всё выполнено"}
              </>
            ) : (
              "Добавь вуз в приоритеты, чтобы начать отслеживать прогресс."
            )}
          </p>
          <Button variant="secondary" size="sm" className="shrink-0" onClick={onOpen}>
            Открыть <ArrowRight />
          </Button>
        </div>
      </div>
    </Card>
  )
}

const pluralDay = (n: number) => {
  const a = n % 100,
    b = n % 10
  if (a > 10 && a < 20) return "дней"
  if (b === 1) return "день"
  if (b >= 2 && b <= 4) return "дня"
  return "дней"
}

function StreakCard() {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  const jsDay = new Date().getDay()
  const today = jsDay === 0 ? 6 : jsDay - 1
  const streak = 4
  const weekDone = today + 1
  return (
    <Card className="relative overflow-hidden p-6">
      {/* warm ambient glow in the corner */}
      <div aria-hidden className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full bg-warning/15 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <h2 className="text-sm font-semibold">Ежедневный стрик</h2>

        {/* hero: flame tile + count */}
        <div className="mt-4 flex items-center gap-3.5">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="grid size-13 shrink-0 place-items-center rounded-2xl bg-warning/12 text-warning shadow-[0_8px_24px_-12px_var(--color-warning)]"
          >
            <Flame className="size-6.5 fill-warning/20" />
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-warning">{streak}</span>
              <span className="text-sm text-fg-muted">{pluralDay(streak)} подряд</span>
            </div>
            <div className="mt-0.5 text-xs text-fg-faint">Стрик растёт, если заходить каждый день</div>
          </div>
        </div>

        {/* week strip with a connecting track */}
        <div className="mt-auto pt-6">
          <div className="mb-2.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold tracking-widest text-fg-faint uppercase">Эта неделя</span>
            <span className="font-medium text-fg-muted">{weekDone}/7</span>
          </div>
          <div className="relative flex justify-between gap-1.5">
            {/* track behind the dots */}
            <div aria-hidden className="absolute inset-x-4 top-4 h-0.5 -translate-y-1/2 rounded-full bg-fg/8" />
            {days.map((d, i) => {
              const done = i <= today
              return (
                <div key={d} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: EASE, delay: 0.2 + i * 0.05 }}
                    className={cn(
                      "grid aspect-square w-full max-w-8 place-items-center rounded-full border text-[10px] font-medium",
                      done
                        ? "border-transparent bg-accent text-accent-fg"
                        : "border-border bg-card text-fg-faint",
                      i === today && "ring-2 ring-accent/40 ring-offset-2 ring-offset-card",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </motion.div>
                  <span className={cn("text-[10px]", i === today ? "font-semibold text-fg-muted" : "text-fg-faint")}>{d}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function QuoteCard() {
  const [i, setI] = usePersist<number>("quoteIdx", 0)
  const q = QUOTES[i % QUOTES.length]
  return (
    <Card className="relative overflow-hidden p-6 sm:p-7">
      <div className="hero-glow pointer-events-none absolute inset-0 opacity-30" />
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-4 right-4"
        onClick={() => setI(i + 1)}
        aria-label="Другой совет"
      >
        <RefreshCw />
      </Button>
      <div className="relative">
        <div className="text-xs font-semibold tracking-widest text-accent-text uppercase">Совет дня</div>
        <motion.blockquote
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-3 max-w-3xl text-lg leading-relaxed font-medium text-balance sm:text-xl"
        >
          «{q.t}»
        </motion.blockquote>
        <div className="mt-3 text-sm text-fg-muted">{q.a}</div>
      </div>
    </Card>
  )
}

function ListRow({
  item,
  index,
  trailing,
  onClick,
}: {
  item: AnyProgram
  index?: number
  trailing?: React.ReactNode
  onClick?: () => void
}) {
  const subtitle = "program" in item ? item.program : "org" in item ? item.org : (item as { role?: string }).role
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ x: 3 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-fg/5"
      onClick={onClick}
    >
      {index !== undefined && (
        <div
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold",
            index < 3 ? "bg-accent text-accent-fg" : "bg-card-2 text-fg-muted",
          )}
        >
          {index + 1}
        </div>
      )}
      <ProgramLogo item={item} className="size-9 rounded-xl text-sm font-semibold" />
      {/* name owns the full row width; deadline sits with the subtitle below */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <ArrowUpRight className="size-4 shrink-0 text-fg-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{subtitle}</span>
          {trailing && <span className="shrink-0">{trailing}</span>}
        </div>
      </div>
    </motion.div>
  )
}

/* DeadlineBadge – общий компонент (@/components/ProgramCard) */

/* ---------- page ---------- */
export interface HomeProps {
  name: string
  priorities: string[]
  savedIds: string[]
  roadmaps: RoadmapEntry[]
  setTab: (t: Tab) => void
  openDetail: (item: AnyProgram) => void
}

export default function Home({ name, priorities, savedIds, roadmaps, setTab, openDetail }: HomeProps) {
  const topPrio = priorities.slice(0, 3).map(lookupItem).filter((x): x is AnyProgram => Boolean(x))
  const upcoming = savedIds
    .map(lookupItem)
    .filter((x): x is AnyProgram => Boolean(x))
    .filter((x) => x.deadlineDays > 0 && x.deadlineDays < 900)
    .sort((a, b) => a.deadlineDays - b.deadlineDays)
    .slice(0, 3)

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* hero */}
      <motion.div variants={fadeUp} className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
        <div>
          <div className="text-sm text-fg-muted capitalize">{todayName()}</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {greetByHour()}, {name}
            <span className="text-accent-text">.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-fg-muted sm:text-base">
            Программы, дедлайны и прогресс по заявкам – на одной странице.
          </p>
        </div>
        <Button onClick={() => setTab("find")} className="max-sm:hidden">
          Подобрать программу <ArrowRight />
        </Button>
      </motion.div>

      {/* bento: goal (2/3) + streak (1/3) – paired so the goal card stays compact */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GoalCard roadmaps={roadmaps} onOpen={() => setTab("p_priority")} />
        <StreakCard />
      </motion.div>

      {/* priorities + deadlines – half-width each so names have room */}
      <motion.div variants={fadeUp} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* priorities */}
        <Card className="p-4 sm:p-5">
          <div className="mb-1 flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold">Ваши приоритеты</h2>
            <Button variant="link" size="xs" onClick={() => setTab("p_priority")}>
              Все <ArrowRight />
            </Button>
          </div>
          <motion.div variants={stagger} initial="hidden" animate="show">
            {topPrio.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-muted">
                Отметьте программу как приоритетную, чтобы она появилась здесь
              </p>
            ) : (
              topPrio.map((p, i) => (
                <ListRow
                  key={p.id}
                  item={p}
                  index={i}
                  trailing={<DeadlineBadge days={p.deadlineDays} />}
                  onClick={() => openDetail(p)}
                />
              ))
            )}
          </motion.div>
        </Card>

        {/* deadlines */}
        <Card className="p-4 sm:p-5">
          <div className="mb-1 flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold">Ближайшие дедлайны</h2>
            <Badge variant="warning">
              <Calendar className="size-3" /> {upcoming.length} активных
            </Badge>
          </div>
          <motion.div variants={stagger} initial="hidden" animate="show">
            {upcoming.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-muted">Нет приближающихся дедлайнов</p>
            ) : (
              upcoming.map((p) => (
                <ListRow
                  key={p.id}
                  item={p}
                  trailing={<DeadlineBadge days={p.deadlineDays} />}
                  onClick={() => openDetail(p)}
                />
              ))
            )}
          </motion.div>
        </Card>
      </motion.div>

      {/* tip of the day – full-width banner */}
      <motion.div variants={fadeUp} className="mt-4">
        <QuoteCard />
      </motion.div>

      {/* progress summary */}
      <motion.div variants={fadeUp} className="mt-8 sm:mt-10">
        <h2 className="mb-4 text-xs font-semibold tracking-widest text-fg-muted uppercase">Прогресс по этапам</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              {
                label: "Поиск программ",
                lead: `${savedIds.length} сохранено`,
                body:
                  savedIds.length < 5
                    ? "Сохраните 8–12 программ, чтобы было из чего выбирать"
                    : "Программ достаточно – отметьте приоритетные",
                bar: Math.min(100, savedIds.length * 10),
                tab: "find" as Tab,
              },
              {
                label: "Эссе",
                lead: "2 черновика",
                body: "Personal Statement для Bocconi – 760/1000 слов. Откройте редактор, чтобы продолжить.",
                tab: "essay" as Tab,
              },
              {
                label: "Резюме",
                lead: "2 достижения",
                body: "Оформите опыт списком пунктов в формате европейского резюме.",
                tab: "resume" as Tab,
              },
            ] as { label: string; lead: string; body: string; bar?: number; tab: Tab }[]
          ).map((c) => (
            <motion.div key={c.label} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: EASE }}>
              <Card
                className="h-full cursor-pointer p-6"
                onClick={() => setTab(c.tab)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setTab(c.tab)}
              >
                <div className="text-xs font-semibold tracking-widest text-fg-muted uppercase">{c.label}</div>
                <div className="mt-2 text-xl font-bold">{c.lead}</div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">{c.body}</p>
                {c.bar !== undefined && (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-fg/8">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${c.bar}%` }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
                    />
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
