/**
 * In-memory `Backend` – the cabinet without Supabase.
 *
 * Used by unit tests (planStore / tasks with a «mock client») and by the dev
 * preview (`VITE_CABINET_FAKE=1`, dev server only): sign-in is instant
 * («без письма»), a demo organization «Zhuiqiu» with three students is seeded,
 * `mentor@demo.abitura` is its admin. State persists in localStorage
 * (`admitica.cn.fake`) so a reload keeps you signed in. The permission rules
 * follow the RLS policies, so the UI meets the same refusals as in production.
 * Not part of a production build (see auth/backend.ts).
 */
import {
  CabinetError,
  type MentorNote,
  type Membership,
  type Mentorship,
  type Organization,
  type OrgMember,
  type OrgRole,
  type Profile,
  type StudentBundle,
} from "@/lib/cabinet"
import type { ChinaProfile } from "@/lib/match"
import { normalizePlan, type Plan, type PlanStatus } from "@/lib/plan"
import type { PlanOp } from "@/lib/planStore"
import type { NewTask, Task, TaskPatch } from "@/lib/tasks"
import type { AuthApi, AuthUser, Backend, CabinetApi } from "./api"
import { CONFIRM_DELETE, CONFIRM_PARAM } from "./url"

export const FAKE_STORAGE_KEY = "admitica.cn.fake"
export const DEMO_ORG_CODE = "ZHUIQIU-7F3K"
export const DEMO_MENTOR_EMAIL = "mentor@demo.abitura"
export const DEMO_STUDENT_EMAIL = "student@demo.abitura"

interface FakeUser {
  id: string
  email: string
}
interface FakeOrg extends Organization {
  inviteCode: string
}
interface FakeMember {
  orgId: string
  userId: string
  role: OrgRole
  addedAt: string
}
interface FakePlanItem {
  studentId: string
  universityId: string
  status: PlanStatus
  note: string | null
  addedAt: string
}
interface FakePlanDoc {
  studentId: string
  universityId: string
  docId: string
  done: boolean
}

export interface FakeState {
  users: FakeUser[]
  profiles: Profile[]
  orgs: FakeOrg[]
  members: FakeMember[]
  mentorships: Mentorship[]
  planItems: FakePlanItem[]
  planDocs: FakePlanDoc[]
  tasks: Task[]
  notes: MentorNote[]
  sessionUserId: string | null
}

export interface FakeOptions {
  /** Where the state lives between reloads; null – memory only (tests). */
  storage?: Storage | null
  /** Seed the demo organization and students (default true). */
  seed?: boolean
  now?: () => Date
  /** Called instead of `location.assign` when a magic link «returns» with a query (tests). */
  navigate?: (url: string) => void
}

