import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  Brain,
  Briefcase,
  ChartColumn,
  Check,
  ChevronDown,
  CircleDollarSign,
  CircleQuestionMark,
  Code,
  Cog,
  FlaskConical,
  Globe,
  GraduationCap,
  HeartPulse,
  Languages,
  Laptop,
  Map,
  Megaphone,
  Pencil,
  PenLine,
  PenTool,
  Plus,
  Scale,
  Search,
  Wallet,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/* ============================================================
   Onboarding – full port of the legacy onboarding.html wizard
   (13 screens) merged with the app's signature letter-fly intro.
   Storage contract is byte-compatible with legacy finishOnboarding().
   ============================================================ */

const EASE = [0.16, 1, 0.3, 1] as const
const LETTERS = "Admitica".split("")

/* ⚠️ TEMPORARY (legal / personal data): the name input on the first screen is
   disabled so we don't collect a personal name. Everyone enters as "Гость".
   To restore name collection: set COLLECT_NAME = true.
   Tracked in README → «Временные правки – обязательно откатить». */
const COLLECT_NAME: boolean = false
const GUEST_NAME = "Гость"

/* In-screen entrance is intentionally a no-op: the screen-level AnimatePresence
   transition already animates each screen in as a whole. A second per-card
   stagger/fade on top of it read as a "double flip" and fought OptionCard's CSS
   opacity transition (a dark flicker sweeping across the cards). Kept as identity
   variants so the existing variants=/initial=/animate= props stay valid. */
const fadeUp = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
}
const stagger = {
  hidden: {},
  show: {},
}

/* ---------- legacy profile shape (exact field names!) ---------- */
interface LangEntry {
  lang: string | null
  level: string | null
  cert: string
  score: string
}
interface LangRow extends LangEntry {
  key: number
}
interface Profile {
  name: string
  motivation?: string[]
  concern?: string[]
  level?: string[]
  grant?: boolean
  year?: string
  gpa: string | null
  gpaUnknown?: boolean
  english?: string
  cert?: string
  certScore?: string
  fields?: string[]
  internships?: string[]
  countries?: string[]
  budget: string
  budgetUnknown?: boolean
}

/* ---------- option catalogs (verbatim legacy strings) ---------- */
const MOTIVATION_OPTS = [
  { val: "career", Icon: Briefcase, label: "Лучшие карьерные перспективы" },
  { val: "quality", Icon: BookOpen, label: "Качество образования выше, чем дома" },
  { val: "experience", Icon: Globe, label: "Хочу новый опыт и самостоятельность" },
  { val: "scholarship", Icon: GraduationCap, label: "Ищу стипендию / доступное образование" },
]
const CONCERN_OPTS = [
  { val: "where", Icon: Map, label: "Не знаю, куда вообще подавать" },
  { val: "english", Icon: Languages, label: "Английский недостаточно хорош" },
  { val: "essay", Icon: PenLine, label: "Как писать мотивационное письмо" },
  { val: "money", Icon: Wallet, label: "Не уверен, хватит ли денег" },
]
const MOTIVATION_ORDER = [...MOTIVATION_OPTS.map((o) => o.val), "other"]
const CONCERN_ORDER = [...CONCERN_OPTS.map((o) => o.val), "other"]

const LEVEL_OPTS = [
  { val: "bachelor", Icon: GraduationCap, title: "Бакалавриат", sub: "3–4 года" },
  { val: "master", Icon: BookOpen, title: "Магистратура", sub: "1–2 года" },
  { val: "phd", Icon: FlaskConical, title: "PhD / Докторантура", sub: "3–4 года" },
]
const LEVEL_ORDER = LEVEL_OPTS.map((o) => o.val)

const YEAR_OPTS = [
  { val: "done", label: "Уже закончил" },
  { val: "2025", label: "2025" },
  { val: "2026", label: "2026" },
  { val: "2027", label: "2027" },
  { val: "2028", label: "2028" },
  { val: "later", label: "Позже" },
]

const ENGLISH_OPTS = [
  { val: "A1", desc: "Начальный" },
  { val: "A2", desc: "Элементарный" },
  { val: "B1", desc: "Средний" },
  { val: "B2", desc: "Выше среднего" },
  { val: "C1", desc: "Продвинутый" },
  { val: "C2", desc: "Свободно" },
]
const CERT_OPTS = ["IELTS", "TOEFL", "Duolingo", "Cambridge"]
const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"]
const LANGS = [
  "Немецкий",
  "Французский",
  "Испанский",
  "Итальянский",
  "Нидерландский",
  "Польский",
  "Чешский",
  "Португальский",
  "Шведский",
]

type IconType = React.ComponentType<{ className?: string }>
const FIELD_OPTS: { val: string; label: string; Icon: IconType }[] = [
  { val: "it", label: "IT и технологии", Icon: Laptop },
  { val: "business", label: "Бизнес и экономика", Icon: ChartColumn },
  { val: "engineering", label: "Инженерия", Icon: Cog },
  { val: "medicine", label: "Медицина", Icon: HeartPulse },
  { val: "design", label: "Дизайн и архитектура", Icon: PenTool },
  { val: "law", label: "Право и политика", Icon: Scale },
  { val: "humanities", label: "Гуманитарные науки", Icon: BookOpen },
  { val: "science", label: "Точные науки", Icon: FlaskConical },
  { val: "education", label: "Педагогика", Icon: GraduationCap },
  { val: "psychology", label: "Психология", Icon: Brain },
  { val: "undecided", label: "Ещё не решил", Icon: CircleQuestionMark },
  { val: "other", label: "Другое", Icon: Pencil },
]
const FIELD_ORDER = FIELD_OPTS.map((o) => o.val)

const INTERN_OPTS: { val: string; label: string; Icon: IconType }[] = [
  { val: "it", label: "IT и разработка", Icon: Code },
  { val: "marketing", label: "Маркетинг и PR", Icon: Megaphone },
  { val: "finance", label: "Финансы", Icon: CircleDollarSign },
  { val: "design", label: "Дизайн и медиа", Icon: PenTool },
  { val: "management", label: "Менеджмент", Icon: Briefcase },
  { val: "research", label: "Исследования", Icon: Search },
]
const INTERN_ORDER = INTERN_OPTS.map((o) => o.val)

const COUNTRY_OPTS = [
  { val: "de", flag: "🇩🇪", name: "Германия" },
  { val: "it", flag: "🇮🇹", name: "Италия" },
  { val: "at", flag: "🇦🇹", name: "Австрия" },
  { val: "fr", flag: "🇫🇷", name: "Франция" },
  { val: "nl", flag: "🇳🇱", name: "Нидерланды" },
  { val: "ie", flag: "🇮🇪", name: "Ирландия" },
  { val: "es", flag: "🇪🇸", name: "Испания" },
  { val: "gb", flag: "🇬🇧", name: "Великобритания" },
]
const COUNTRY_ORDER = [...COUNTRY_OPTS.map((o) => o.val), "any"]
const COUNTRY_MAX = 3

