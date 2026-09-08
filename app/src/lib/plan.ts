/**
 * «Мой план» (spec §3.4) – pure functions over the plan stored in
 * `localStorage["admitica.cn.plan"]`, the deadline feed and the document
 * checklist. Screens import these; nothing here touches the DOM except
 * `loadPlan` / `savePlan`.
 *
 * All plan updaters return a NEW plan (never mutate), so they compose with
 * React state setters: `setPlan(p => setStatus(p, id, "applied"))`.
 */
import type { Catalog, Fact, FactKey, University } from "@/data/china.types"
import {
  cscaStatus,
  daysUntil,
  deadlineDateOf,
  factOf,
  factsOf,
  findUniversity,
  formatCheckedAt,
  isCriticalKey,
  isoDate,
} from "@/data/china"
import { readPersist } from "./persist"

/* ---------- types ---------- */

export type PlanStatus = "considering" | "preparing" | "applied" | "answered"

export const PLAN_STATUSES: readonly PlanStatus[] = ["considering", "preparing", "applied", "answered"]

export const PLAN_STATUS_LABELS_RU: Record<PlanStatus, string> = {
  considering: "Рассматриваю",
  preparing: "Готовлю документы",
  applied: "Подал заявку",
  answered: "Есть ответ",
}

export interface PlanEntry {
  /** University id from the catalog. */
  id: string
  status: PlanStatus
  /** docId (see `docChecklist`) → done. */
  docs: Record<string, boolean>
  /** The student's own note on this university (cabinet, spec §1 `plan_items.note`). */
  note?: string
}

export interface Plan {
  universities: PlanEntry[]
}

/** persist.ts prefixes keys with `admitica.` → the storage key is `admitica.cn.plan`. */
export const PLAN_KEY = "cn.plan"
export const PLAN_STORAGE_KEY = "admitica." + PLAN_KEY

export function emptyPlan(): Plan {
  return { universities: [] }
}

/* ---------- storage ---------- */

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x)

/** `plan_items.note` is capped at 2000 characters in the database. */
export const NOTE_MAX = 2000

function normalizeEntry(raw: unknown): PlanEntry | null {
  if (!isRec(raw) || typeof raw.id !== "string" || !raw.id.trim()) return null
  const status = (PLAN_STATUSES as readonly string[]).includes(raw.status as string)
    ? (raw.status as PlanStatus)
    : "considering"
  const docs: Record<string, boolean> = {}
  if (isRec(raw.docs)) {
    for (const [k, v] of Object.entries(raw.docs)) if (typeof v === "boolean") docs[k] = v
  }
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.slice(0, NOTE_MAX) : undefined
  return note === undefined ? { id: raw.id, status, docs } : { id: raw.id, status, docs, note }
}

/** Validate an untrusted plan object (storage, import). Null when it is not a plan. */
export function normalizePlan(raw: unknown): Plan | null {
  if (!isRec(raw) || !Array.isArray(raw.universities)) return null
  const seen = new Set<string>()
  const universities: PlanEntry[] = []
  for (const e of raw.universities) {
    const entry = normalizeEntry(e)
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id)
      universities.push(entry)
    }
  }
  return { universities }
}

export function loadPlan(): Plan {
  return normalizePlan(readPersist<unknown>(PLAN_KEY, null)) ?? emptyPlan()
}

export function savePlan(plan: Plan): void {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
  } catch {
    /* quota / private mode */
  }
}

/* ---------- updaters (pure) ---------- */

export function planEntry(plan: Plan, id: string): PlanEntry | undefined {
  return plan.universities.find((e) => e.id === id)
}

export function isInPlan(plan: Plan, id: string): boolean {
  return plan.universities.some((e) => e.id === id)
}

export function addToPlan(plan: Plan, id: string): Plan {
  if (isInPlan(plan, id)) return plan
  return { universities: [...plan.universities, { id, status: "considering", docs: {} }] }
}

export function removeFromPlan(plan: Plan, id: string): Plan {
  if (!isInPlan(plan, id)) return plan
  return { universities: plan.universities.filter((e) => e.id !== id) }
}

export function togglePlan(plan: Plan, id: string): Plan {
  return isInPlan(plan, id) ? removeFromPlan(plan, id) : addToPlan(plan, id)
}

/** Applies `fn` to one entry; returns the SAME plan object when nothing changed. */
function updateEntry(plan: Plan, id: string, fn: (e: PlanEntry) => PlanEntry): Plan {
  let changed = false
  const universities = plan.universities.map((e) => {
    if (e.id !== id) return e
    const next = fn(e)
    if (next !== e) changed = true
    return next
  })
  return changed ? { universities } : plan
}

export function setStatus(plan: Plan, id: string, status: PlanStatus): Plan {
  return updateEntry(plan, id, (e) => (e.status === status ? e : { ...e, status }))
}

