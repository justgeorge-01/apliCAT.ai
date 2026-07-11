// Essay editor: «Мои эссе» (стартовые задания) + «Банк эссе» (вузы из приоритетов)
// Requirements per university/program come from window.getEssayRequirements (src/essayReqs.js)
import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Bold, Download, Italic, List, Loader2, Sparkles, Star } from "lucide-react"

import { DeadlineBadge } from "@/components/ProgramCard"
import { ProgramLogo } from "@/components/ProgramLogo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Segmented } from "@/components/ui/segmented"
import { useToast } from "@/components/ui/toast"
import { readPersist, usePersist } from "@/lib/persist"
import { cn } from "@/lib/utils"
import type { EssayRequirements, University } from "@/legacy"

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

/* ---------- content (same as legacy essay.jsx) ---------- */
interface EssayPrompt {
  id: string
  uniId: string
  target: string
}

const ESSAY_PROMPTS: EssayPrompt[] = [
  { id: "ps_bocconi", uniId: "u1", target: "Bocconi · Personal Statement" },
  { id: "sop_lse", uniId: "u2", target: "LSE · Statement of Purpose" },
  { id: "mot_hec", uniId: "u3", target: "HEC · Motivation Letter" },
]

const SAMPLE_ESSAY = `My fascination with economics did not start in a lecture hall. It began on a Saturday afternoon in my mother's small bakery in Tashkent, watching her decide whether to raise the price of a loaf by twenty cents. I was eleven, and I already understood that this number could feed my brother for a week – or send our regular customer back home empty-handed. That moment planted a question I have been chasing ever since: how do markets, so abstract on paper, translate into the everyday choices of real families?

At Lyceum №1, I built my schedule around this question. I won the regional Olympiad in Mathematics, took two extracurricular courses in microeconomics through a partnership with HSE, and led a research project on inflation expectations among small business owners in our city. I learned that good economics requires not just elegant equations but also the humility to listen to the people behind the data.`

const essayUniById = (id: string): University | undefined =>
  window.AdmiticaData.universities.find((u) => u.id === id)

// Build initial drafts map: migrate legacy per-key storage, default Bocconi to sample.
const initialDrafts = (): Record<string, string> => {
  const map: Record<string, string> = {}
  ESSAY_PROMPTS.forEach((p) => {
    let saved: string | null = null
    try {
      const s = localStorage.getItem("admitica.essay_" + p.id)
      if (s != null) saved = JSON.parse(s) as string
    } catch {
      /* corrupted draft – ignore */
    }
    const isBocconi = p.id === ESSAY_PROMPTS[0].id
    if (saved != null && !(isBocconi && !String(saved).trim())) map[p.id] = saved
    else if (isBocconi) map[p.id] = SAMPLE_ESSAY
    else map[p.id] = ""
  })
  return map
}

/** Best essay the student wrote for a university: checks the Bank key ("uni_<id>")
 *  and any starter prompt that targets this uni. Returns the longest non-empty draft. */
export function essayForUni(uniId: string): string {
  const drafts = readPersist<Record<string, string>>("essayDrafts", {})
  const keys = ["uni_" + uniId, ...ESSAY_PROMPTS.filter((p) => p.uniId === uniId).map((p) => p.id)]
  let best = ""
  for (const k of keys) {
    const t = (drafts[k] || "").trim()
    if (t.length > best.length) best = t
  }
  return best
}

const getReqs = (u: University | null | undefined): EssayRequirements | null =>
  u && typeof window.getEssayRequirements === "function" ? window.getEssayRequirements(u) : null

interface FeedbackItem {
  type: string
  txt: string
}

const INITIAL_FEEDBACK: FeedbackItem[] = [
  {
    type: "flow",
    txt: "Сильное открывающее предложение с конкретной сценой. Это заметно выделяет вас среди абстрактных вступлений.",
  },
  {
    type: "concrete",
    txt: "Хороший переход от личной истории к академической мотивации. Можно усилить, добавив конкретный результат олимпиады (например, «вошёл в топ-5%»).",
  },
  {
    type: "gap",
    txt: "Не хватает связки с программой Bocconi. Какие конкретные курсы или преподаватели вас интересуют? Это покажет fit с программой.",
  },
]

/* ---------- small pieces (DeadlineBadge – общий, @/components/ProgramCard) ---------- */
function UniTile({ uni }: { uni: University }) {
  return (
    <ProgramLogo item={uni} className="size-10 rounded-xl text-base font-semibold" />
  )
}