const AI_LINES = [
  "Сверяем твои баллы с требованиями программ",
  "Отбираем варианты в рамках бюджета",
  "Проверяем стипендии и дедлайны",
  "Собираем список",
]

/* ---------- matching (ported 1:1 from legacy) ---------- */
interface MatchedProgram {
  id?: string
  university: string
  country: string
  flag: string
  program: string
  cost: string
  deadline: string
  reason: string
  /** Описание вуза – слот под текст в карточке (наполняется из данных). */
  desc?: string
}

const FALLBACK_PROGRAMS: MatchedProgram[] = [
  {
    university: "TU Berlin",
    country: "Германия",
    flag: "🇩🇪",
    program: "Computer Science M.Sc.",
    cost: "Бесплатно",
    deadline: "15 янв 2026",
    reason: "Бесплатное обучение для иностранцев, нужен B2",
  },
  {
    university: "University of Helsinki",
    country: "Финляндия",
    flag: "🇫🇮",
    program: "Computer Science B.Sc.",
    cost: "$1 500 / год",
    deadline: "25 янв 2026",
    reason: "Стипендия до 100%, сильная IT-программа",
  },
]

const FIELD_MAP: Record<string, string[]> = {
  it: ["Computer Science"],
  business: ["Economics", "Management", "Business", "Marketing"],
  engineering: ["Computer Science", "Architecture", "Mathematics"],
  medicine: ["Medicine", "Biomedicine"],
  design: ["Design", "Architecture"],
  law: ["Law", "Political Science"],
  humanities: ["Social Sciences", "European Studies", "International Relations", "Public Policy"],
  science: ["Mathematics", "Biomedicine"],
  education: ["Social Sciences"],
  psychology: ["Psychology"],
}
const COUNTRY_MAP: Record<string, string> = {
  de: "Германия",
  it: "Италия",
  at: "Австрия",
  fr: "Франция",
  nl: "Нидерланды",
  ie: "Ирландия",
  es: "Испания",
  gb: "Великобритания",
}

function parseBudgetAmount(budget: string): number {
  const s = (budget || "").toString()
  if (/∞|без огранич/i.test(s)) return Infinity
  if (/беспл/i.test(s)) return 0
  const d = s.replace(/[^0-9]/g, "")
  return d ? parseInt(d, 10) : Infinity
}

function buildMatches(profile: Profile): MatchedProgram[] {
  const data = window.AdmiticaData
  if (!data || !data.universities) return FALLBACK_PROGRAMS.slice()
  const selFields = (profile.fields || []).filter((f) => FIELD_MAP[f])
  const wantFields = selFields.flatMap((f) => FIELD_MAP[f])
  const hasField = wantFields.length > 0
  const selCountries = profile.countries || []
  const wantCountries = selCountries.filter((c) => COUNTRY_MAP[c]).map((c) => COUNTRY_MAP[c])
  const anyCountry = selCountries.indexOf("any") > -1 || wantCountries.length === 0
  const levels = profile.level || []
  // Budget is a HARD constraint, not just a tie-breaker: we never recommend a
  // university the student can't afford. "Не знаю" / "Без ограничений" disable it.
  const budget = profile.budgetUnknown ? Infinity : parseBudgetAmount(profile.budget)
  const withinBudget = (max: number | undefined) =>
    !isFinite(budget) || typeof max !== "number" || max <= budget

  // Only ever consider affordable universities…
  let pool = data.universities.filter((u) => withinBudget(u.tuitionMax))
  // …but if the budget is so low that nothing qualifies (e.g. "Бесплатно"), fall
  // back to the cheapest options instead of showing an empty or random list.
  if (!pool.length) {
    pool = [...data.universities].sort((a, b) => (a.tuitionMax || 0) - (b.tuitionMax || 0)).slice(0, 6)
  }

  const scored = pool.map((u) => {
    let score = 0
    const reasons: string[] = []
    const fieldHit = hasField && wantFields.some((w) => (u.field || "").indexOf(w) > -1)
    if (fieldHit) {
      score += 4
      reasons.push("направление")
    }
    const countryHit = !anyCountry && wantCountries.indexOf(u.country) > -1
    if (countryHit) {
      score += 3
      reasons.push("страна")
    }
    if (levels.length) {
      const dg = u.degree || ""
      const lvlHit =
        (levels.indexOf("bachelor") > -1 && /Бакалавр/i.test(dg)) ||
        (levels.indexOf("master") > -1 && /Магистрат/i.test(dg)) ||
        (levels.indexOf("phd") > -1 && /PhD|Доктор/i.test(dg))
      if (lvlHit) {
        score += 2
        reasons.push("уровень")
      }
    }
    if (profile.grant && u.scholarship) {
      score += 1
      reasons.push("есть стипендия")
    }
    const hard = (!hasField || fieldHit) && (anyCountry || countryHit)
    return { u, score, reasons, hard: hard ? 1 : 0 }
  })
  // Relevance first; among equally relevant options, cheaper first (budget-conscious).
  scored.sort((a, b) => b.hard - a.hard || b.score - a.score || (a.u.tuitionMax || 0) - (b.u.tuitionMax || 0))
  // Always surface Università Bocconi (u1) first when it qualifies for the budget –
  // it has the fullest content, so we want it clicked first.
  const bocconiAt = scored.findIndex((s) => s.u.id === "u1")
  if (bocconiAt > 0) scored.unshift(scored.splice(bocconiAt, 1)[0])
  const top = scored.slice(0, 6)
  const programs = top.map(({ u, reasons }) => ({
    id: u.id,
    university: u.name,
    country: u.country,
    flag: u.flag,
    program: u.program,
    cost: u.tuition,
    deadline: u.deadline,
    reason: reasons.length ? "совпадает " + reasons.join(", ") : (u.desc || "").slice(0, 70),
    desc: u.desc,
  }))
  return programs.length ? programs : FALLBACK_PROGRAMS.slice()
}

/* ---------- budget slider (legacy constants & formatting) ---------- */
const BUDGET_MAX = 50000
const BUDGET_SPAN = 96 // slider 0..96 → $0..$50000, 97..100 → ∞

function fmtMoney(a: number) {
  return "$" + a.toLocaleString("ru-RU").replace(/,/g, " ")
}
type BudgetTone = "free" | "inf" | "norm"
function budgetLabel(v: number): { t: string; tone: BudgetTone; amt: number } {
  if (v > BUDGET_SPAN) return { t: "∞ Без ограничений", tone: "inf", amt: Infinity }
  const amt = Math.round(((v / BUDGET_SPAN) * BUDGET_MAX) / 500) * 500
  if (amt <= 0) return { t: "Бесплатно", tone: "free", amt: 0 }
  return { t: fmtMoney(amt) + " / год", tone: "norm", amt }
}

function plural(n: number, a: string, b: string, c: string) {
  const m = n % 100
  const d = n % 10
  if (m >= 11 && m <= 14) return c
  if (d === 1) return a
  if (d >= 2 && d <= 4) return b
  return c
}