export function setDoc(plan: Plan, id: string, docId: string, done: boolean): Plan {
  return updateEntry(plan, id, (e) =>
    e.docs[docId] === done ? e : { ...e, docs: { ...e.docs, [docId]: done } },
  )
}

/** Sets the student's note; an empty note removes the field. */
export function setNote(plan: Plan, id: string, note: string): Plan {
  const clean = note.trim().slice(0, NOTE_MAX)
  return updateEntry(plan, id, (e) => {
    if ((e.note ?? "") === clean) return e
    if (!clean) {
      const { note: _drop, ...rest } = e
      void _drop
      return rest
    }
    return { ...e, note: clean }
  })
}

/* ---------- documents ---------- */

export interface DocItem {
  /** Stable key for `PlanEntry.docs`. */
  id: string
  label: string
  /** `base` – our generic list; `university` – from the export's `docs.required_list`. */
  origin: "base" | "university"
  source_url?: string
  verified_at?: string
}

/**
 * Base checklist + the university's own `docs.required_list` (with its
 * provenance) when the export has one. CSCA report appears only when the
 * university requires CSCA or has not stated it.
 */
export function docChecklist(u: University): DocItem[] {
  const hsk = factOf(u, "requirements.hsk_min")
  const ielts = factOf(u, "requirements.ielts_min")
  const langLabel =
    hsk && !ielts ? "Сертификат HSK" : ielts && !hsk ? "Сертификат IELTS" : "Сертификат HSK или IELTS"

  const base: DocItem[] = [
    { id: "passport", label: "Загранпаспорт (копия)", origin: "base" },
    { id: "transcript", label: "Аттестат или транскрипт с нотариальным переводом", origin: "base" },
    { id: "language", label: langLabel, origin: "base" },
  ]
  const csca = cscaStatus(u)
  if (csca === "required") base.push({ id: "csca", label: "Отчёт о результатах CSCA", origin: "base" })
  else if (csca === "unknown")
    base.push({ id: "csca", label: "Отчёт о результатах CSCA (вуз не заявил, уточните)", origin: "base" })
  base.push(
    { id: "motivation", label: "Мотивационное письмо", origin: "base" },
    { id: "recommendations", label: "Рекомендательные письма", origin: "base" },
    { id: "medical", label: "Медицинская справка", origin: "base" },
    { id: "photo", label: "Фотографии", origin: "base" },
  )

  const fromUni: DocItem[] = []
  for (const f of factsOf(u, "docs.required_list")) {
    const items = "items" in f.value && Array.isArray(f.value.items) ? f.value.items : []
    items.forEach((label, i) => {
      if (typeof label === "string" && label.trim())
        fromUni.push({
          id: `uni:${i}`,
          label,
          origin: "university",
          source_url: f.source_url,
          verified_at: f.verified_at,
        })
    })
  }
  return [...base, ...fromUni]
}

export interface DocProgress {
  done: number
  total: number
  /** 0–100, rounded. */
  pct: number
}