let counter = 0
function id(prefix: string): string {
  counter += 1
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${rnd}${counter}`
}

function daysFrom(now: Date, days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function hoursAgo(now: Date, h: number): string {
  return new Date(now.getTime() - h * 3_600_000).toISOString()
}

/* ---------- seed ---------- */

export function seedState(now: Date): FakeState {
  const org: FakeOrg = {
    id: "org-zhuiqiu",
    slug: "zhuiqiu",
    name: "Zhuiqiu",
    tagline: "Наставник по поступлению в вузы Китая",
    telegram: "zhuiqiu_yu",
    createdAt: hoursAgo(now, 24 * 40),
    inviteCode: DEMO_ORG_CODE,
  }
  const lenaProfile: ChinaProfile = {
    degree: "bachelor",
    year: 2027,
    field: "it",
    language: "en",
    hsk: null,
    ielts: 6.5,
    budget_year_cny: 100_000,
  }
  const users: FakeUser[] = [
    { id: "u-mentor", email: DEMO_MENTOR_EMAIL },
    { id: "u-mentor2", email: "mentor2@demo.abitura" },
    { id: "u-lena", email: DEMO_STUDENT_EMAIL },
    { id: "u-b7c2e", email: "student2@demo.abitura" },
    { id: "u-mark", email: "student3@demo.abitura" },
  ]
  const profiles: Profile[] = [
    { userId: "u-mentor", nick: "Юй", onboarding: null, consentAt: hoursAgo(now, 24 * 40), lastSeenAt: hoursAgo(now, 1), createdAt: hoursAgo(now, 24 * 40) },
    { userId: "u-mentor2", nick: null, onboarding: null, consentAt: hoursAgo(now, 24 * 30), lastSeenAt: hoursAgo(now, 30), createdAt: hoursAgo(now, 24 * 30) },
    { userId: "u-lena", nick: "Лена", onboarding: lenaProfile, consentAt: hoursAgo(now, 24 * 20), lastSeenAt: hoursAgo(now, 2), createdAt: hoursAgo(now, 24 * 20) },
    {
      userId: "u-b7c2e",
      nick: null,
      onboarding: { degree: "master", year: 2026, field: "business", language: "zh", hsk: 5, ielts: null, budget_year_cny: 60_000 },
      consentAt: hoursAgo(now, 24 * 12),
      lastSeenAt: hoursAgo(now, 24 * 5),
      createdAt: hoursAgo(now, 24 * 12),
    },
    { userId: "u-mark", nick: "Марк", onboarding: null, consentAt: hoursAgo(now, 20), lastSeenAt: null, createdAt: hoursAgo(now, 20) },
  ]
  const members: FakeMember[] = [
    { orgId: org.id, userId: "u-mentor", role: "admin", addedAt: org.createdAt },
    { orgId: org.id, userId: "u-mentor2", role: "mentor", addedAt: hoursAgo(now, 24 * 30) },
  ]
  const mentorships: Mentorship[] = [
    { studentId: "u-lena", orgId: org.id, status: "active", joinedAt: hoursAgo(now, 24 * 19), removedAt: null },
    { studentId: "u-b7c2e", orgId: org.id, status: "active", joinedAt: hoursAgo(now, 24 * 11), removedAt: null },
    { studentId: "u-mark", orgId: org.id, status: "active", joinedAt: hoursAgo(now, 19), removedAt: null },
  ]
  const planItems: FakePlanItem[] = [
    { studentId: "u-lena", universityId: "tsinghua-university", status: "preparing", note: "Хочу на Computer Science, английская программа", addedAt: hoursAgo(now, 24 * 18) },
    { studentId: "u-lena", universityId: "zhejiang-university", status: "considering", note: null, addedAt: hoursAgo(now, 24 * 10) },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", status: "applied", note: null, addedAt: hoursAgo(now, 24 * 11) },
  ]
  const planDocs: FakePlanDoc[] = [
    { studentId: "u-lena", universityId: "tsinghua-university", docId: "passport", done: true },
    { studentId: "u-lena", universityId: "tsinghua-university", docId: "transcript", done: true },
    { studentId: "u-lena", universityId: "tsinghua-university", docId: "language", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "passport", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "transcript", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "language", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "motivation", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "recommendations", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "medical", done: true },
    { studentId: "u-b7c2e", universityId: "shanghai-jiao-tong-university", docId: "photo", done: true },
  ]
  const t = (over: Partial<Task> & Pick<Task, "id" | "studentId" | "title">): Task => ({
    orgId: null,
    authorId: over.studentId,
    universityId: null,
    details: null,
    dueOn: null,
    doneAt: null,
    createdAt: hoursAgo(now, 48),
    updatedAt: hoursAgo(now, 48),
    ...over,
  })
  const tasks: Task[] = [
    t({
      id: "task-1",
      studentId: "u-lena",
      orgId: org.id,
      authorId: "u-mentor",
      universityId: "tsinghua-university",
      title: "Прислать мотивационное письмо на проверку",
      details: "Черновик на английском, 600–800 слов. Без цитат из интернета.",
      dueOn: daysFrom(now, 3),
      createdAt: hoursAgo(now, 72),
      updatedAt: hoursAgo(now, 72),
    }),
    t({ id: "task-2", studentId: "u-lena", title: "Записаться на IELTS", dueOn: daysFrom(now, 10) }),
    t({
      id: "task-3",
      studentId: "u-lena",
      orgId: org.id,
      authorId: "u-mentor",
      title: "Заполнить анкету на сайте вуза",
      dueOn: daysFrom(now, -4),
      doneAt: hoursAgo(now, 30),
      createdAt: hoursAgo(now, 24 * 8),
      updatedAt: hoursAgo(now, 30),
    }),
    t({
      id: "task-4",
      studentId: "u-b7c2e",
      orgId: org.id,
      authorId: "u-mentor2",
      universityId: "shanghai-jiao-tong-university",
      title: "Проверить статус заявки в личном кабинете вуза",
      dueOn: daysFrom(now, 1),
    }),
  ]
  const notes: MentorNote[] = [
    {
      orgId: org.id,
      studentId: "u-lena",
      universityId: "tsinghua-university",
      body: "Сначала IELTS 6.5, потом подача в первом раунде. Дедлайн на сайте вуза сверим вместе в ноябре.",
      authorId: "u-mentor",
      updatedAt: hoursAgo(now, 50),
    },
  ]
  return { users, profiles, orgs: [org], members, mentorships, planItems, planDocs, tasks, notes, sessionUserId: null }
}

export function emptyState(): FakeState {
  return { users: [], profiles: [], orgs: [], members: [], mentorships: [], planItems: [], planDocs: [], tasks: [], notes: [], sessionUserId: null }
}

/* ---------- backend ---------- */

export interface FakeBackend extends Backend {
  state: FakeState
  /** Test helper: sign in as an existing user id without the magic-link dance. */
  signInAs(userId: string | null): void
  /** Test helper: add a user (and profile) directly. */
  addUser(email: string, consentAt?: string): FakeUser
}

export function createFakeBackend(opts: FakeOptions = {}): FakeBackend {
  const now = opts.now ?? (() => new Date())
  const storage = opts.storage ?? null
  const listeners = new Set<(u: AuthUser | null) => void>()

  const state: FakeState = (() => {
    if (storage) {
      try {
        const raw = storage.getItem(FAKE_STORAGE_KEY)
        if (raw) return JSON.parse(raw) as FakeState
      } catch {
        /* ignore */
      }
    }
    return opts.seed === false ? emptyState() : seedState(now())
  })()

  const persist = () => {
    if (!storage) return
    try {
      storage.setItem(FAKE_STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota */
    }
  }

  const uid = (): string => {
    if (!state.sessionUserId) throw new CabinetError("not_signed_in")
    return state.sessionUserId
  }
  const currentUser = (): AuthUser | null => {
    const u = state.users.find((x) => x.id === state.sessionUserId)
    return u ? { id: u.id, email: u.email } : null
  }
  const emit = () => {
    const u = currentUser()
    for (const l of listeners) l(u)
  }
  const isMember = (orgId: string, userId = uid()) => state.members.some((m) => m.orgId === orgId && m.userId === userId)
  const isAdmin = (orgId: string, userId = uid()) => state.members.some((m) => m.orgId === orgId && m.userId === userId && m.role === "admin")
  const activeOrgOf = (studentId: string) => state.mentorships.find((m) => m.studentId === studentId && m.status === "active")?.orgId ?? null
  const mentorsStudent = (studentId: string, userId = uid()) => {
    const org = activeOrgOf(studentId)
    return org !== null && isMember(org, userId)
  }
  const canSeeStudent = (studentId: string) => uid() === studentId || mentorsStudent(studentId)

  const addUser = (email: string, consentAt = now().toISOString()): FakeUser => {
    const existing = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (existing) return existing
    const u: FakeUser = { id: id("u"), email: email.toLowerCase() }
    state.users.push(u)
    state.profiles.push({ userId: u.id, nick: null, onboarding: null, consentAt, lastSeenAt: null, createdAt: now().toISOString() })
    persist()
    return u
  }

  const signInAs = (userId: string | null) => {
    state.sessionUserId = userId
    persist()
    emit()
  }

  const orgPublic = (o: FakeOrg): Organization => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    tagline: o.tagline,
    telegram: o.telegram,
    createdAt: o.createdAt,
  })

  const planOf = (studentId: string): Plan =>
    normalizePlan({
      universities: state.planItems
        .filter((i) => i.studentId === studentId)
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
        .map((i) => ({
          id: i.universityId,
          status: i.status,
          docs: Object.fromEntries(
            state.planDocs.filter((d) => d.studentId === studentId && d.universityId === i.universityId).map((d) => [d.docId, d.done]),
          ),
          note: i.note ?? undefined,
        })),
    }) ?? { universities: [] }

  const bundleOf = (orgId: string, m: Mentorship): StudentBundle | null => {
    const profile = state.profiles.find((p) => p.userId === m.studentId)
    if (!profile) return null
    return {
      profile,
      mentorship: m,
      plan: planOf(m.studentId),
      tasks: state.tasks.filter((t) => t.studentId === m.studentId),
      notes: state.notes.filter((n) => n.orgId === orgId && n.studentId === m.studentId),
    }
  }

  const auth: AuthApi = {
    async getUser() {
      return currentUser()
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async sendMagicLink(email, o) {
      const clean = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new CabinetError("invalid_email")
      const u = addUser(clean, o.consentAt)
      state.sessionUserId = u.id
      persist()
      let confirmDelete = false
      try {
        confirmDelete = new URL(o.redirectTo).searchParams.get(CONFIRM_PARAM) === CONFIRM_DELETE
      } catch {
        /* not a URL – plain sign-in */
      }
      if (confirmDelete) {
        const go = opts.navigate ?? ((url: string) => location.assign(url))
        go(o.redirectTo)
        return
      }
      emit()
    },
    async signOut() {
      signInAs(null)
    },
  }

  const data: CabinetApi = {
    async getProfile(userId) {
      if (!canSeeStudent(userId)) throw new CabinetError("unknown", "profile not visible")
      const p = state.profiles.find((x) => x.userId === userId)
      if (!p) throw new CabinetError("unknown", "no profile")
      return p
    },
    async updateProfile(userId, patch) {
      if (uid() !== userId) return
      const p = state.profiles.find((x) => x.userId === userId)
      if (!p) return
      if ("nick" in patch) p.nick = patch.nick ?? null
      if ("onboarding" in patch) p.onboarding = patch.onboarding ?? null
      if (patch.lastSeenAt !== undefined) p.lastSeenAt = patch.lastSeenAt
      persist()
    },
    async getMyOrg(userId) {
      const m = state.mentorships.find((x) => x.studentId === userId && x.status === "active")
      const org = m ? state.orgs.find((o) => o.id === m.orgId) : undefined
      return m && org ? { org: orgPublic(org), mentorship: m } : null
    },
    async joinOrg(code) {
      const me = uid()
      const org = state.orgs.find((o) => o.inviteCode === code.trim().toUpperCase())
      if (!org) throw new CabinetError("invalid_code")
      const current = activeOrgOf(me)
      if (current && current !== org.id) throw new CabinetError("already_in_org")
      const existing = state.mentorships.find((m) => m.studentId === me && m.orgId === org.id)
      if (existing) {
        existing.status = "active"
        existing.removedAt = null
      } else {
        state.mentorships.push({ studentId: me, orgId: org.id, status: "active", joinedAt: now().toISOString(), removedAt: null })
      }
      persist()
      return orgPublic(org)
    },
    async loadPlan(studentId) {
      if (!canSeeStudent(studentId)) return { universities: [] }
      return planOf(studentId)
    },
    async applyPlanOps(studentId, ops: PlanOp[]) {
      if (uid() !== studentId) throw new CabinetError("unknown", "row-level security")
      for (const op of ops) {
        if (op.op === "delete_item") {
          state.planItems = state.planItems.filter((i) => !(i.studentId === studentId && i.universityId === op.id))
          state.planDocs = state.planDocs.filter((d) => !(d.studentId === studentId && d.universityId === op.id))
        } else if (op.op === "upsert_item") {
          const i = state.planItems.find((x) => x.studentId === studentId && x.universityId === op.id)
          if (i) {
            i.status = op.status
            i.note = op.note
          } else state.planItems.push({ studentId, universityId: op.id, status: op.status, note: op.note, addedAt: now().toISOString() })
        } else {
          const d = state.planDocs.find((x) => x.studentId === studentId && x.universityId === op.id && x.docId === op.docId)
          if (d) d.done = op.done
          else state.planDocs.push({ studentId, universityId: op.id, docId: op.docId, done: op.done })
        }
      }
      persist()
    },
    async listTasks(studentId) {
      if (!canSeeStudent(studentId)) return []
      return state.tasks.filter((t) => t.studentId === studentId)
    },
    async insertTask(t: NewTask) {
      const me = uid()
      const allowed =
        t.authorId === me &&
        ((t.studentId === me && t.orgId === null) ||
          (t.orgId !== null && isMember(t.orgId) && activeOrgOf(t.studentId) === t.orgId))
      if (!allowed) throw new CabinetError("unknown", "row-level security")
      const ts = now().toISOString()
      const task: Task = {
        id: id("task"),
        studentId: t.studentId,
        orgId: t.orgId,
        authorId: t.authorId,
        universityId: t.universityId ?? null,
        title: t.title,
        details: t.details ?? null,
        dueOn: t.dueOn ?? null,
        doneAt: null,
        createdAt: ts,
        updatedAt: ts,
      }
      state.tasks.push(task)
      persist()
      return task
    },
    async updateTask(taskId, patch: TaskPatch) {
      const me = uid()
      const t = state.tasks.find((x) => x.id === taskId)
      if (!t) return
      const student = t.studentId === me
      const member = t.orgId !== null && isMember(t.orgId)
      if (!student && !member) return
      const onlyDone = Object.keys(patch).every((k) => k === "doneAt")
      if (student && !member && t.orgId !== null && !onlyDone) throw new CabinetError("unknown", "only done_at")
      Object.assign(t, patch, { updatedAt: now().toISOString() })
      persist()
    },
    async deleteTask(taskId) {
      const me = uid()
      const t = state.tasks.find((x) => x.id === taskId)
      if (!t) return
      const ok = (t.studentId === me && t.orgId === null) || (t.orgId !== null && isMember(t.orgId))
      if (!ok) return
      state.tasks = state.tasks.filter((x) => x.id !== taskId)
      persist()
    },
    async listNotes(studentId) {
      const me = uid()
      const org = activeOrgOf(studentId)
      return state.notes.filter((n) => n.studentId === studentId && (isMember(n.orgId, me) || (studentId === me && n.orgId === org)))
    },
    async deleteOwnAccount() {
      const me = uid()
      state.users = state.users.filter((u) => u.id !== me)
      state.profiles = state.profiles.filter((p) => p.userId !== me)
      state.members = state.members.filter((m) => m.userId !== me)
      state.mentorships = state.mentorships.filter((m) => m.studentId !== me)
      state.planItems = state.planItems.filter((i) => i.studentId !== me)
      state.planDocs = state.planDocs.filter((d) => d.studentId !== me)
      state.tasks = state.tasks.filter((t) => t.studentId !== me)
      state.notes = state.notes.filter((n) => n.studentId !== me)
      state.sessionUserId = null
      persist()
      emit()
    },

    async listMemberships(userId) {
      return state.members
        .filter((m) => m.userId === userId)
        .flatMap((m): Membership[] => {
          const org = state.orgs.find((o) => o.id === m.orgId)
          return org ? [{ org: orgPublic(org), role: m.role }] : []
        })
    },
    async listStudents(orgId) {
      if (!isMember(orgId)) return []
      return state.mentorships
        .filter((m) => m.orgId === orgId && m.status === "active")
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        .flatMap((m) => {
          const b = bundleOf(orgId, m)
          return b ? [b] : []
        })
    },
    async getStudent(orgId, studentId) {
      if (!isMember(orgId)) return null
      const m = state.mentorships.find((x) => x.orgId === orgId && x.studentId === studentId && x.status === "active")
      return m ? bundleOf(orgId, m) : null
    },
    async removeStudent(orgId, studentId) {
      if (!isMember(orgId)) throw new CabinetError("not_a_member")
      const m = state.mentorships.find((x) => x.orgId === orgId && x.studentId === studentId && x.status === "active")
      if (!m) return false
      m.status = "removed"
      m.removedAt = now().toISOString()
      persist()
      return true
    },
    async upsertNote(note) {
      if (!isMember(note.orgId) || activeOrgOf(note.studentId) !== note.orgId) throw new CabinetError("unknown", "row-level security")
      const existing = state.notes.find((n) => n.orgId === note.orgId && n.studentId === note.studentId && n.universityId === note.universityId)
      const saved: MentorNote = { ...note, authorId: uid(), updatedAt: now().toISOString() }
      if (existing) Object.assign(existing, saved)
      else state.notes.push(saved)
      persist()
      return saved
    },
    async deleteNote(orgId, studentId, universityId) {
      if (!isMember(orgId)) return
      state.notes = state.notes.filter((n) => !(n.orgId === orgId && n.studentId === studentId && n.universityId === universityId))
      persist()
    },
    async getInviteCode(orgId) {
      if (!isMember(orgId)) return null
      return state.orgs.find((o) => o.id === orgId)?.inviteCode ?? null
    },
    async reissueInvite(orgId) {
      if (!isAdmin(orgId)) throw new CabinetError("not_an_admin")
      const org = state.orgs.find((o) => o.id === orgId)
      if (!org) throw new CabinetError("unknown")
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
      let suffix = ""
      for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
      org.inviteCode = `${org.slug.toUpperCase()}-${suffix}`
      persist()
      return org.inviteCode
    },
    async listMembers(orgId) {
      if (!isMember(orgId)) return []
      return state.members
        .filter((m) => m.orgId === orgId)
        .map((m): OrgMember => ({
          userId: m.userId,
          role: m.role,
          email: state.users.find((u) => u.id === m.userId)?.email ?? "",
          addedAt: m.addedAt,
        }))
    },
    async addMemberByEmail(orgId, email, role) {
      if (!isAdmin(orgId)) throw new CabinetError("not_an_admin")
      const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
      if (!u) throw new CabinetError("user_not_found")
      const existing = state.members.find((m) => m.orgId === orgId && m.userId === u.id)
      if (existing) existing.role = role
      else state.members.push({ orgId, userId: u.id, role, addedAt: now().toISOString() })
      persist()
    },
    async updateOrg(orgId, patch) {
      if (!isAdmin(orgId)) throw new CabinetError("not_an_admin")
      const org = state.orgs.find((o) => o.id === orgId)
      if (!org) return
      if (patch.name !== undefined) org.name = patch.name
      if (patch.tagline !== undefined) org.tagline = patch.tagline
      if (patch.telegram !== undefined) org.telegram = patch.telegram
      persist()
    },
  }

  return {
    auth,
    data,
    fake: true,
    get state() {
      return state
    },
    signInAs,
    addUser,
  }
}