/* ---------- confetti burst (legacy port, app color tokens) ---------- */
function burst(x: number, y: number, count = 6) {
  const colors = ["var(--color-accent)", "var(--color-positive)", "var(--color-warning)"]
  for (let i = 0; i < count; i++) {
    const d = document.createElement("div")
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:8px;height:8px;border-radius:50%;z-index:200;pointer-events:none;background:${colors[i % 3]}`
    document.body.appendChild(d)
    const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5)
    const dist = 40 + Math.random() * 40
    const dx = Math.cos(ang) * dist
    const dy = Math.sin(ang) * dist - 60
    d.animate(
      [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: `translate(${dx}px,${dy}px)`, opacity: 0 },
      ],
      { duration: 600, easing: "ease-out" },
    )
    setTimeout(() => d.remove(), 650)
  }
}

const numFilter = (s: string) => s.replace(/[^0-9.]/g, "")
const digitsOnly = (s: string) => s.replace(/[^0-9]/g, "")

/* ============================================================
   Small presentational pieces
   ============================================================ */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest text-accent-text uppercase">
      <span className="h-0.5 w-4 rounded-full bg-accent" />
      {children}
    </div>
  )
}

function Heading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn("text-2xl font-bold tracking-tight text-balance sm:text-[27px]", className)}>{children}</h1>
}

function Subtext({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-fg-muted">{children}</p>
}

function SelectCheck({ on }: { on: boolean }) {
  return (
    <AnimatePresence>
      {on && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-accent text-accent-fg"
        >
          <Check className="size-3" strokeWidth={3} />
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function OptionCard({
  selected,
  dimmed,
  onClick,
  className,
  children,
}: {
  selected: boolean
  dimmed?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        // transition border/background only – never opacity (it fought the screen-level fade)
        "relative flex w-full items-center gap-3.5 rounded-2xl border bg-card p-4 text-left transition-[border-color,background-color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        selected ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40",
        dimmed && "opacity-40",
        className,
      )}
    >
      {children}
      <SelectCheck on={selected} />
    </motion.button>
  )
}

function IconTile({ Icon, className }: { Icon: IconType; className?: string }) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl bg-card-2", className)}>
      <Icon className="size-5 text-accent-text" />
    </span>
  )
}

function CheckRow({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 text-left text-sm transition-colors",
        on ? "font-semibold text-accent-text" : "text-fg",
      )}
    >
      <span
        className={cn(
          "grid size-5.5 shrink-0 place-items-center rounded-md border transition-colors",
          on ? "border-accent bg-accent text-accent-fg" : "border-border-strong bg-card-2",
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

function OptOutCard({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 text-left text-sm font-semibold transition-colors duration-200",
        on
          ? "border-solid border-accent bg-accent-soft text-accent-text"
          : "border-border-strong bg-card text-fg hover:border-accent/40",
      )}
    >
      <span
        className={cn(
          "grid size-5.5 shrink-0 place-items-center rounded-md border transition-colors",
          on ? "border-accent bg-accent text-accent-fg" : "border-border-strong bg-card-2",
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

function ToggleLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
    >
      {children}
    </button>
  )
}

function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Дальше",
}: {
  onBack: () => void
  onNext: () => void
  nextDisabled?: boolean
  nextLabel?: string
}) {
  return (
    <div className="mt-7 flex items-center gap-3">
      <Button variant="secondary" size="xl" className="px-5" onClick={onBack}>
        Назад
      </Button>
      <Button size="xl" className="flex-1" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  )
}

/* odometer / drum number (legacy .reel) */
function Reel({ to }: { to: number }) {
  return (
    <span className="inline-block h-[1em] overflow-hidden align-[-0.14em]">
      <motion.span
        className="flex flex-col items-center will-change-transform"
        initial={{ y: "0em" }}
        animate={{ y: `-${to}em` }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        {Array.from({ length: to + 1 }, (_, i) => (
          <span key={i} className="block h-[1em] leading-[1em]">
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

/* ============================================================
   Main component
   ============================================================ */
export interface OnboardingProps {
  onDone: (name: string) => void
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const reduced = useReducedMotion()
  const [screen, setScreen] = useState(1)

  /* screen 1 – letter-fly intro + name */
  const [introPhase, setIntroPhase] = useState(0)
  const [nameDraft, setNameDraft] = useState("")

  /* the legacy profile object (gpa/budget pre-seeded exactly like legacy on-load handlers) */
  const [profile, setProfile] = useState<Profile>(() => ({
    name: "",
    gpa: "3.5",
    budget: budgetLabel(35).t,
  }))

  /* UI-only state (legacy never persisted these – kept byte-compatible) */
  const [otherMotivation, setOtherMotivation] = useState("")
  const [otherConcern, setOtherConcern] = useState("")
  const [levelUnknown, setLevelUnknown] = useState(false)
  const [yearCustom, setYearCustom] = useState("")
  const [gpaSlider, setGpaSlider] = useState(3.5)
  const [gpaOtherOpen, setGpaOtherOpen] = useState(false)
  const [gpaOtherText, setGpaOtherText] = useState("")
  const [certOpen, setCertOpen] = useState(false)
  const [certScore, setCertScore] = useState("")
  const [langOpen, setLangOpen] = useState(false)
  const [langRows, setLangRows] = useState<LangRow[]>([])
  const [openDd, setOpenDd] = useState<number | null>(null)
  const langSeq = useRef(0)
  const [fieldsOtherText, setFieldsOtherText] = useState("")
  const [noInternship, setNoInternship] = useState(false)
  const [countryUnknown, setCountryUnknown] = useState(false)
  const [budgetSlider, setBudgetSlider] = useState(35)
  const [budgetCustom, setBudgetCustom] = useState("18000")

  /* screens 12–13 */
  const [programs, setPrograms] = useState<MatchedProgram[]>([])
  const [aiStep, setAiStep] = useState(-1)
  const [savedSel, setSavedSel] = useState<string[]>([])
  const doneRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setIntroPhase(1), reduced ? 100 : 1700)
    return () => clearTimeout(t)
  }, [reduced])

  /* ---------- helpers ---------- */
  const displayName = profile.name || "друг"

  const toggleMulti = (key: "motivation" | "concern" | "level" | "fields" | "internships", val: string, order: string[]) => {
    setProfile((p) => {
      const cur = new Set(p[key] ?? [])
      if (cur.has(val)) cur.delete(val)
      else cur.add(val)
      return { ...p, [key]: order.filter((v) => cur.has(v)) }
    })
  }

  const toggleCountry = (val: string) => {
    setProfile((p) => {
      const cur = p.countries ?? []
      let next: string[]
      if (val === "any") {
        next = cur.includes("any") ? [] : ["any"]
      } else {
        const base = cur.filter((v) => v !== "any")
        if (base.includes(val)) next = base.filter((v) => v !== val)
        else if (base.length >= COUNTRY_MAX) return p
        else next = [...base, val]
      }
      return { ...p, countries: COUNTRY_ORDER.filter((v) => next.includes(v)) }
    })
    setCountryUnknown(false)
  }

  const canNext = (): boolean => {
    switch (screen) {
      case 2:
        return (profile.motivation?.length ?? 0) > 0
      case 3:
        return (profile.concern?.length ?? 0) > 0
      case 4:
        return (profile.level?.length ?? 0) > 0 || levelUnknown
      case 5:
        return Boolean(profile.year)
      case 7:
        return Boolean(profile.english)
      case 8:
        return (profile.fields?.length ?? 0) > 0
      case 9:
        return (profile.internships?.length ?? 0) > 0 || noInternship
      case 10:
        return (profile.countries?.length ?? 0) > 0 || countryUnknown
      default:
        return true // screens 6 and 11 have no required group
    }
  }

  const back = () => setScreen((s) => Math.max(1, s - 1))
  const next = () => setScreen((s) => Math.min(13, s + 1))

  const submitName = () => {
    // TEMP: while COLLECT_NAME is off, everyone is "Гость" (see top of file / README)
    const n = COLLECT_NAME ? nameDraft.trim() : GUEST_NAME
    if (!n) return
    setProfile((p) => ({ ...p, name: n }))
    burst(window.innerWidth / 2, window.innerHeight / 2)
    setScreen(2)
  }

  const startMatching = () => {
    setAiStep(-1)
    setPrograms(buildMatches(profile))
    setScreen(12)
  }

  /* AI screen choreography – same timings as legacy startAI();
     with reduced motion the sequence collapses to a short beat */
  useEffect(() => {
    if (screen !== 12) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const step = reduced ? 350 : 1350
    const hold = reduced ? 250 : 1150
    let t = reduced ? 150 : 450
    for (let i = 0; i < AI_LINES.length; i++) {
      const idx = i
      timers.push(setTimeout(() => setAiStep(idx), t))
      timers.push(setTimeout(() => setAiStep(-1), t + hold))
      t += step
    }
    timers.push(
      setTimeout(() => {
        setAiStep(4)
        if (!reduced) burst(window.innerWidth / 2, window.innerHeight / 2 - 40)
      }, t),
    )
    timers.push(setTimeout(() => setScreen(13), t + (reduced ? 500 : 1700)))
    return () => timers.forEach(clearTimeout)
  }, [screen, reduced])

  /* languages */
  const addLangRow = () => {
    setLangRows((rows) => [...rows, { key: langSeq.current++, lang: null, level: null, cert: "", score: "" }])
  }
  const patchLang = (key: number, patch: Partial<LangEntry>) => {
    setLangRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const removeLang = (key: number) => {
    setLangRows((rows) => rows.filter((r) => r.key !== key))
    setOpenDd((d) => (d === key ? null : d))
  }

  /* GPA */
  const onGpaSlide = (v: number) => {
    setGpaSlider(v)
    setProfile((p) => ({ ...p, gpa: v.toFixed(1) }))
  }
  const toggleGpaUnknown = () => {
    setProfile((p) => {
      const on = !p.gpaUnknown
      return { ...p, gpaUnknown: on, gpa: on ? null : gpaSlider.toFixed(1) }
    })
  }

  /* Budget */
  const onBudgetSlide = (v: number) => {
    setBudgetSlider(v)
    const { t, amt } = budgetLabel(v)
    setProfile((p) => ({ ...p, budget: t }))
    setBudgetCustom(isFinite(amt) && amt > 0 ? String(amt) : "")
  }
  const onBudgetCustom = (raw: string) => {
    const clean = digitsOnly(raw)
    setBudgetCustom(clean)
    const amt = Math.min(BUDGET_MAX, +clean || 0)
    setBudgetSlider(Math.round((amt / BUDGET_MAX) * BUDGET_SPAN))
    setProfile((p) => ({ ...p, budget: amt <= 0 ? "Бесплатно" : fmtMoney(amt) + " / год" }))
  }

  /* results */
  const toggleProgSave = (pid: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const on = !savedSel.includes(pid)
    setSavedSel((s) => (on ? [...s, pid] : s.filter((x) => x !== pid)))
    if (on) {
      const r = e.currentTarget.getBoundingClientRect()
      burst(r.left + 9, r.top + 9, 3)
    }
  }

  /* ---------- completion: byte-compatible with legacy finishOnboarding() ----------
     idsOverride: «Пропустить» передаёт [] – выбор не сохраняется. */
  const finishOnboarding = (idsOverride?: string[]) => {
    if (doneRef.current) return
    doneRef.current = true
    try {
      const ids = (idsOverride ?? savedSel).filter((x) => /^[ugi]\d+$/.test(x))
      const out: Record<string, unknown> = {
        ...profile,
        langs: langRows.map(({ key: _key, ...entry }) => entry),
        savedProgramIds: ids,
      }
      localStorage.setItem("admitica.onboardingProfile", JSON.stringify(out))
      localStorage.setItem("admitica.onboarded", "true")
      // admitica.name is persisted by the app shell via onDone → usePersist (same JSON encoding)
      if (ids.length) {
        localStorage.setItem("admitica.savedIds", JSON.stringify(ids))
        localStorage.setItem("admitica.priorities", JSON.stringify([]))
        localStorage.setItem("admitica.roadmaps", JSON.stringify([]))
      }
    } catch {
      /* quota / private mode */
    }
    onDone(profile.name.trim())
  }

  /* progress chrome – same formula as legacy progressWidth() */
  const pw = screen < 2 || screen > 11 ? null : 11 + ((screen - 2) * (100 - 11)) / 9
  const lastPw = useRef(11)
  if (pw !== null) lastPw.current = pw

  const budgetTone: BudgetTone = /беспл/i.test(profile.budget) ? "free" : /∞/.test(profile.budget) ? "inf" : "norm"

  /* ============================================================
     Screens
     ============================================================ */
  const renderScreen = () => {
    switch (screen) {
      /* -------- SCREEN 1 – name (letter-fly intro merged in) -------- */
      case 1:
        return (
          <div className="flex w-full flex-col items-center text-center">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl" aria-label="Admitica">
              {LETTERS.map((l, i) => (
                <motion.span
                  key={i}
                  initial={reduced ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : i * 0.1 }}
                  className="inline-block"
                >
                  {l}
                </motion.span>
              ))}
              <motion.span
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: reduced ? 0 : LETTERS.length * 0.1 }}
                className="text-accent-text"
              >
                .
              </motion.span>
            </h1>

            <AnimatePresence>
              {introPhase >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-4"
                >
                  {/* TEMP: name input hidden (legal). Restore by setting COLLECT_NAME = true. */}
                  {COLLECT_NAME ? (
                    <>
                      <div>
                        <div className="text-lg font-semibold">Как тебя зовут?</div>
                        <div className="mt-1.5 text-sm text-fg-muted">Будем обращаться по имени на протяжении подбора</div>
                      </div>
                      <Input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value.replace(/[^A-Za-zА-Яа-яЁё\s'-]/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && submitName()}
                        placeholder="Твоё имя"
                        autoComplete="off"
                        className="h-12 rounded-xl text-center text-base"
                        aria-label="Твоё имя"
                      />
                      <Button size="xl" onClick={submitName} disabled={!nameDraft.trim()}>
                        Начать
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-lg font-semibold">Подбор программ в Европе</div>
                        <div className="mt-1.5 text-sm text-fg-muted">
                          Ответь на пару вопросов – покажем подходящие программы, их стоимость и дедлайны
                        </div>
                      </div>
                      <Button size="xl" onClick={submitName}>
                        Начать
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )

      /* -------- SCREEN 2 – motivation -------- */
      case 2:
        return (
          <div>
            <Kicker>Мотивация</Kicker>
            <Heading>Зачем тебе учёба за рубежом, {displayName}?</Heading>
            <Subtext>Можно выбрать несколько</Subtext>
            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-5 flex flex-col gap-2.5">
              {MOTIVATION_OPTS.map((o) => {
                const sel = profile.motivation?.includes(o.val) ?? false
                return (
                  <OptionCard key={o.val} selected={sel} onClick={() => toggleMulti("motivation", o.val, MOTIVATION_ORDER)}>
                    <IconTile Icon={o.Icon} />
                    <span className="pr-6 text-[15px] font-medium">{o.label}</span>
                  </OptionCard>
                )
              })}
              <ExpandCard
                selected={profile.motivation?.includes("other") ?? false}
                onToggle={() => toggleMulti("motivation", "other", MOTIVATION_ORDER)}
                value={otherMotivation}
                onChange={setOtherMotivation}
              />
            </motion.div>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 3 – concerns -------- */
      case 3:
        return (
          <div>
            <Kicker>Сомнения</Kicker>
            <Heading>Что беспокоит тебя больше всего?</Heading>
            <Subtext>Можно выбрать несколько</Subtext>
            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-5 flex flex-col gap-2.5">
              {CONCERN_OPTS.map((o) => {
                const sel = profile.concern?.includes(o.val) ?? false
                return (
                  <OptionCard key={o.val} selected={sel} onClick={() => toggleMulti("concern", o.val, CONCERN_ORDER)}>
                    <IconTile Icon={o.Icon} />
                    <span className="pr-6 text-[15px] font-medium">{o.label}</span>
                  </OptionCard>
                )
              })}
              <ExpandCard
                selected={profile.concern?.includes("other") ?? false}
                onToggle={() => toggleMulti("concern", "other", CONCERN_ORDER)}
                value={otherConcern}
                onChange={setOtherConcern}
              />
            </motion.div>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 4 – education level -------- */
      case 4:
        return (
          <div>
            <Kicker>Уровень обучения</Kicker>
            <Heading>Какое образование ты хочешь получить?</Heading>
            <Subtext>Можно выбрать несколько</Subtext>
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className={cn("mt-5 flex flex-col gap-2.5 transition-opacity duration-300", levelUnknown && "pointer-events-none opacity-30")}
            >
              {LEVEL_OPTS.map((o) => {
                const sel = profile.level?.includes(o.val) ?? false
                return (
                  <OptionCard key={o.val} selected={sel} onClick={() => { toggleMulti("level", o.val, LEVEL_ORDER); setLevelUnknown(false) }}>
                    <IconTile Icon={o.Icon} />
                    <span className="pr-6">
                      <span className="block text-base font-semibold">{o.title}</span>
                      <span className="mt-0.5 block text-xs text-fg-muted">{o.sub}</span>
                    </span>
                  </OptionCard>
                )
              })}
            </motion.div>
            <div className="mt-4 flex flex-col gap-3.5">
              <CheckRow
                on={profile.grant ?? false}
                onClick={() => setProfile((p) => ({ ...p, grant: !p.grant }))}
              >
                Нужно вместе с грантом / стипендией
              </CheckRow>
              <OptOutCard
                on={levelUnknown}
                onClick={() => {
                  const on = !levelUnknown
                  setLevelUnknown(on)
                  if (on) setProfile((p) => ({ ...p, level: [] }))
                }}
              >
                Пока не знаю
              </OptOutCard>
            </div>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 5 – graduation year -------- */
      case 5:
        return (
          <div>
            <Kicker>Сроки</Kicker>
            <Heading>Когда ты заканчиваешь учёбу?</Heading>
            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {YEAR_OPTS.map((o) => (
                <OptionCard
                  key={o.val}
                  selected={profile.year === o.val}
                  onClick={() => setProfile((p) => ({ ...p, year: o.val }))}
                  className="min-h-16 justify-center p-3 text-center"
                >
                  <span className="text-[15px] font-semibold">{o.label}</span>
                </OptionCard>
              ))}
            </motion.div>
            <Reveal open={profile.year === "later"}>
              <Input
                autoFocus
                value={yearCustom}
                onChange={(e) => setYearCustom(numFilter(e.target.value))}
                placeholder="Укажи свой год – например, 2030"
                inputMode="numeric"
                maxLength={4}
                className="mt-3.5 h-12 rounded-xl"
              />
            </Reveal>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 6 – GPA -------- */
      case 6:
        return (
          <div>
            <Kicker>Средний балл</Kicker>
            <Heading>Какой у тебя средний балл?</Heading>
            <div className={cn("mt-8 transition-opacity duration-300", profile.gpaUnknown && "pointer-events-none opacity-30")}>
              <motion.div
                key={gpaSlider.toFixed(1)}
                initial={{ opacity: 0.5, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                className="text-center text-6xl font-extrabold tracking-tight"
              >
                {gpaSlider.toFixed(1)}
              </motion.div>
              <input
                type="range"
                min={2}
                max={5}
                step={0.1}
                value={gpaSlider}
                onChange={(e) => onGpaSlide(parseFloat(e.target.value))}
                className="mt-7 w-full accent-accent"
                aria-label="Средний балл"
              />
              <div className="mt-2 flex justify-between text-xs text-fg-muted">
                <span>2.0</span>
                <span>5.0</span>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              <CheckRow on={profile.gpaUnknown ?? false} onClick={toggleGpaUnknown}>
                Не знаю свой балл
              </CheckRow>
              <div>
                <ToggleLink onClick={() => setGpaOtherOpen((o) => !o)}>
                  Другая система оценок <ChevronDown className={cn("size-3.5 transition-transform", gpaOtherOpen && "rotate-180")} />
                </ToggleLink>
                <Reveal open={gpaOtherOpen}>
                  <Input
                    value={gpaOtherText}
                    onChange={(e) => setGpaOtherText(e.target.value)}
                    placeholder="Например: 85% или B+"
                    className="mt-3 h-12 rounded-xl"
                  />
                </Reveal>
              </div>
            </div>
            <Nav onBack={back} onNext={next} />
          </div>
        )

      /* -------- SCREEN 7 – English level + certificates + extra languages -------- */
      case 7:
        return (
          <div>
            <Kicker>ЯЗЫКИ</Kicker>
            <Heading>Какой у тебя уровень английского?</Heading>
            <Subtext>Выбери свой уровень</Subtext>
            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ENGLISH_OPTS.map((o) => (
                <OptionCard
                  key={o.val}
                  selected={profile.english === o.val}
                  onClick={() => setProfile((p) => ({ ...p, english: o.val }))}
                  className="min-h-19 flex-col justify-center gap-0.5 p-3 text-center"
                >
                  <span className="text-2xl font-extrabold tracking-tight">{o.val}</span>
                  <span className="text-xs text-fg-muted">{o.desc}</span>
                </OptionCard>
              ))}
            </motion.div>

            <div className="mt-5">
              <ToggleLink onClick={() => setCertOpen((o) => !o)}>
                <Plus className="size-3.5" /> Есть языковой сертификат?
              </ToggleLink>
              <Reveal open={certOpen}>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {CERT_OPTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, cert: c }))}
                      className={cn(
                        "h-9 rounded-full border px-4 text-[13px] font-semibold transition-colors",
                        profile.cert === c
                          ? "border-transparent bg-accent text-accent-fg"
                          : "border-border bg-card text-fg hover:border-accent/40",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <Reveal open={Boolean(profile.cert)}>
                  <Input
                    value={certScore}
                    onChange={(e) => {
                      const v = numFilter(e.target.value)
                      setCertScore(v)
                      setProfile((p) => ({ ...p, certScore: v }))
                    }}
                    placeholder="Балл"
                    inputMode="numeric"
                    className="mt-3 h-12 max-w-44 rounded-xl"
                  />
                </Reveal>
              </Reveal>
            </div>

            <div className="mt-5">
              <ToggleLink
                onClick={() => {
                  const open = !langOpen
                  setLangOpen(open)
                  if (open && langRows.length === 0) addLangRow()
                }}
              >
                <Plus className="size-3.5" /> Знаю ещё один европейский язык
              </ToggleLink>
              <Reveal open={langOpen}>
                <div>
                  {langRows.map((row, i) => (
                    <div key={row.key} className="mt-3.5 flex flex-col gap-3 border-l-2 border-accent/25 pl-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold tracking-widest text-accent-text uppercase">Язык {i + 1}</span>
                        <button
                          type="button"
                          aria-label="Убрать"
                          onClick={() => removeLang(row.key)}
                          className="grid size-7 place-items-center rounded-lg border border-border text-fg-muted transition-colors hover:border-accent/40 hover:text-fg"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <LangDropdown
                        value={row.lang}
                        open={openDd === row.key}
                        onToggle={() => setOpenDd((d) => (d === row.key ? null : row.key))}
                        onSelect={(l) => {
                          patchLang(row.key, { lang: l })
                          setOpenDd(null)
                        }}
                      />
                      <Reveal open={Boolean(row.lang)}>
                        <p className="mb-2 text-xs text-fg-muted">Уровень</p>
                        <div className="grid grid-cols-6 gap-2">
                          {CEFR.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => patchLang(row.key, { level: v })}
                              className={cn(
                                "h-10 rounded-lg border text-sm font-bold transition-colors",
                                row.level === v
                                  ? "border-transparent bg-accent text-accent-fg"
                                  : "border-border bg-card text-fg hover:border-accent/40",
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-col gap-2.5">
                          <Input
                            value={row.cert}
                            onChange={(e) => patchLang(row.key, { cert: e.target.value })}
                            placeholder="Сертификат – например, IELTS / Goethe"
                            className="h-11 rounded-xl"
                          />
                          <Input
                            value={row.score}
                            onChange={(e) => patchLang(row.key, { score: numFilter(e.target.value) })}
                            placeholder="Балл – например, 7.5"
                            inputMode="numeric"
                            className="h-11 rounded-xl"
                          />
                        </div>
                      </Reveal>
                    </div>
                  ))}
                  {langRows.length > 0 && (
                    <div className="mt-4">
                      <ToggleLink onClick={addLangRow}>
                        <Plus className="size-3.5" /> Добавить ещё язык
                      </ToggleLink>
                    </div>
                  )}
                </div>
              </Reveal>
            </div>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 8 – field of study -------- */
      case 8:
        return (
          <div>
            <Kicker>Направление</Kicker>
            <Heading>Что хочешь изучать?</Heading>
            <Subtext>Можно выбрать несколько</Subtext>
            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {FIELD_OPTS.map((o) => {
                const sel = profile.fields?.includes(o.val) ?? false
                return (
                  <OptionCard
                    key={o.val}
                    selected={sel}
                    onClick={() => toggleMulti("fields", o.val, FIELD_ORDER)}
                    className="min-h-21 flex-col items-start justify-center gap-1.5 p-3"
                  >
                    <o.Icon className="size-6 text-accent-text" />
                    <span className="pr-5 text-[13px] leading-tight font-medium">{o.label}</span>
                  </OptionCard>
                )
              })}
            </motion.div>
            <Reveal open={profile.fields?.includes("other") ?? false}>
              <Textarea
                autoFocus
                value={fieldsOtherText}
                onChange={(e) => setFieldsOtherText(e.target.value)}
                placeholder="Что именно хочешь изучать? Напиши своими словами..."
                className="mt-3 min-h-20 rounded-xl bg-card"
              />
            </Reveal>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 9 – internships -------- */
      case 9:
        return (
          <div>
            <Kicker>Стажировки</Kicker>
            <Heading>В какой сфере хочешь стажироваться?</Heading>
            <Subtext>Можно выбрать несколько</Subtext>
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className={cn(
                "mt-5 grid grid-cols-2 gap-2.5 transition-opacity duration-300 sm:grid-cols-3",
                noInternship && "pointer-events-none opacity-30",
              )}
            >
              {INTERN_OPTS.map((o) => {
                const sel = profile.internships?.includes(o.val) ?? false
                return (
                  <OptionCard
                    key={o.val}
                    selected={sel}
                    onClick={() => { toggleMulti("internships", o.val, INTERN_ORDER); setNoInternship(false) }}
                    className="min-h-21 flex-col items-start justify-center gap-1.5 p-3"
                  >
                    <o.Icon className="size-6 text-accent-text" />
                    <span className="pr-5 text-[13px] leading-tight font-medium">{o.label}</span>
                  </OptionCard>
                )
              })}
            </motion.div>
            <div className="mt-4">
              <OptOutCard
                on={noInternship}
                onClick={() => {
                  const on = !noInternship
                  setNoInternship(on)
                  if (on) setProfile((p) => ({ ...p, internships: [] }))
                }}
              >
                Пока не нужна стажировка
              </OptOutCard>
            </div>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )

      /* -------- SCREEN 10 – target countries -------- */
      case 10: {
        const sel = profile.countries ?? []
        const cnt = sel.filter((v) => v !== "any").length
        const dim = cnt >= COUNTRY_MAX
        return (
          <div>
            <Kicker>География</Kicker>
            <div className="flex items-start justify-between gap-3">
              <Heading>В каких странах хочешь учиться?</Heading>
              <button
                type="button"
                onClick={next}
                className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md text-sm text-fg-muted transition-colors outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Пропустить <ArrowRight className="size-3.5" />
              </button>
            </div>
            <Subtext>Выбери до 3 стран</Subtext>
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className={cn(
                "mt-5 grid grid-cols-1 gap-2.5 transition-opacity duration-300 sm:grid-cols-2",
                countryUnknown && "pointer-events-none opacity-30",
              )}
            >
              {COUNTRY_OPTS.map((o) => {
                const isSel = sel.includes(o.val)
                return (
                  <OptionCard
                    key={o.val}
                    selected={isSel}
                    dimmed={dim && !isSel}
                    onClick={() => toggleCountry(o.val)}
                    className="min-h-16 p-3.5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card-2">
                      <span aria-hidden="true" className="size-5 rounded-full border-2 border-accent-text" />
                    </span>
                    <span className="pr-6 text-[15px] font-medium">{o.name}</span>
                  </OptionCard>
                )
              })}
              <OptionCard
                selected={sel.includes("any")}
                onClick={() => toggleCountry("any")}
                className="min-h-16 p-3.5 sm:col-span-2"
              >
                <IconTile Icon={Globe} className="size-10" />
                <span className="pr-6 text-[15px] font-medium">
                  Рассматриваю весь мир, главное - качество образования и цена
                </span>
              </OptionCard>
            </motion.div>
            <div className="mt-4">
              <OptOutCard
                on={countryUnknown}
                onClick={() => {
                  const on = !countryUnknown
                  setCountryUnknown(on)
                  if (on) setProfile((p) => ({ ...p, countries: [] }))
                }}
              >
                Пока не знаю
              </OptOutCard>
            </div>
            <Nav onBack={back} onNext={next} nextDisabled={!canNext()} />
          </div>
        )
      }

      /* -------- SCREEN 11 – budget -------- */
      case 11:
        return (
          <div>
            <Kicker>Бюджет</Kicker>
            <Heading>Сколько готов тратить в год?</Heading>
            <Subtext>Сумма на обучение после стипендий, если они есть</Subtext>
            <div className={cn("mt-6 transition-opacity duration-300", profile.budgetUnknown && "pointer-events-none opacity-30")}>
              <motion.div
                key={profile.budget}
                initial={{ opacity: 0.5, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  "text-center text-4xl font-extrabold tracking-tight sm:text-[44px]",
                  budgetTone === "norm" ? "text-fg" : "text-accent-text",
                )}
              >
                {profile.budget}
              </motion.div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={budgetSlider}
                onChange={(e) => onBudgetSlide(+e.target.value)}
                className="mt-6 w-full accent-accent"
                aria-label="Бюджет в год"
              />
              <div className="mt-2 flex justify-between text-xs text-fg-muted">
                <span>$0</span>
                <span>$50 000+ / ∞</span>
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <span className="text-xs whitespace-nowrap text-fg-muted">Или точная сумма:</span>
                <Input
                  value={budgetCustom}
                  onChange={(e) => onBudgetCustom(e.target.value)}
                  placeholder="например, 12000"
                  inputMode="numeric"
                  className="h-11 max-w-44 rounded-xl"
                />
                <span className="text-xs whitespace-nowrap text-fg-muted">$ / год</span>
              </div>
            </div>
            <div className="mt-4">
              <OptOutCard
                on={profile.budgetUnknown ?? false}
                onClick={() => setProfile((p) => ({ ...p, budgetUnknown: !p.budgetUnknown }))}
              >
                Не знаю пока
              </OptOutCard>
            </div>
            <Nav onBack={back} onNext={startMatching} nextLabel="Подобрать программы" />
          </div>
        )

      /* -------- SCREEN 12 – AI processing -------- */
      case 12:
        return (
          <div className="flex w-full flex-col items-center text-center">
            <div className="relative size-60">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className={cn(
                    "absolute top-1/2 left-1/2 rounded-full border-2",
                    i === 2 ? "border-accent/20" : "border-accent/40",
                  )}
                  style={{ width: 80 + i * 50, height: 80 + i * 50, x: "-50%", y: "-50%" }}
                  animate={reduced ? { opacity: 0.35 } : { scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={reduced ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: "easeOut", delay: i * 0.6 }}
                />
              ))}
              <div className="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_6px_var(--color-accent-soft)]" />
            </div>
            <div className="relative mt-9 h-12 w-full">
              <AnimatePresence mode="wait">
                {aiStep >= 0 && aiStep < 4 && (
                  <motion.div
                    key={aiStep}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-x-0 text-[15px] text-fg-muted"
                  >
                    {AI_LINES[aiStep]}
                  </motion.div>
                )}
                {aiStep === 4 && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-x-0 inline-flex w-full items-center justify-center gap-1.5 text-lg font-bold text-accent-text"
                  >
                    <Reel to={programs.length} /> {plural(programs.length, "программа", "программы", "программ")} найдено
                    <Check className="size-4" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )

      /* -------- SCREEN 13 – results -------- */
      case 13: {
        const n = savedSel.length
        return (
          <div>
            <Heading className="max-w-2xl">{displayName}, вот что подошло под твой профиль</Heading>
            <Subtext>Учли твои баллы, бюджет, направление и страны</Subtext>

            {/* Мобайл и планшет: вращающийся барабан – только свайп влево/вправо */}
            <UniWheel programs={programs} savedSel={savedSel} onToggleSave={toggleProgSave} />

            {/* Десктоп: сетка */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-7 hidden gap-4 lg:grid lg:grid-cols-3"
            >
              {programs.map((p, i) => {
                const pid = p.id || "fb" + i
                return (
                  <motion.div key={pid} variants={fadeUp}>
                    <ResultCard p={p} on={savedSel.includes(pid)} onToggleSave={(e) => toggleProgSave(pid, e)} />
                  </motion.div>
                )
              })}
            </motion.div>
            <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Badge className="w-fit px-3 py-1">
                {n} {plural(n, "программа", "программы", "программ")} выбрано
              </Badge>
              <div className="flex gap-3 max-sm:flex-col">
                <Button variant="secondary" size="xl" onClick={() => finishOnboarding([])}>
                  Пропустить
                </Button>
                <Button size="xl" onClick={() => finishOnboarding()}>
                  Войти в Admitica
                </Button>
              </div>
            </div>
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="relative min-h-dvh">
      <div className="hero-glow pointer-events-none fixed inset-0 opacity-50" />

      {/* progress chrome (screens 2–11, same widths as legacy);
          width freezes on the last value while fading out – no backwards jump */}
      <div
        aria-hidden
        className={cn("fixed inset-x-0 top-0 z-20 h-1 bg-fg/8 transition-opacity duration-300", pw === null && "opacity-0")}
      >
        <div
          className="h-full rounded-r-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${pw ?? lastPw.current}%` }}
        />
      </div>

      {/* Top-aligned, stable container. Centering for the welcome / AI-processing
          screens lives on the keyed motion.div itself, so it travels with that
          screen and never re-flows the still-exiting one (no teleport on 1↔2 / 11↔12). */}
      <div
        className={cn("relative mx-auto w-full px-5 pt-10 pb-12 sm:px-6", screen === 13 ? "max-w-5xl" : "max-w-xl")}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              screen === 1
                ? { opacity: 0, y: -32, scale: 0.92, transition: { duration: 0.45, ease: EASE } }
                : { opacity: 0, y: -10, transition: { duration: 0.2, ease: EASE } }
            }
            transition={{ duration: 0.28, ease: EASE }}
            className={cn(
              (screen === 1 || screen === 12) && "flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center",
            )}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------- result card (screen 13) – единый размер на барабане и в сетке ---------- */