export function docProgress(entry: PlanEntry | undefined, u: University): DocProgress {
  const list = docChecklist(u)
  const done = entry ? list.filter((d) => entry.docs[d.id]).length : 0
  const total = list.length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/* ---------- fixed (common) dates ---------- */

export type DatePrecision = "day" | "month"

export interface FixedDate {
  id: string
  label: string
  /** ISO date; for `precision: "month"` the first day of that month. */
  date: string
  precision: DatePrecision
  /** Ready-to-print text, e.g. «декабрь 2026». Printed as is. */
  display: string
  /** Shown next to the item: where the date comes from and when the text was checked. */
  note: string
  source_url: string
  verified_at: string
}

const CSCA_NOTE = "общие даты, по csca.cn; текст проверен 31.08.2026, точный день сверьте на сайте"
const CSC_NOTE = "общие даты, по CSC (campuschina.org); ориентировочно, текст проверен 31.08.2026"

/**
 * Common dates of the 2026 cycle (spec §3.4): CSCA sessions (month precision –
 * the exact days are NOT published here, the reader checks csca.cn) and the
 * approximate Chinese Government Scholarship (CSC) window.
 */
export const FIXED_DATES: readonly FixedDate[] = [
  ...(
    [
      ["2026-01", "январь 2026"],
      ["2026-03", "март 2026"],
      ["2026-04", "апрель 2026"],
      ["2026-06", "июнь 2026"],
      ["2026-12", "декабрь 2026"],
    ] as const
  ).map(([ym, display]) => ({
    id: `csca-${ym}`,
    label: "Сессия CSCA",
    date: `${ym}-01`,
    precision: "month" as const,
    display,
    note: CSCA_NOTE,
    source_url: "https://csca.cn/",
    verified_at: "2026-08-31",
  })),
  {
    id: "csc-window-2026",
    label: "Окно подачи на стипендию правительства КНР (CSC)",
    date: "2026-04-01",
    precision: "month",
    display: "декабрь 2025 – апрель 2026, ориентировочно",
    note: CSC_NOTE,
    source_url: "https://www.campuschina.org/",
    verified_at: "2026-08-31",
  },
]

/* ---------- deadline feed ---------- */

export type DeadlineKind = "university" | "common" | "task"

export interface DeadlineItem {
  id: string
  kind: DeadlineKind
  universityId: string | null
  /** University name (kind=university), the common date's label or the task title. */
  title: string
  /** Fact label (kind=university), «от <организация>» / university name (kind=task) or null. */
  subtitle: string | null
  /** ISO date used for ordering. */
  date: string
  precision: DatePrecision
  /** Printed as is – `fact.display` or `FixedDate.display`. */
  display: string
  /** Whole days left; 0 while a month-precision date is in its month; negative when passed. */
  daysLeft: number
  passed: boolean
  /** Critical facts get the «сверьтесь с сайтом вуза» line. */
  critical: boolean
  /** «общие, по csca.cn/CSC» for common dates, null otherwise. */
  note: string | null
  /** Provenance of a fact / common date; null for tasks (they are the user's own data). */
  source_url: string | null
  verified_at: string | null
  /** kind=task: the task id, so the feed can mark it done. */
  taskId?: string
}

const DEADLINE_KEYS: readonly FactKey[] = ["deadline.fall.application_non_eu", "deadline.scholarship"]

function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

function itemFromFact(u: University, f: Fact, now: Date): DeadlineItem | null {
  const date = deadlineDateOf(f.value)
  if (!date) return null
  const daysLeft = daysUntil(date, now)
  if (daysLeft === null) return null
  return {
    id: `${u.id}:${f.key}`,
    kind: "university",
    universityId: u.id,
    title: u.name_ru ?? u.name,
    subtitle: f.label_ru,
    date,
    precision: "day",
    display: f.display,
    daysLeft,
    passed: daysLeft < 0,
    critical: isCriticalKey(f.key),
    note: null,
    source_url: f.source_url,
    verified_at: f.verified_at,
  }
}

function itemFromFixed(d: FixedDate, now: Date): DeadlineItem | null {
  const raw = daysUntil(d.date, now)
  if (raw === null) return null
  let daysLeft = raw
  let passed = raw < 0
  if (d.precision === "month") {
    const nowMonth = monthOf(isoDate(now))
    const inMonth = nowMonth === monthOf(d.date)
    passed = !inMonth && nowMonth > monthOf(d.date)
    daysLeft = inMonth ? 0 : raw
  }
  return {
    id: d.id,
    kind: "common",
    universityId: null,
    title: d.label,
    subtitle: null,
    date: d.date,
    precision: d.precision,
    display: d.display,
    daysLeft,
    passed,
    critical: false,
    note: d.note,
    source_url: d.source_url,
    verified_at: d.verified_at,
  }
}

/** The slice of a task the feed needs (see lib/tasks.ts for the full type). */
export interface FeedTask {
  id: string
  title: string
  dueOn: string | null
  doneAt: string | null
  universityId: string | null
  orgId: string | null
}

export interface DeadlineFeedOptions {
  /** Keep items whose date has passed (default false). */
  includePast?: boolean
  /** Open tasks with a due date join the timeline (cabinet, spec §4). */
  tasks?: readonly FeedTask[]
  /** Name of the student's organization – the subtitle of a mentor's task. */
  orgName?: string | null
}

function itemFromTask(t: FeedTask, catalog: Catalog, orgName: string | null | undefined, now: Date): DeadlineItem | null {
  if (!t.dueOn || t.doneAt) return null
  const daysLeft = daysUntil(t.dueOn, now)
  if (daysLeft === null) return null
  const u = t.universityId ? findUniversity(catalog, t.universityId) : undefined
  const who = t.orgId ? `от ${orgName ?? "наставника"}` : "моя задача"
  return {
    id: `task:${t.id}`,
    kind: "task",
    universityId: t.universityId,
    title: t.title,
    subtitle: u ? `${who} · ${u.name_ru ?? u.name}` : who,
    date: t.dueOn,
    precision: "day",
    display: formatCheckedAt(t.dueOn),
    daysLeft,
    passed: daysLeft < 0,
    critical: false,
    note: null,
    source_url: null,
    verified_at: null,
    taskId: t.id,
  }
}

/**
 * All deadlines of the universities in the plan (application + scholarship)
 * plus the common dates, one list sorted by date ascending with a countdown.
 * `now` is passed in so the feed is testable and stable within a render.
 */
export function deadlineFeed(
  plan: Plan,
  catalog: Catalog,
  fixedDates: readonly FixedDate[],
  now: Date,
  opts: DeadlineFeedOptions = {},
): DeadlineItem[] {
  const items: DeadlineItem[] = []
  for (const e of plan.universities) {
    const u = findUniversity(catalog, e.id)
    if (!u) continue
    for (const key of DEADLINE_KEYS) {
      for (const f of factsOf(u, key)) {
        const it = itemFromFact(u, f, now)
        if (it) items.push(it)
      }
    }
  }
  for (const d of fixedDates) {
    const it = itemFromFixed(d, now)
    if (it) items.push(it)
  }
  for (const t of opts.tasks ?? []) {
    const it = itemFromTask(t, catalog, opts.orgName, now)
    if (it) items.push(it)
  }
  const kept = opts.includePast ? items : items.filter((i) => !i.passed)
  return kept.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title, "ru"),
  )
}

