/**
 * Tasks (cabinet spec §4 «Задачи», §5): the type, pure reducers, who may do
 * what, and the two stores – `localTaskStore` (guests, `admitica.cn.tasks`)
 * and `remoteTaskStore` (Supabase through `CabinetApi`). Screens use the
 * `TaskStore` interface and never know which one is underneath.
 *
 * The permission rules mirror the RLS policies exactly (a UI that offers
 * more than the database allows would only produce errors):
 *  - a student may add tasks to themself (org null), mark ANY of their tasks
 *    done, and edit / delete only their own (org null);
 *  - an organization member may add / edit / delete tasks of their
 *    organization for its students, and cannot touch a student's own tasks.
 */
import type { CabinetApi } from "@/auth/api"
import { readPersist } from "./persist"

export type TaskId = string

export interface Task {
  id: TaskId
  studentId: string
  /** null – the student's own task; otherwise the organization that set it. */
  orgId: string | null
  authorId: string | null
  universityId: string | null
  title: string
  details: string | null
  /** ISO date `YYYY-MM-DD` or null. */
  dueOn: string | null
  /** ISO timestamp when done, null while open. */
  doneAt: string | null
  createdAt: string
  updatedAt: string
}

export const TASK_TITLE_MAX = 140
export const TASK_DETAILS_MAX = 2000

/** What a form produces. */
export interface TaskInput {
  title: string
  dueOn?: string | null
  universityId?: string | null
  details?: string | null
}

export interface NewTask extends TaskInput {
  studentId: string
  orgId: string | null
  authorId: string | null
}

export type TaskPatch = Partial<Pick<Task, "title" | "details" | "dueOn" | "universityId" | "doneAt">>

/* ---------- validation ---------- */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** A real calendar day in ISO form (`2026-02-30` is not one). */
export function isIsoDay(s: string | null | undefined): s is string {
  if (typeof s !== "string") return false
  const m = ISO_DAY.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

/** Trims and caps a form input; null when the title is empty. */
export function cleanTaskInput(input: TaskInput): TaskInput | null {
  const title = input.title.trim().slice(0, TASK_TITLE_MAX)
  if (!title) return null
  const details = input.details?.trim().slice(0, TASK_DETAILS_MAX) || null
  const dueOn = isIsoDay(input.dueOn) ? input.dueOn : null
  const universityId = input.universityId?.trim() || null
  return { title, details, dueOn, universityId }
}

/* ---------- who may do what ---------- */

export type TaskViewer = { kind: "student"; uid: string } | { kind: "mentor"; orgId: string }

export function isOwnTask(t: Task, viewer: TaskViewer): boolean {
  return viewer.kind === "student" ? t.studentId === viewer.uid && t.orgId === null : t.orgId === viewer.orgId
}

/** Mark done / reopen: a student – any task of theirs; a member – their organization's tasks. */
export function canToggleTask(t: Task, viewer: TaskViewer): boolean {
  return viewer.kind === "student" ? t.studentId === viewer.uid : t.orgId === viewer.orgId
}

/** Edit title / date / university / details: only the author side. */
export function canEditTask(t: Task, viewer: TaskViewer): boolean {
  return isOwnTask(t, viewer)
}

/** Delete: same as edit – a student never deletes a mentor's task. */
export function canDeleteTask(t: Task, viewer: TaskViewer): boolean {
  return isOwnTask(t, viewer)
}

/* ---------- pure reducers (optimistic state) ---------- */

export function upsertTask(list: readonly Task[], t: Task): Task[] {
  const i = list.findIndex((x) => x.id === t.id)
  if (i < 0) return [...list, t]
  const next = list.slice()
  next[i] = t
  return next
}

export function patchTask(list: readonly Task[], id: TaskId, patch: TaskPatch, now: Date = new Date()): Task[] {
  return list.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now.toISOString() } : t))
}

export function removeTask(list: readonly Task[], id: TaskId): Task[] {
  return list.filter((t) => t.id !== id)
}

export function isDone(t: Task): boolean {
  return t.doneAt !== null
}

/** Open tasks first, by due date (undated last), then done ones by completion. */
export function sortTasks(list: readonly Task[]): Task[] {
  return [...list].sort((a, b) => {
    const da = isDone(a) ? 1 : 0
    const db = isDone(b) ? 1 : 0
    if (da !== db) return da - db
    if (!da) {
      const ka = a.dueOn ?? "9999"
      const kb = b.dueOn ?? "9999"
      if (ka !== kb) return ka.localeCompare(kb)
      return a.createdAt.localeCompare(b.createdAt)
    }
    return (b.doneAt ?? "").localeCompare(a.doneAt ?? "")
  })
}