function ResultCard({
  p,
  on,
  onToggleSave,
  interactive = true,
  className,
}: {
  p: MatchedProgram
  on: boolean
  onToggleSave: (e: React.MouseEvent<HTMLButtonElement>) => void
  interactive?: boolean
  className?: string
}) {
  return (
    <Card className={cn("h-full gap-0 overflow-hidden p-0", !interactive && "pointer-events-none", className)}>
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-accent to-accent/30" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[15px] leading-snug font-semibold">{p.university}</span>
          <span className="text-xs whitespace-nowrap text-fg-muted">
            {p.country}
          </span>
        </div>
        <div className="mt-1.5 text-sm font-medium">{p.program}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge>{p.cost}</Badge>
          <Badge variant="secondary">{p.deadline}</Badge>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-fg-muted">
          Подходит: <em>{p.reason}</em>
        </p>
        {/* слот под текст вуза: высота зарезервирована, наполняется описанием */}
        <p className="mt-3 line-clamp-3 min-h-16 text-[13px] leading-relaxed text-fg-muted">{p.desc ?? ""}</p>
        <button
          type="button"
          onClick={onToggleSave}
          disabled={!interactive}
          className="mt-auto flex w-full cursor-pointer items-center gap-2.5 border-t border-border pt-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span
            className={cn(
              "grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors duration-200",
              on ? "border-accent bg-accent text-accent-fg" : "border-border-strong",
            )}
          >
            {on && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className={cn("text-sm", on ? "font-medium text-accent-text" : "text-fg-muted")}>
            {on ? "Сохранено" : "Сохранить"}
          </span>
        </button>
      </div>
    </Card>
  )
}

/* ---------- university wheel (screen 13, < lg) ----------
   Вращающийся барабан: карточки на 3D-дуге, навигация ТОЛЬКО
   горизонтальным свайпом (или тапом по соседней карточке / точкам). */
function UniWheel({
  programs,
  savedSel,
  onToggleSave,
}: {
  programs: MatchedProgram[]
  savedSel: string[]
  onToggleSave: (pid: string, e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const reduced = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const justDragged = useRef(false)

  const go = (n: number) => setIdx(Math.max(0, Math.min(programs.length - 1, n)))
  const spring = reduced
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 230, damping: 28 } as const)

  return (
    // full-bleed до краёв вьюпорта + clip, чтобы боковые карточки не создавали
    // горизонтальный скролл страницы
    <div className="-mx-5 overflow-x-clip px-5 sm:-mx-6 sm:px-6 lg:hidden">
      <motion.div
        role="group"
        aria-roledescription="карусель"
        aria-label="Рекомендованные программы"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault()
            go(idx - 1)
          } else if (e.key === "ArrowRight") {
            e.preventDefault()
            go(idx + 1)
          }
        }}
        className="relative mt-6 h-[27rem] rounded-2xl outline-none [perspective:1100px] focus-visible:ring-2 focus-visible:ring-accent/60"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragMomentum={false}
        onDragStart={() => {
          justDragged.current = true
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -48 || info.velocity.x < -420) go(idx + 1)
          else if (info.offset.x > 48 || info.velocity.x > 420) go(idx - 1)
          // отпускаем флаг после того, как браузер диспатчит пост-drag click
          setTimeout(() => {
            justDragged.current = false
          }, 0)
        }}
      >
        {programs.map((p, i) => {
          const pid = p.id || "fb" + i
          const off = i - idx
          const dist = Math.abs(off)
          return (
            <motion.div
              key={pid}
              aria-hidden={off !== 0 || undefined}
              className="absolute inset-x-0 top-0 mx-auto h-[25rem] w-[min(76vw,300px)] [transform-style:preserve-3d]"
              animate={{
                x: `${off * 66}%`,
                y: dist * 14,
                rotateY: off * -32,
                scale: 1 - Math.min(dist, 2) * 0.12,
                opacity: dist > 2 ? 0 : dist === 2 ? 0.25 : dist === 1 ? 0.55 : 1,
              }}
              transition={spring}
              style={{ zIndex: 10 - dist, pointerEvents: dist > 2 ? "none" : "auto" }}
              onClick={() => {
                if (justDragged.current) return
                if (off !== 0) go(i)
              }}
            >
              <ResultCard
                p={p}
                on={savedSel.includes(pid)}
                interactive={off === 0}
                onToggleSave={(e) => {
                  if (justDragged.current) return
                  onToggleSave(pid, e)
                }}
              />
            </motion.div>
          )
        })}
      </motion.div>

      {/* объявление позиции для скринридеров */}
      <span aria-live="polite" className="sr-only">
        Программа {idx + 1} из {programs.length}: {programs[idx]?.university}
      </span>

      {/* индикатор позиции */}
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <div className="flex items-center">
          {programs.map((p, i) => (
            <button
              key={p.id || "fb" + i}
              type="button"
              aria-label={`Программа ${i + 1} из ${programs.length}`}
              aria-current={i === idx ? "true" : undefined}
              onClick={() => go(i)}
              className="grid size-6 cursor-pointer place-items-center outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300",
                  i === idx ? "w-5 bg-accent" : "w-1.5 bg-fg/15",
                )}
              />
            </button>
          ))}
        </div>
        <span className="text-xs text-fg-faint">Свайпай, чтобы листать</span>
      </div>
    </div>
  )
}