/* Requirements panel: the task itself + what this exact university expects */
function EssayReqsPanel({ uni }: { uni: University | null }) {
  const req = getReqs(uni)
  if (!uni || !req) return null
  return (
    <Card className="p-5 sm:p-6">
      <div>
        <div className="text-xs font-semibold tracking-widest text-fg-muted uppercase">
          Задача · {req.type} · до {req.wordLimit} слов
        </div>
        <p className="mt-2 text-sm leading-relaxed">{req.prompt}</p>
        <div className="mt-4 mb-1.5 text-xs font-semibold tracking-widest text-fg-muted uppercase">
          Требования {uni.name}
        </div>
        <ul className="list-disc pl-4 text-[13px] leading-relaxed">
          {req.requirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {req.tips && req.tips.length > 0 && (
          <>
            <div className="mt-4 mb-1.5 text-xs font-semibold tracking-widest text-fg-muted uppercase">
              Советы
            </div>
            <ul className="list-disc pl-4 text-[13px] leading-relaxed text-fg-muted">
              {req.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  )
}

/* ---------- page ---------- */
export interface EssayProps {
  priorities: string[]
}

export default function Essay({ priorities }: EssayProps) {
  const [mode, setMode] = useState<"mine" | "bank">("mine")
  const [activePromptId, setActivePromptId] = useState(ESSAY_PROMPTS[0].id)
  const [bankUniId, setBankUniId] = useState<string | null>(null)
  const [drafts, setDrafts] = usePersist<Record<string, string>>("essayDrafts", initialDrafts())
  const [feedback, setFeedback] = useState<FeedbackItem[]>(INITIAL_FEEDBACK)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  // Active context: either a starter prompt or a bank university
  const activePrompt = ESSAY_PROMPTS.find((p) => p.id === activePromptId) ?? ESSAY_PROMPTS[0]
  const bankUni = bankUniId ? (essayUniById(bankUniId) ?? null) : null
  const editing = mode === "bank" ? bankUni : null
  const draftKey = editing ? "uni_" + editing.id : activePromptId
  const ctxUni = editing ?? essayUniById(activePrompt.uniId) ?? null
  const req = getReqs(ctxUni)

  const text = drafts[draftKey] ?? ""
  const setText = (val: string) => setDrafts((d) => ({ ...d, [draftKey]: val }))
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const target = req ? req.wordLimit : 1000
  const exportTitle = editing ? `${editing.name} – ${req ? req.type : "Essay"}` : activePrompt.target

  // Priority universities for the bank
  const bankUnis = priorities.map(essayUniById).filter((u): u is University => Boolean(u))

  const askAI = async () => {
    setLoading(true)
    try {
      const taskText =
        req && ctxUni ? `${req.type} для ${ctxUni.name} (${ctxUni.program}). ${req.prompt}` : "Admissions essay."
      const reply = await window.ai.complete(
        `Ты редактор admissions essays. Дай 3 коротких практических замечания (по 1-2 предложения) к этому тексту с учётом требований конкретного вуза, в JSON-массиве с ключами "type" (flow/concrete/gap/grammar/fit) и "txt". Без markdown, только JSON.

Задание: ${taskText}

Текст:
${text}`,
      )
      const arr = window.ai.extractJson(reply)
      // Normalize: the model may return plain strings or differently-keyed objects
      const items: FeedbackItem[] = (Array.isArray(arr) ? arr : [])
        .map((f): FeedbackItem | null => {
          if (typeof f === "string") return { type: "flow", txt: f }
          if (f && typeof f === "object" && typeof (f as { txt?: unknown }).txt === "string") {
            return { type: String((f as { type?: unknown }).type ?? "flow"), txt: (f as { txt: string }).txt }
          }
          return null
        })
        .filter((f): f is FeedbackItem => Boolean(f))
      if (items.length) {
        setFeedback(items.slice(0, 4))
        toast("Замечания обновлены")
      } else {
        toast("Не удалось разобрать ответ")
      }
    } catch (e) {
      toast("Не удалось проверить эссе: " + (e instanceof Error ? e.message : ""))
    } finally {
      setLoading(false)
    }
  }

  const showBankList = mode === "bank" && !editing

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* head */}
      <motion.div variants={fadeUp} className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Редактор эссе</h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted">
            Пишите эссе, запрашивайте замечания по структуре, конкретике и грамматике. Черновики сохраняются автоматически.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => window.downloadEssayDocx(exportTitle, text)}>
            <Download /> DOCX
          </Button>
          <Button variant="ghost" onClick={() => window.downloadEssayPdf(exportTitle, text)}>
            <Download /> PDF
          </Button>
          <Button onClick={askAI} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Проверяем…" : "Проверить эссе"}
          </Button>
        </div>
      </motion.div>

      {/* subtabs */}
      <motion.div variants={fadeUp} className="mb-6">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: "mine", label: "Мои эссе" },
            { id: "bank", label: "Банк эссе" },
          ]}
        />
      </motion.div>

      <motion.div
        key={showBankList ? "bank" : "editor"}
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        {showBankList ? (
          bankUnis.length === 0 ? (
            <Card className="p-10 text-center sm:p-14">
              <div>
                <Star className="mx-auto size-9 text-fg-faint" />
                <h2 className="mt-4 text-lg font-semibold">В приоритетах пока нет вузов</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
                  Добавьте университеты в приоритеты. Для каждого здесь появится эссе с требованиями программы.
                </p>
              </div>
            </Card>
          ) : (
            <>
              <div className="mb-4 text-[13px] text-fg-muted">
                Эссе под каждый вуз из ваших приоритетов, с требованиями конкретной программы.
              </div>
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {bankUnis.map((u) => {
                  const dk = "uni_" + u.id
                  const wc = (drafts[dk] || "").trim().split(/\s+/).filter(Boolean).length
                  const lim = getReqs(u)?.wordLimit ?? 1000
                  return (
                    <motion.div key={u.id} variants={fadeUp} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: EASE }}>
                      <Card
                        className="h-full cursor-pointer p-5"
                        role="button"
                        tabIndex={0}
                        onClick={() => setBankUniId(u.id)}
                        onKeyDown={(e) => e.key === "Enter" && setBankUniId(u.id)}
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <UniTile uni={u} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{u.name}</div>
                              <div className="truncate text-xs text-fg-muted">{u.program}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-xs text-fg-muted">
                              {wc} / {lim} слов
                            </span>
                            <DeadlineBadge days={u.deadlineDays} />
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/8">
                            <motion.div
                              className="h-full rounded-full bg-accent"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (wc / lim) * 100)}%` }}
                              transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
                            />
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            </>
          )
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* left: prompt picker / bank uni + requirements */}
            <div className="space-y-4">
              {editing ? (
                <Card className="p-5">
                  <div>
                    <Button variant="link" size="xs" className="mb-3 px-0" onClick={() => setBankUniId(null)}>
                      <ArrowLeft /> Все вузы банка
                    </Button>
                    <div className="flex items-center gap-3">
                      <UniTile uni={editing} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{editing.name}</div>
                        <div className="truncate text-xs text-fg-muted">
                          {editing.program} · дедлайн {editing.deadline}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-5">
                  <div>
                    <h2 className="text-sm font-semibold">Эссе</h2>
                    <div className="mt-3 flex flex-col gap-2">
                      {ESSAY_PROMPTS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setActivePromptId(p.id)}
                          className={cn(
                            "rounded-xl border p-3 text-left transition-colors duration-200",
                            activePromptId === p.id
                              ? "border-accent bg-accent-soft"
                              : "border-border hover:bg-fg/5",
                          )}
                        >
                          <div className="text-[13px] font-medium">{p.target}</div>
                          <div className="mt-0.5 text-xs text-fg-muted">
                            {p.id === activePromptId ? `${wordCount} / ${target} слов` : "Черновик"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              <EssayReqsPanel uni={ctxUni} />
            </div>

            {/* right: editor + AI feedback */}
            <div className="min-w-0">
              <Card className="overflow-hidden p-0">
                <div>
                  <div className="flex items-center gap-1 border-b border-border px-2.5 py-2">
                    <Button variant="ghost" size="icon-sm" type="button" aria-label="Полужирный">
                      <Bold />
                    </Button>
                    <Button variant="ghost" size="icon-sm" type="button" aria-label="Курсив">
                      <Italic />
                    </Button>
                    <Button variant="ghost" size="icon-sm" type="button" aria-label="Список">
                      <List />
                    </Button>
                    <span className="ml-auto px-2 text-xs whitespace-nowrap text-fg-muted">
                      {wordCount} / {target} слов
                    </span>
                  </div>
                  <textarea
                    className="block min-h-[50vh] w-full resize-y bg-transparent px-4 py-4 text-sm leading-relaxed text-fg outline-none placeholder:text-fg-faint sm:min-h-[420px] sm:px-6"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Начните печатать ваше эссе..."
                    aria-label="Текст эссе"
                  />
                  <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-fg-muted">
                    <span className="shrink-0">Сохранено автоматически</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/8">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                        style={{ width: Math.min(100, (wordCount / target) * 100) + "%" }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="mt-4 p-5 sm:p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-accent-text" />
                    <strong className="text-[13px] font-semibold text-accent-text">AI-замечания</strong>
                  </div>
                  <div className="mt-4 space-y-3">
                    {feedback.map((f, i) => (
                      <motion.div
                        key={i + ":" + f.txt.slice(0, 24)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: EASE, delay: i * 0.05 }}
                        className="rounded-xl border border-border bg-card-2 p-3 text-[13px] leading-relaxed"
                      >
                        <Badge className="mr-2 align-middle">{f.type}</Badge>
                        {f.txt}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
