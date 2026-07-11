import { Fragment, useEffect, useMemo, useState } from "react"
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  Heart,
  Loader2,
  Minus,
  RefreshCw,
  Star,
  Target,
} from "lucide-react"

import { ProgramLogo } from "@/components/ProgramLogo"
import { Accordion, AccordionItem } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UNI_CONTENT, type RichBlock, type UniSection } from "@/data/uniContent"
import { deadlineLabel } from "@/lib/roadmap"
import { readPersist } from "@/lib/persist"
import { essayForUni } from "@/pages/Essay"
import type { Achievement, AnyProgram, Grant, University } from "@/legacy"
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

/* ---------- grants relevant to a specific university (same scoring as legacy) ---------- */
/* named awards > same country > EU-wide > field match */
function grantsForUni(u: University): Grant[] {
  const uniWord = (u.name || "").split(/\s+/).find((w) => w.length > 4) || u.name
  const generic = /все|любые|200\+|программ/i
  return window.AdmiticaData.grants
    .map((g) => {
      let score = 0
      if (
        g.name.toLowerCase().includes(uniWord.toLowerCase()) ||
        (g.desc || "").toLowerCase().includes(uniWord.toLowerCase())
      )
        score += 5
      if (g.country === u.country) score += 3
      if (g.country === "ЕС") score += 2
      if (generic.test(g.field || "")) score += 1
      else if (u.field && (g.field || "").toLowerCase().includes(u.field.split(/[,\s]/)[0].toLowerCase()))
        score += 2
      if (u.degree && (g.degree || "").toLowerCase().includes(u.degree.split(/[\s/]/)[0].toLowerCase()))
        score += 1
      return { g, score }
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.g)
}

/* ---------- Uni-fit: AI two-way fit (how well the uni fits the student and the student fits the uni) ---------- */
interface OnbProfile {
  gpa?: string | null
  gpaUnknown?: boolean
  english?: string
  cert?: string
  certScore?: string
  budget?: string
  budgetUnknown?: boolean
  fields?: string[]
  countries?: string[]
  level?: string[]
  grant?: boolean
}
interface FitDim {
  score: number
  points: string[]
}
interface UniFitResult {
  uniToUser: FitDim
  userToUni: FitDim
  nextSteps: string[]
}

const clampScore = (v: unknown): number => {
  const n = Math.round(Number(v))
  return isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
}
// Normalise em-dashes the model may return to the app's en-dash style.
// Built from char codes (0x2014 -> 0x2013) so a literal-dash sweep can't break it.
const EM_DASH = String.fromCharCode(0x2014)
const EN_DASH = String.fromCharCode(0x2013)
const endash = (s: string): string => s.split(EM_DASH).join(EN_DASH)
const toPoints = (x: { points?: unknown; summary?: unknown }): string[] => {
  if (Array.isArray(x.points)) return x.points.map((p) => endash(String(p))).filter(Boolean).slice(0, 5)
  if (typeof x.summary === "string" && x.summary.trim()) return [endash(x.summary.trim())]
  return []
}

function buildUniFitPrompt(u: University, p: OnbProfile | null, essay: string, resume: Achievement[]): string {
  const prof = p || {}
  const resumeText = resume.length
    ? resume.map((a, i) => `${i + 1}. ${a.title} – ${a.org}. ${a.desc} [${(a.skills || []).join(", ")}]`).join("\n")
    : "(резюме пустое)"
  return `Ты консультант по поступлению в зарубежные вузы. Оцени взаимное соответствие («Uni-fit») студента и вуза и предложи следующие шаги. Верни ТОЛЬКО JSON без markdown:
{"uniToUser":{"score":0-100,"points":["краткий фактор 4-9 слов","ещё один"]},"userToUni":{"score":0-100,"points":["..."]},"nextSteps":["конкретный шаг со ссылкой на функцию Admitica"]}

ВУЗ: ${u.name}, ${u.city}, ${u.country}. Программа: ${u.program} (${u.degree}), направление: ${u.field}. Язык обучения: ${u.language}. Стоимость: ${u.tuition}. Требования: оценки ${u.gpa}, язык ${u.ielts}. Стипендии: ${u.scholarship ? "есть" : "нет"}.

АНКЕТА СТУДЕНТА: направления – ${(prof.fields || []).join(", ") || "не указаны"}; страны – ${(prof.countries || []).join(", ") || "не указаны"}; уровень – ${(prof.level || []).join(", ") || "не указан"}; бюджет – ${prof.budget || "не указан"}; средний балл – ${prof.gpaUnknown ? "не указан" : prof.gpa ? prof.gpa + " из 5 (российская шкала, 5 = отлично)" : "не указан"}; английский – ${prof.english || "не указан"}; сертификат – ${prof.cert ? prof.cert + (prof.certScore ? " " + prof.certScore : "") : "не указан"}; нужна стипендия – ${prof.grant ? "да" : "нет"}.

ЭССЕ ДЛЯ ЭТОЙ ПРОГРАММЫ: ${essay ? essay.slice(0, 1500) : "(не написано)"}

РЕЗЮМЕ СТУДЕНТА:
${resumeText}

ФУНКЦИИ ADMITICA (ссылайся на них в nextSteps):
- «Подобрать программу» – каталог вузов, грантов и стажировок с фильтрами.
- «Мои программы → Приоритеты» – дорожная карта (роадмап) поступления по этапам.
- «Редактор эссе» – черновики эссе под требования программы и проверка ИИ.
- «Сборка резюме» – резюме для европейских вузов и проверка ИИ.

Правила:
- ОЦЕНКИ: балл студента по 5-балльной шкале (5 = максимум ≈ 100%). Перед сравнением конвертируй в шкалу вуза: 5/5 ≈ 10/10 ≈ 100%, требование 8/10 = 80%, то есть 5/5 ВЫШЕ порога. Не сравнивай числа напрямую.
- uniToUser (насколько вуз подходит студенту): по совпадению направления, страны, уровня, бюджета, языка обучения и потребности в стипендии.
- userToUni (насколько студент подходит вузу): по среднему баллу, английскому, КАЧЕСТВУ эссе и силе резюме относительно конкурентности программы.
- points: по 2-3 КОРОТКИХ пункта строго по делу (до ~8 слов), суть + цифра где важна. Без воды и расплывчатых фраз.
- nextSteps: 2-4 конкретных шага под пробелы студента, обязательно со ссылкой на функции Admitica (например «Построй роадмап для этого вуза в Приоритетах», «Напиши эссе в Редакторе эссе под требования программы», «Добавь измеримые результаты в Резюме», «Подбери похожие вузы в Подборе»). Можно прямые и косвенные.
- Пиши по-русски, конкретно и по делу.`
}

/* small animated count-up for scores */
function CountUp({ to }: { to: number }) {
  const reduced = useReducedMotion()
  const [n, setN] = useState(reduced ? to : 0)
  useEffect(() => {
    if (reduced) {
      setN(to)
      return
    }
    const controls = animate(0, to, { duration: 0.8, ease: EASE, onUpdate: (v) => setN(Math.round(v)) })
    return () => controls.stop()
  }, [to, reduced])
  return <>{n}</>
}

/* collapsible, bright panel */
function Panel({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="h-fit gap-0 overflow-hidden border-accent/25 bg-accent-soft p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-4 text-left outline-none transition-colors hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <Icon className="size-4 shrink-0 text-accent-text" />
        <strong className="flex-1 text-sm font-semibold text-accent-text">{title}</strong>
        <ChevronDown
          className={cn("size-4 shrink-0 text-fg-muted transition-transform duration-300", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

/* one fit dimension: animated score + bar + bullet points */
function FitMeter({ label, dim, delay = 0 }: { label: string; dim: FitDim; delay?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-lg font-bold text-accent-text">
          <CountUp to={dim.score} />
          <span className="text-xs font-medium text-fg-muted">/100</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${dim.score}%` }}
          transition={{ duration: 0.8, ease: EASE, delay }}
        />
      </div>
      {dim.points.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {dim.points.map((p, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: EASE, delay: delay + 0.15 + i * 0.07 }}
              className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fg-muted"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-text" />
              <span>{p}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}

function UniFitPanel({
  uni,
  result,
  setResult,
}: {
  uni: University
  result: UniFitResult | null
  setResult: (r: UniFitResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const profile = useMemo(() => readPersist<OnbProfile | null>("onboardingProfile", null), [])
  const essay = useMemo(() => essayForUni(uni.id), [uni.id])
  const resume = useMemo(() => readPersist<Achievement[]>("achievements", []), [])
  const hasEssay = essay.length > 30
  const hasResume = resume.length > 0

  const run = async () => {
    if (loading) return
    if (!window.ai?.complete) {
      setError(true)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const reply = await window.ai.complete(buildUniFitPrompt(uni, profile, essay, resume), {
        temperature: 0.4,
        maxTokens: 700,
      })
      const obj = window.ai.extractJson(reply) as { uniToUser?: unknown; userToUni?: unknown; nextSteps?: unknown } | null
      const a = (obj?.uniToUser ?? {}) as { score?: unknown; points?: unknown; summary?: unknown }
      const b = (obj?.userToUni ?? {}) as { score?: unknown; points?: unknown; summary?: unknown }
      setResult({
        uniToUser: { score: clampScore(a.score), points: toPoints(a) },
        userToUni: { score: clampScore(b.score), points: toPoints(b) },
        nextSteps: Array.isArray(obj?.nextSteps)
          ? (obj?.nextSteps as unknown[]).map((d) => endash(String(d))).filter(Boolean).slice(0, 5)
          : [],
      })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel icon={Target} title="Uni-fit">
      {!result ? (
        <>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            ИИ оценит, насколько вуз подходит тебе и насколько ты подходишь вузу – по анкете, эссе и резюме.
          </p>
          {(!hasEssay || !hasResume) && (
            <p className="mt-2 text-xs leading-relaxed text-fg-faint">
              Оценка «ты вузу» зависит от {!hasEssay ? "эссе для этой программы" : ""}
              {!hasEssay && !hasResume ? " и " : ""}
              {!hasResume ? "резюме" : ""} – пока {!hasEssay && !hasResume ? "не заполнены" : "не заполнено"}.
            </p>
          )}
          <Button size="sm" className="mt-3.5 w-full" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Target />}
            {loading ? "Считаем…" : "Рассчитать Uni-fit"}
          </Button>
          {error && (
            <p className="mt-2 text-xs leading-relaxed text-danger">
              Не удалось рассчитать. Проверь подключение AI и попробуй ещё раз.
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-5">
          <FitMeter label="Вуз подходит тебе" dim={result.uniToUser} />
          <FitMeter label="Ты подходишь вузу" dim={result.userToUni} delay={0.1} />
          <Button variant="ghost" size="sm" className="w-full" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Пересчитать
          </Button>
        </div>
      )}
    </Panel>
  )
}

const ADVICE = [
  "Собери список: добавь 8–12 программ в «Подобрать программу».",
  "Построй роадмап по этапам в «Мои программы → Приоритеты».",
  "Готовь эссе под программу в «Редакторе эссе».",
  "Заполни «Резюме» и добавь измеримые результаты.",
]

function AdvicePanel({ fit }: { fit: UniFitResult | null }) {
  const tailored = Boolean(fit && fit.nextSteps.length)
  const items = tailored ? fit!.nextSteps : ADVICE
  return (
    <Panel icon={Calendar} title="С чего начать">
      {!tailored && (
        <p className="mb-2.5 text-xs leading-relaxed text-fg-faint">
          Рассчитай Uni-fit, и здесь появятся шаги под твой профиль. Пока общие:
        </p>
      )}
      <ul className="flex flex-col gap-2.5">
        {items.map((a, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: EASE, delay: 0.05 + i * 0.07 }}
            className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fg-muted"
          >
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-text" />
            <span>{a}</span>
          </motion.li>
        ))}
      </ul>
    </Panel>
  )
}

/* ---------- small pieces ---------- */
function DeadlineBadge({ days }: { days: number }) {
  const d = deadlineLabel(days)
  const variant =
    d.tone === "danger" ? "destructive" : d.tone === "warn" ? "warning" : d.tone === "info" ? "default" : "secondary"
  return (
    <Badge variant={variant}>
      <Calendar className="size-3" /> {d.txt}
    </Badge>
  )
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-xs font-semibold tracking-widest text-fg-muted uppercase", className)}>{children}</h2>
  )
}

/* ---------- full report block body (RichBlock nodes) ---------- */
const isUrl = (s: string) => /^https?:\/\//i.test(s.trim())

function Cell({ value }: { value: string }) {
  if (isUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 break-all text-accent-text hover:underline"
      >
        {value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        <ArrowUpRight className="size-3 shrink-0" />
      </a>
    )
  }
  return <>{value}</>
}

function RichBlockBody({ block }: { block: RichBlock }) {
  return (
    <div className="flex flex-col gap-3.5">
      {block.nodes.map((n, i) => {
        if (n.type === "sub")
          return (
            <h3 key={i} className="mt-1.5 text-sm font-semibold text-fg first:mt-0">
              {n.text}
            </h3>
          )
        if (n.type === "p" && n.ru)
          return (
            <div key={i} className="flex gap-2.5 rounded-xl border border-accent/30 bg-accent-soft p-3.5">
              <span className="shrink-0 text-base leading-none">🇷🇺</span>
              <p className="text-[13px] leading-relaxed text-fg-muted">
                <strong className="font-semibold text-accent-text">Для России: </strong>
                {n.text}
              </p>
            </div>
          )
        if (n.type === "p")
          return (
            <p key={i} className="text-sm leading-relaxed text-fg-muted">
              {n.text}
            </p>
          )
        if (n.type === "ul")
          return (
            <ul key={i} className="flex flex-col gap-2 text-sm leading-relaxed">
              {n.items.map((it, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-text" />
                  <span className="min-w-0 text-fg-muted">
                    <Cell value={it} />
                  </span>
                </li>
              ))}
            </ul>
          )
        // table – horizontal scroll on narrow screens
        return (
          <div key={i} className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  {n.headers.map((h, j) => (
                    <th key={j} className="px-2.5 py-2 font-semibold whitespace-nowrap text-fg">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {n.rows.map((row, r) => (
                  <tr key={r} className="border-b border-border last:border-0">
                    {row.map((c, j) => (
                      <td key={j} className="px-2.5 py-2 align-top leading-relaxed text-fg-muted">
                        <Cell value={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {block.sources.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs text-fg-faint">
          <span>{block.sources.length > 1 ? "Источники:" : "Источник:"}</span>
          {block.sources.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-accent-text hover:underline"
            >
              {block.sources.length > 1 ? `Источник ${i + 1}` : "Открыть"}
              <ArrowUpRight className="size-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- rich profile section body (uniContent) ---------- */
function SectionBody({ s }: { s: UniSection }) {
  return (
    <div className="flex flex-col gap-3">
      {s.body && <p className="text-sm leading-relaxed text-fg-muted">{s.body}</p>}
      {s.facts && s.facts.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          {s.facts.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-accent-text" />
              <span className="text-fg-muted">{f}</span>
            </li>
          ))}
        </ul>
      )}
      {(s.pros || s.cons) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {s.pros && (
            <div>
              <div className="mb-2 text-xs font-semibold tracking-widest text-positive uppercase">Плюсы</div>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                {s.pros.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                    <span className="text-fg-muted">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.cons && (
            <div>
              <div className="mb-2 text-xs font-semibold tracking-widest text-warning uppercase">Минусы</div>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                {s.cons.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <Minus className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span className="text-fg-muted">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {s.note && <p className="text-[13px] leading-relaxed text-fg-faint">{s.note}</p>}
      {s.ru && (
        <div className="flex gap-2.5 rounded-xl border border-accent/30 bg-accent-soft p-3.5">
          <span className="shrink-0 text-base leading-none">🇷🇺</span>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            <strong className="font-semibold text-accent-text">Для России: </strong>
            {s.ru}
          </p>
        </div>
      )}
    </div>
  )
}

function KvList({ rows }: { rows: { k: string; v: string }[] }) {
  return (
    <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
      {rows.map((r) =>
        r.v ? (
          <Fragment key={r.k}>
            <dt className="text-fg-muted">{r.k}</dt>
            <dd className="min-w-0 font-medium break-words">{r.v}</dd>
          </Fragment>
        ) : null,
      )}
    </dl>
  )
}

/* ---------- page ---------- */
export interface DetailProps {
  item: AnyProgram
  onBack: () => void
  saved: boolean
  prio: boolean
  toggleSave: (id: string) => void
  togglePrio: (id: string) => void
  addRoadmap: (item: AnyProgram) => void
  hasRoadmap: boolean
  openDetail: (item: AnyProgram) => void
}

export default function Detail({
  item,
  onBack,
  saved,
  prio,
  toggleSave,
  togglePrio,
  addRoadmap,
  hasRoadmap,
  openDetail,
}: DetailProps) {
  const it = item
  const uniGrants = "program" in it ? grantsForUni(it) : []
  const content = UNI_CONTENT[it.id]
  // Uni-fit result lives here so «С чего начать» can show the same AI recommendations.
  const [fit, setFit] = useState<UniFitResult | null>(null)
  useEffect(() => setFit(null), [it.id])

  // Full report blocks are code-split – load on demand for this uni.
  const [blocks, setBlocks] = useState<RichBlock[] | null>(null)
  useEffect(() => {
    let alive = true
    setBlocks(null)
    content?.loadBlocks?.().then((b) => {
      if (alive) setBlocks(b)
    })
    return () => {
      alive = false
    }
  }, [content])

  const reqs: { k: string; v: string }[] =
    "program" in it
      ? [
          { k: "Язык", v: it.language },
          { k: "IELTS / Lang", v: it.ielts },
          { k: "Оценки", v: it.gpa },
          { k: "Дедлайн", v: it.deadline },
        ]
      : "funding" in it
        ? [
            { k: "Кому", v: it.eligibility },
            { k: "Уровень", v: it.degree },
            { k: "Финансирование", v: it.funding },
            { k: "Дедлайн", v: it.deadline },
          ]
        : [
            { k: "Требования", v: it.requirements },
            { k: "Длительность", v: it.duration },
            { k: "Формат", v: it.format },
            { k: "Дедлайн", v: it.deadline },
          ]

  const facts: { k: string; v: string }[] =
    "program" in it
      ? [
          { k: "Город", v: `${it.city}, ${it.country}` },
          { k: "Программа", v: it.program },
          { k: "Степень", v: it.degree },
          { k: "Направление", v: it.field },
          { k: "Стоимость", v: it.tuition },
          { k: "Стипендии", v: it.scholarship ? "Доступны" : "–" },
        ]
      : "funding" in it
        ? [
            { k: "Страна", v: it.country },
            { k: "Организация", v: it.org },
            { k: "Размер", v: it.amount },
            { k: "Покрытие", v: it.funding },
            { k: "Уровень", v: it.degree },
            { k: "Направление", v: it.field },
          ]
        : [
            { k: "Город", v: it.city },
            { k: "Роль", v: it.role },
            { k: "Индустрия", v: it.industry },
            { k: "Стипендия", v: it.stipend },
            { k: "Длительность", v: it.duration },
            { k: "Формат", v: it.format },
          ]

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* back */}
      <motion.div variants={fadeUp} className="mb-5">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft /> Назад к подбору
        </Button>
      </motion.div>

      {/* head */}
      <motion.div variants={fadeUp} className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <ProgramLogo item={it} className="size-16 rounded-2xl text-2xl font-semibold sm:size-18" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{it.name}</h1>
            <DeadlineBadge days={it.deadlineDays} />
          </div>
          <div className="mt-1.5 text-sm text-fg-muted sm:text-base">
            {"program" in it ? it.program : "funding" in it ? `${it.org} · ${it.country}` : `${it.role} · ${it.industry}`}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => addRoadmap(it)} disabled={hasRoadmap}>
              {hasRoadmap ? (
                <>
                  <Check /> В дорожной карте
                </>
              ) : (
                <>
                  Создать дорожную карту <ArrowRight />
                </>
              )}
            </Button>
            <Button variant={saved ? "outline" : "ghost"} onClick={() => toggleSave(it.id)}>
              <Heart className={cn(saved && "fill-current")} /> {saved ? "Сохранено" : "Сохранить"}
            </Button>
            <Button
              variant={prio ? "outline" : "ghost"}
              onClick={() => togglePrio(it.id)}
              className={cn(prio && "border-warning/60 text-warning hover:text-warning")}
            >
              <Star className={cn(prio && "fill-current")} /> {prio ? "В приоритетах" : "Приоритет"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* quick-fact chips */}
      {content && (
        <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-2">
          {content.chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-border bg-card-2 px-3 py-1.5 text-xs font-medium text-fg-muted"
            >
              {c}
            </span>
          ))}
        </motion.div>
      )}

      {/* Uni-fit + «С чего начать» – up top, collapsible */}
      {"program" in it ? (
        <motion.div variants={fadeUp} className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <UniFitPanel uni={it} result={fit} setResult={setFit} />
          <AdvicePanel fit={fit} />
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="mt-6">
          <AdvicePanel fit={null} />
        </motion.div>
      )}

      {/* body grid */}
      <div className="mt-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* left column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <motion.div variants={fadeUp}>
            <Card className="gap-0 p-6 sm:p-7">
              <SectionHeading>О программе</SectionHeading>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{it.desc}</p>

              {"program" in it && !content && (
                <>
                  <SectionHeading className="mt-7">Что стоит знать</SectionHeading>
                  <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-fg-muted">
                    {[
                      "Обучение на английском, диплом признаётся в ЕС",
                      "Есть программы обмена и стажировки во время учёбы",
                      "Студенты из России поступают на общих основаниях",
                      "Стоимость и условия указаны в блоке требований ниже",
                    ].map((li) => (
                      <li key={li} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent-text" />
                        {li}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </motion.div>

          {/* full report blocks (code-split, lazy) */}
          {content?.loadBlocks && (
            <motion.div variants={fadeUp}>
              <SectionHeading className="mb-3 px-1">Полный профиль вуза</SectionHeading>
              {blocks ? (
                <Accordion>
                  {blocks.map((b, i) => (
                    <AccordionItem key={b.title} title={b.title} defaultOpen={i === 0}>
                      <RichBlockBody block={b} />
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="flex flex-col gap-3">
                  {[0, 1, 2].map((i) => (
                    <Card key={i} className="h-14 animate-pulse gap-0 p-0" />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* lighter editorial sections (fallback) */}
          {content?.sections && content.sections.length > 0 && (
            <motion.div variants={fadeUp}>
              <SectionHeading className="mb-3 px-1">Профиль вуза</SectionHeading>
              <Accordion>
                {content.sections.map((s, i) => (
                  <AccordionItem key={s.title} title={s.title} accent={s.accent} defaultOpen={i === 0}>
                    <SectionBody s={s} />
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          )}

          <motion.div variants={fadeUp}>
            <Card className="gap-0 p-6 sm:p-7">
              <SectionHeading>Требования к поступлению</SectionHeading>
              <KvList rows={reqs} />
            </Card>
          </motion.div>

          {/* FAQ (sections-based unis only; report blocks include their own FAQ) */}
          {content?.faq && content.faq.length > 0 && (
            <motion.div variants={fadeUp}>
              <SectionHeading className="mb-3 px-1">Частые вопросы</SectionHeading>
              <Accordion>
                {content.faq.map((f) => (
                  <AccordionItem key={f.q} title={f.q}>
                    <p className="text-sm leading-relaxed text-fg-muted">{f.a}</p>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          )}
        </div>

        {/* right column */}
        <div className="flex flex-col gap-4">
          <motion.div variants={fadeUp}>
            <Card className="gap-0 p-6">
              <SectionHeading>Ключевые факты</SectionHeading>
              <KvList rows={facts} />
            </Card>
          </motion.div>

          {uniGrants.length > 0 && (
            <motion.div variants={fadeUp}>
              <Card className="gap-0 p-4 pt-5">
                <SectionHeading className="px-2">Гранты по этому вузу</SectionHeading>
                <div className="mt-2 flex flex-col gap-1">
                  {uniGrants.map((g) => (
                    <motion.div
                      key={g.id}
                      whileHover={{ x: 3 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-fg/5"
                      onClick={() => openDetail(g)}
                    >
                      <ProgramLogo item={g} className="size-9 rounded-xl text-sm font-semibold" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{g.name}</div>
                        <div className="truncate text-xs text-fg-muted">{g.amount}</div>
                      </div>
                      <Badge
                        variant={/полное/i.test(g.funding) ? "default" : "secondary"}
                        className="max-w-28 shrink-0"
                      >
                        <span className="truncate">{g.funding}</span>
                      </Badge>
                      <ArrowUpRight className="size-4 shrink-0 text-fg-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {"site" in it && it.site && (
            <motion.div variants={fadeUp}>
              <Card className="gap-0 p-6">
                <SectionHeading>Официальный сайт</SectionHeading>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
                >
                  {it.site} <ArrowUpRight className="size-4" />
                </a>
              </Card>
            </motion.div>
          )}

        </div>
      </div>
    </motion.div>
  )
}