export function openTasks(list: readonly Task[]): Task[] {
  return list.filter((t) => !isDone(t))
}

/* ---------- storage (guests) ---------- */

/** persist.ts prefixes keys with `admitica.` → `admitica.cn.tasks`. */
export const TASKS_KEY = "cn.tasks"
export const TASKS_STORAGE_KEY = "admitica." + TASKS_KEY
/** `studentId` of tasks that live only in this browser. */
export const LOCAL_STUDENT_ID = "local"

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x)
const str = (x: unknown): string | null => (typeof x === "string" ? x : null)

function normalizeTask(raw: unknown): Task | null {
  if (!isRec(raw)) return null
  const id = str(raw.id)
  const title = str(raw.title)?.trim().slice(0, TASK_TITLE_MAX)
  if (!id || !title) return null
  const dueOn = str(raw.dueOn)
  return {
    id,
    studentId: str(raw.studentId) ?? LOCAL_STUDENT_ID,
    orgId: str(raw.orgId),
    authorId: str(raw.authorId),
    universityId: str(raw.universityId),
    title,
    details: str(raw.details)?.slice(0, TASK_DETAILS_MAX) || null,
    dueOn: isIsoDay(dueOn) ? dueOn : null,
    doneAt: str(raw.doneAt),
    createdAt: str(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: str(raw.updatedAt) ?? new Date(0).toISOString(),
  }
}

/** Validate an untrusted list (storage, import). Garbage → empty list. */
export function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Task[] = []
  for (const r of raw) {
    const t = normalizeTask(r)
    if (t && !seen.has(t.id)) {
      seen.add(t.id)
      out.push(t)
    }
  }
  return out
}

export function loadLocalTasks(): Task[] {
  return normalizeTasks(readPersist<unknown>(TASKS_KEY, null))
}

export function saveLocalTasks(list: readonly Task[]): void {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota / private mode */
  }
}

function localId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `t_${rnd}`
}

/* ---------- stores ---------- */

export interface TaskStore {
  kind: "local" | "remote"
  list(): Promise<Task[]>
  add(input: TaskInput): Promise<Task>
  update(id: TaskId, patch: TaskPatch): Promise<void>
  remove(id: TaskId): Promise<void>
}

/** Guests: tasks to oneself in `admitica.cn.tasks`. */
export function localTaskStore(now: () => Date = () => new Date()): TaskStore {
  return {
    kind: "local",
    async list() {
      return loadLocalTasks()
    },
    async add(input) {
      const clean = cleanTaskInput(input)
      if (!clean) throw new Error("empty_title")
      const ts = now().toISOString()
      const task: Task = {
        id: localId(),
        studentId: LOCAL_STUDENT_ID,
        orgId: null,
        authorId: null,
        universityId: clean.universityId ?? null,
        title: clean.title,
        details: clean.details ?? null,
        dueOn: clean.dueOn ?? null,
        doneAt: null,
        createdAt: ts,
        updatedAt: ts,
      }
      saveLocalTasks(upsertTask(loadLocalTasks(), task))
      return task
    },
    async update(id, patch) {
      saveLocalTasks(patchTask(loadLocalTasks(), id, patch, now()))
    },
    async remove(id) {
      saveLocalTasks(removeTask(loadLocalTasks(), id))
    },
  }
}

export interface RemoteTaskScope {
  /** Whose tasks. */
  studentId: string
  /** The signed-in user (author of new tasks). */
  authorId: string
  /** null – the student adds tasks to themself; an org id – a member sets organization tasks. */
  orgId: string | null
}

/** Signed-in: `tasks` in Supabase, scoped to one student. */
export function remoteTaskStore(api: CabinetApi, scope: RemoteTaskScope): TaskStore {
  return {
    kind: "remote",
    list() {
      return api.listTasks(scope.studentId)
    },
    add(input) {
      const clean = cleanTaskInput(input)
      if (!clean) throw new Error("empty_title")
      return api.insertTask({ ...clean, studentId: scope.studentId, authorId: scope.authorId, orgId: scope.orgId })
    },
    update(id, patch) {
      return api.updateTask(id, patch)
    },
    remove(id) {
      return api.deleteTask(id)
    },
  }
}