/** Same day: a task first (it is actionable), then the university fact, then the common date. */
const KIND_ORDER: Record<DeadlineKind, number> = { task: 0, university: 1, common: 2 }

/** Items due within the next `days` days (inclusive), passed ones excluded – the «ближайшие 7 дней» list. */
export function upcomingWithin(items: readonly DeadlineItem[], days: number): DeadlineItem[] {
  return items.filter((i) => !i.passed && i.daysLeft <= days)
}

/* ---------- countdown label ---------- */

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/** «сегодня», «через 3 дня», «прошёл» – for the countdown column. */
export function daysLeftLabel(item: Pick<DeadlineItem, "daysLeft" | "passed" | "precision">): string {
  if (item.passed) return "прошёл"
  if (item.daysLeft <= 0) return item.precision === "month" ? "в этом месяце" : "сегодня"
  return `через ${item.daysLeft} ${pluralRu(item.daysLeft, "день", "дня", "дней")}`
}

/* ---------- share / export ---------- */

export interface SummaryOptions {
  /** Brand line at the top, e.g. the partner name. */
  brand?: string
  /** How many upcoming deadlines to list (default 5). */
  maxDeadlines?: number
}

/**
 * Plain-text digest for «Поделиться с наставником»: universities with status
 * and document readiness, then the nearest deadlines. No long dashes.
 */
export function planSummary(plan: Plan, catalog: Catalog, now: Date, opts: SummaryOptions = {}): string {
  const lines: string[] = [`Мой план поступления в Китай${opts.brand ? ` (${opts.brand})` : ""}`]
  if (plan.universities.length === 0) {
    lines.push("Вузы: пока не выбраны")
  } else {
    lines.push("Вузы:")
    for (const e of plan.universities) {
      const u = findUniversity(catalog, e.id)
      if (!u) continue
      const p = docProgress(e, u)
      lines.push(
        `- ${u.name_ru ?? u.name}: ${PLAN_STATUS_LABELS_RU[e.status].toLowerCase()}, документы ${p.done} из ${p.total} (${p.pct}%)`,
      )
    }
  }
  const feed = deadlineFeed(plan, catalog, FIXED_DATES, now).slice(0, opts.maxDeadlines ?? 5)
  if (feed.length) {
    lines.push("Ближайшие дедлайны:")
    for (const it of feed) {
      const who =
        it.kind === "university"
          ? `${it.title}, ${it.subtitle ?? "дедлайн"}`
          : it.kind === "task"
            ? `задача «${it.title}»${it.subtitle ? `, ${it.subtitle}` : ""}`
            : it.title
      lines.push(`- ${who}: ${it.display} (${daysLeftLabel(it)})`)
    }
  }
  lines.push(`Составлено ${isoDate(now)}. Дедлайны сверьте на сайтах вузов.`)
  return lines.join("\n")
}

/** Telegram share link for the digest. */
export function shareUrl(text: string): string {
  return `https://t.me/share/url?text=${encodeURIComponent(text)}`
}

export const PLAN_EXPORT_FORMAT = "admitica.cn.plan"
export const PLAN_EXPORT_VERSION = 1

/** JSON file body for «Экспорт плана». */
export function serializePlan(plan: Plan, now: Date = new Date()): string {
  return JSON.stringify(
    { format: PLAN_EXPORT_FORMAT, version: PLAN_EXPORT_VERSION, exported_at: now.toISOString(), plan },
    null,
    2,
  )
}

/** Parse an imported file – accepts the export wrapper or a bare plan. Null when invalid. */
export function parsePlan(json: string): Plan | null {
  try {
    const raw: unknown = JSON.parse(json)
    if (isRec(raw) && raw.format === PLAN_EXPORT_FORMAT) return normalizePlan(raw.plan)
    return normalizePlan(raw)
  } catch {
    return null
  }
}