/* ---------- «Другое» expandable card (screens 2–3) ---------- */
function ExpandCard({
  selected,
  onToggle,
  value,
  onChange,
}: {
  selected: boolean
  onToggle: () => void
  value: string
  onChange: (v: string) => void
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border bg-card transition-colors duration-200 focus-within:ring-2 focus-within:ring-accent/60",
        selected ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3.5 p-4 text-left outline-none">
        <IconTile Icon={Pencil} />
        <span className="pr-6 text-[15px] font-medium">Другое</span>
      </button>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <Textarea
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Напиши своими словами..."
                className="min-h-20 rounded-xl bg-card"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SelectCheck on={selected} />
    </motion.div>
  )
}

/* ---------- language dropdown (screen 7) ---------- */
function LangDropdown({
  value,
  open,
  onToggle,
  onSelect,
}: {
  value: string | null
  open: boolean
  onToggle: () => void
  onSelect: (lang: string) => void
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-xl border bg-card-2 px-4 text-sm transition-colors",
          open ? "border-accent" : "border-border",
        )}
      >
        <span className={value ? "text-fg" : "text-fg-faint"}>{value ?? "Выбери язык"}</span>
        <ChevronDown className={cn("size-4 text-fg-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={onToggle} />
            <motion.div
              initial={{ opacity: 0, scaleY: 0.85 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.85 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="absolute inset-x-0 top-13 z-20 max-h-64 origin-top overflow-auto rounded-xl border border-border bg-card p-1.5 shadow-xl"
            >
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onSelect(l)}
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm transition-colors hover:bg-fg/5",
                    value === l && "font-semibold text-accent-text",
                  )}
                >
                  {l}
                  {value === l && <span className="size-2 rounded-full bg-accent" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
