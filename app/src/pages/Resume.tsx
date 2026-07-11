import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Check, Download, Plus, RefreshCw, Send, Sparkles, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { usePersist } from "@/lib/persist"
import type { Achievement } from "@/legacy"
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

/* ---------- data (same as legacy resume.jsx) ---------- */
const initialAchievements: Achievement[] = [
  {
    id: "a1",
    title: "Победа в международной олимпиаде по математике",
    org: "IMO Tashkent · 2023",
    skills: ["analytical", "math", "leadership"],
    desc: "Серебряная медаль в командном этапе. Выступал в составе сборной Узбекистана.",
  },
  {
    id: "a2",
    title: "Стажировка в EY Tashkent – Audit",
    org: "EY · Лето 2024 · 6 недель",
    skills: ["finance", "excel", "audit"],
    desc: "Подготовил 14 рабочих файлов для аудита банковского сектора. Прошёл внутренний тренинг IFRS.",
  },
]

/* ---------- local types (same persisted shapes as legacy) ---------- */
interface DraftAchievement {
  title: string
  org: string
  desc: string
  skills: string[]
}

interface ChatMsg {
  from: "ai" | "user"
  txt: string
  suggestion?: DraftAchievement
}

/** Editing draft – skills can be a comma string (form input) or an array (existing item). */
interface EditDraft {
  id?: string
  title: string
  org: string
  desc: string
  skills: string | string[]
}

interface SavedForm {
  id?: string
  title: string
  org: string
  desc: string
  skills: string[]
}

interface FeedbackItem {
  focus?: string
  txt?: string
}

/* ---------- achievement form (manual add / edit / tweak AI draft) ---------- */
function AchievementForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EditDraft | null
  onSave: (form: SavedForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<EditDraft>(initial || { title: "", org: "", desc: "", skills: "" })
  const skillsArr =
    typeof form.skills === "string"
      ? form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : form.skills

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show">
      <Card className="gap-0 border-accent/40 bg-accent-soft p-5">
        <div className="mb-4 flex items-center justify-between">
          <strong className="text-sm font-semibold">{initial?.id ? "Редактировать" : "Новое достижение"}</strong>
          <Button variant="ghost" size="icon-xs" onClick={onCancel} aria-label="Закрыть">
            <X />
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5">Название</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Например, Победа в олимпиаде по математике"
            />
          </div>
          <div>
            <Label className="mb-1.5">Организация и дата</Label>
            <Input
              value={form.org}
              onChange={(e) => setForm({ ...form, org: e.target.value })}
              placeholder="EY · Лето 2024"
            />
          </div>
          <div>
            <Label className="mb-1.5">Описание (1-2 предложения с метриками)</Label>
            <Textarea
              className="min-h-[70px]"
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder="Что вы сделали, какой был результат (число / %)"
            />
          </div>
          <div>
            <Label className="mb-1.5">Навыки (через запятую)</Label>
            <Input
              value={typeof form.skills === "string" ? form.skills : (form.skills || []).join(", ")}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="leadership, analytical, math"
            />
          </div>
          <div className="mt-1 flex gap-2">
            <Button disabled={!form.title.trim()} onClick={() => onSave({ ...form, skills: skillsArr })}>
              <Check /> Сохранить
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/* ---------- AI suggestion card inside the chat ---------- */
function SuggestionCard({
  suggestion,
  onAccept,
  onTweak,
}: {
  suggestion: DraftAchievement
  onAccept: () => void
  onTweak: () => void
}) {
  return (
    <Card className="gap-0 border-accent/40 bg-accent-soft p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="size-3.5 text-accent-text" />
        <strong className="text-[13px] font-semibold text-accent-text">Готовый пункт резюме</strong>
      </div>
      <div className="text-[15px] font-medium">{suggestion.title}</div>
      <div className="mt-1 text-[13px] text-fg-muted">{suggestion.org}</div>
      <div className="mt-2 text-[13px] leading-relaxed">{suggestion.desc}</div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {(suggestion.skills || []).map((s) => (
          <Badge key={s} variant="secondary">
            #{s}
          </Badge>
        ))}
      </div>
      <div className="mt-3.5 flex gap-2">
        <Button size="sm" onClick={onAccept}>
          <Plus /> Добавить в резюме
        </Button>
        <Button variant="ghost" size="sm" onClick={onTweak}>
          Изменить
        </Button>
      </div>
    </Card>
  )
}

/* ---------- typing indicator ---------- */
function TypingDots() {
  return (
    <div className="mr-auto flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-card-2 px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-fg-muted"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

/* ---------- page ---------- */
export default function Resume() {
  const [achievements, setAchievements] = usePersist<Achievement[]>("achievements", initialAchievements)
  const [msgs, setMsgs] = usePersist<ChatMsg[]>("chat_v2", [
    {
      from: "ai",
      txt: "Расскажите про одно достижение – олимпиада, стажировка, проект, лидерская роль. Задам пару уточнений и соберу из этого готовый пункт резюме.",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [turnCount, setTurnCount] = useState(0) // user replies in current achievement story
  const [draft, setDraft] = useState<DraftAchievement | null>(null) // suggested achievement awaiting approval
  const [editing, setEditing] = useState<EditDraft | null>(null) // null | achievement draft being edited
  const [improvingId, setImprovingId] = useState<string | null>(null) // id of achievement being AI-improved
  const [reviewerRole, setReviewerRole] = usePersist<string>(
    "cvReviewerRole",
    "Адмиссионный офицер европейского университета",
  )
  const [cvFeedback, setCvFeedback] = useState<FeedbackItem[] | null>(null)
  const [fbLoading, setFbLoading] = useState(false)
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Item-level AI rewrite: stronger verbs, metrics, admissions-CV style
  const improveWithAI = async (a: Achievement) => {
    if (improvingId) return
    setImprovingId(a.id)
    try {
      const reply = await window.ai.complete(
        `Ты эксперт по резюме для поступления в европейские университеты. Перепиши пункт CV сильнее: активные глаголы, конкретика, метрики (если их нет – аккуратно усили формулировку, не выдумывая ложных цифр). Верни ТОЛЬКО JSON: {"title":"...","org":"...","desc":"1-2 предложения","skills":["3-4 английских тега"]}.

Пункт:
Название: ${a.title}
Организация: ${a.org}
Описание: ${a.desc}
Навыки: ${(a.skills || []).join(", ")}`,
        { temperature: 0.5, maxTokens: 400 },
      )
      const obj = window.ai.extractJson(reply) as {
        title?: string
        org?: string
        desc?: string
        skills?: string[]
      } | null
      if (obj && obj.title) {
        // Functional update: the array may have changed while the request was in flight
        setAchievements((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, ...obj, title: obj.title!, skills: obj.skills || x.skills } : x)),
        )
        toast("Пункт улучшен с ИИ")
      } else {
        toast("Не удалось разобрать ответ ИИ")
      }
    } catch (e) {
      toast("Ошибка ИИ: " + (e instanceof Error ? e.message : ""))
    }
    setImprovingId(null)
  }

  // Whole-CV feedback from a configurable reviewer persona
  const requestCvFeedback = async () => {
    if (fbLoading) return
    if (!achievements.length) {
      toast("Сначала добавьте достижения")
      return
    }
    setFbLoading(true)
    setCvFeedback(null)
    try {
      const cv = achievements
        .map((a, i) => `${i + 1}. ${a.title} – ${a.org}. ${a.desc} [${(a.skills || []).join(", ")}]`)
        .join("\n")
      const reply = await window.ai.complete(
        `Ты выступаешь в роли: «${reviewerRole}». Оцени CV кандидата с позиции этой роли. Дай 3-4 замечания в JSON-массиве объектов {"focus":"короткий ярлык (1-3 слова)","txt":"конкретное замечание 1-2 предложения"}. Сначала сильные стороны (1), затем что улучшить (2-3). Только JSON, без markdown.

CV:
${cv}`,
        { temperature: 0.6, maxTokens: 700 },
      )
      const arr = window.ai.extractJson(reply)
      if (Array.isArray(arr) && arr.length) {
        setCvFeedback((arr as FeedbackItem[]).slice(0, 4))
      } else {
        toast("Не удалось разобрать ответ ИИ")
      }
    } catch (e) {
      toast("Ошибка ИИ: " + (e instanceof Error ? e.message : ""))
    }
    setFbLoading(false)
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs, typing, draft])

  const send = async () => {
    if (!input.trim() || typing) return
    const userMsg = input.trim()
    const newMsgs: ChatMsg[] = [...msgs, { from: "user", txt: userMsg }]
    setMsgs(newMsgs)
    setInput("")
    setTyping(true)
    const nextTurn = turnCount + 1
    setTurnCount(nextTurn)

    try {
      // After 2 user replies – generate suggestion. Otherwise – clarifying question.
      if (nextTurn >= 2) {
        const reply = await window.ai.complete(
          `Ты помогаешь собрать резюме для европейских университетов. На основе диалога оформи одно достижение в JSON: {"title":"короткое название","org":"организация и дата","desc":"1-2 предложения с метриками","skills":["3 английских тега"]}. Только JSON, без markdown.

Диалог:
${newMsgs.map((m) => `${m.from}: ${m.txt}`).join("\n")}`,
        )
        const m = reply.match(/\{[\s\S]*\}/)
        if (m) {
          const obj = JSON.parse(m[0]) as DraftAchievement
          setMsgs((prev) => [
            ...prev,
            {
              from: "ai",
              txt: "Собрал пункт резюме. Проверьте – можно добавить как есть или подправить:",
              suggestion: obj,
            },
          ])
          setDraft(obj)
          setTurnCount(0)
        } else {
          setMsgs((prev) => [
            ...prev,
            {
              from: "ai",
              txt: "Ещё один вопрос: какой был конкретный результат – число, процент, место?",
            },
          ])
        }
      } else {
        const reply = await window.ai.complete(
          `Ты помогаешь собрать резюме. Пользователь рассказал о достижении. Задай ОДИН короткий уточняющий вопрос (1-2 предложения), чтобы добавить конкретику – числа, метрики, роль. Не повторяйся, не благодари.

Сообщение: ${userMsg}`,
        )
        setMsgs((prev) => [...prev, { from: "ai", txt: reply.trim() }])
      }
    } catch {
      // Offline fallback
      const fallbacks = [
        "Какой был конкретный результат – число, процент, место?",
        "Какая была ваша личная роль и что вы делали в команде?",
      ]
      setMsgs((prev) => [...prev, { from: "ai", txt: fallbacks[Math.min(nextTurn - 1, fallbacks.length - 1)] }])
    }
    setTyping(false)
  }

  const acceptDraft = (d: DraftAchievement) => {
    setAchievements([...achievements, { id: "a" + Date.now(), ...d }])
    setDraft(null)
    setMsgs((m) => [
      ...m,
      {
        from: "ai",
        txt: "Добавил в резюме. Расскажите о следующем достижении или нажмите «Сбросить», чтобы начать заново.",
      },
    ])
    toast("Достижение добавлено")
  }

  const resetChat = () => {
    setMsgs([
      {
        from: "ai",
        txt: "Начнём заново. Расскажите про любое достижение – академическое, профессиональное или общественное.",
      },
    ])
    setTurnCount(0)
    setDraft(null)
  }

  const saveManual = (form: SavedForm) => {
    if (editing && editing.id) {
      setAchievements(achievements.map((a) => (a.id === editing.id ? { ...a, ...form, id: a.id } : a)))
      toast("Изменения сохранены")
    } else {
      setAchievements([
        ...achievements,
        { id: "a" + Date.now(), title: form.title, org: form.org, desc: form.desc, skills: form.skills },
      ])
      toast("Достижение добавлено")
    }
    setEditing(null)
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* page head */}
      <motion.div variants={fadeUp} className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Сборка резюме</h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted sm:text-base">
            Расскажите о достижениях – соберём из них пункты резюме для европейских университетов
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => window.downloadResumeDocx(window.getUserName(), achievements)}>
            <Download /> DOCX
          </Button>
          <Button variant="ghost" onClick={() => window.downloadResumePdf(window.getUserName(), achievements)}>
            <Download /> PDF
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ---- AI chat assistant ---- */}
        <motion.div variants={fadeUp}>
          <Card className="flex h-[min(600px,72vh)] flex-col gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <strong className="text-sm font-semibold">Помощник по резюме</strong>
                {/* без truncate: на узком экране подпись переносится, а не обрезается */}
                <div className="mt-0.5 text-xs text-fg-muted">Расскажите про достижение – соберём из него пункт резюме</div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={resetChat}>
                <RefreshCw /> Сбросить
              </Button>
            </div>

            <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4 sm:p-5">
              {msgs.map((m, i) => (
                <div key={i} className="flex flex-col gap-2.5">
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      m.from === "user"
                        ? "ml-auto rounded-br-md bg-accent font-semibold text-accent-fg"
                        : "mr-auto rounded-bl-md bg-card-2 text-fg",
                    )}
                  >
                    {m.txt}
                  </div>
                  {m.suggestion && (
                    <SuggestionCard
                      suggestion={m.suggestion}
                      onAccept={() => acceptDraft(m.suggestion!)}
                      onTweak={() => setEditing({ ...m.suggestion! })}
                    />
                  )}
                </div>
              ))}
              {typing && <TypingDots />}
            </div>

            <div className="flex gap-2 border-t border-border p-3.5">
              <Input
                className="flex-1"
                placeholder={typing ? "Печатает…" : "Расскажите о достижении…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={typing}
              />
              <Button size="icon" onClick={send} disabled={!input.trim() || typing} aria-label="Отправить">
                <Send />
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* ---- right column: feedback, achievements, tips ---- */}
        <motion.div variants={fadeUp} className="flex flex-col gap-4">
          {/* whole-CV feedback */}
          <Card className="gap-0 border-accent/40 bg-accent-soft p-5">
            <div className="mb-2.5 flex items-center gap-2">
              <Sparkles className="size-3.5 text-accent-text" />
              <strong className="text-[13px] font-semibold text-accent-text">Разбор всего резюме</strong>
            </div>
            <Label className="mb-1.5">Роль проверяющего</Label>
            <div className="flex items-stretch gap-2">
              <Input
                className="min-w-0 flex-1"
                value={reviewerRole}
                onChange={(e) => setReviewerRole(e.target.value)}
                placeholder="Например: адмиссионный офицер LSE, HR из консалтинга…"
              />
              <Button size="sm" className="h-9 shrink-0" onClick={requestCvFeedback} disabled={fbLoading}>
                <Sparkles /> {fbLoading ? "Оцениваю…" : "Оценить"}
              </Button>
            </div>
            {cvFeedback && (
              <div className="mt-3 flex flex-col gap-2">
                {cvFeedback.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: EASE, delay: i * 0.06 }}
                    className="flex items-start gap-2 text-[13px] leading-relaxed text-fg"
                  >
                    <Badge className="mt-0.5 shrink-0">{f.focus}</Badge>
                    <span>{f.txt}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* achievements header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm font-semibold">Ваши достижения</strong>
            <div className="flex items-center gap-2">
              <Badge>{achievements.length} в резюме</Badge>
              <Button size="sm" onClick={() => setEditing({ title: "", org: "", desc: "", skills: "" })}>
                <Plus /> Добавить
              </Button>
            </div>
          </div>

          {editing && <AchievementForm initial={editing} onSave={saveManual} onCancel={() => setEditing(null)} />}

          {/* achievements list */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-3">
            {achievements.length === 0 && !editing && (
              <Card className="p-10 text-center text-sm text-fg-muted">
                Пока пусто. Расскажите о достижении в чате слева или добавьте вручную.
              </Card>
            )}
            {achievements.map((a) => (
              <motion.div key={a.id} variants={fadeUp} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: EASE }}>
                <Card className="gap-0 p-5">
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="mt-1 text-xs text-fg-muted">{a.org}</div>
                  <div className="mt-2 text-[13px] leading-relaxed text-fg-muted">{a.desc}</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(a.skills || []).map((s) => (
                      <Badge key={s} variant="secondary">
                        #{s}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-accent-text transition-colors duration-200 hover:underline disabled:pointer-events-none disabled:opacity-50"
                      onClick={() => improveWithAI(a)}
                      disabled={improvingId === a.id}
                    >
                      <Sparkles className="size-3" /> {improvingId === a.id ? "Обрабатываю…" : "Улучшить с ИИ"}
                    </button>
                    <span className="text-fg-faint">·</span>
                    <button
                      className="rounded-md text-xs font-medium text-fg-muted transition-colors duration-200 hover:text-fg"
                      onClick={() => setEditing({ ...a })}
                    >
                      Изменить
                    </button>
                    <span className="text-fg-faint">·</span>
                    <button
                      className="rounded-md text-xs font-medium text-fg-muted transition-colors duration-200 hover:text-danger"
                      onClick={() => setAchievements(achievements.filter((x) => x.id !== a.id))}
                    >
                      Удалить
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* what would strengthen the CV */}
          <Card className="gap-0 border-accent/25 bg-accent-soft p-5">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-3.5 text-accent-text" />
              <strong className="text-[13px] font-semibold text-accent-text">Что усилит резюме</strong>
            </div>
            <ul className="m-0 list-disc pl-4.5 text-[13px] leading-relaxed text-fg-muted">
              <li>Стажировка в финансах или консалтинге</li>
              <li>Лидерская роль в студенческой организации</li>
              <li>Количественный результат в каждом пункте</li>
            </ul>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
