/**
 * Supabase implementation of `Backend` (SPEC-cabinet §3–5). Every query goes
 * through PostgREST with the user's JWT; RLS is the only guard – nothing here
 * filters rows «for safety», the database does. Column lists are explicit
 * because `organizations.invite_code` has no select grant (a `*` would fail).
 */
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js"

import {
  CabinetError,
  type CabinetErrorCode,
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
import { normalizeTasks, type NewTask, type Task, type TaskPatch } from "@/lib/tasks"
import type { AuthApi, AuthUser, Backend, CabinetApi, OrgPatch, ProfilePatch } from "./api"

/** localStorage key of the session – under the storefront's `admitica.cn.*` prefix. */
export const AUTH_STORAGE_KEY = "admitica.cn.auth"

export function createSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      // Implicit flow: the magic link carries the session in the URL hash and
      // works when the e-mail is opened in another browser (PKCE needs the
      // verifier of the browser that requested the link).
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  })
}

/* ---------- errors ---------- */

const CODE_IN_MESSAGE: readonly CabinetErrorCode[] = [
  "invalid_code",
  "already_in_org",
  "user_not_found",
  "not_an_admin",
  "not_a_member",
  "not_signed_in",
]

function toCabinetError(e: unknown): CabinetError {
  if (e instanceof CabinetError) return e
  const msg = (e as { message?: string })?.message ?? String(e)
  for (const code of CODE_IN_MESSAGE) if (msg.includes(code)) return new CabinetError(code, msg)
  const status = (e as { status?: number })?.status
  if (status === 429 || /rate limit/i.test(msg)) return new CabinetError("rate_limited", msg)
  if (/valid email|invalid email/i.test(msg)) return new CabinetError("invalid_email", msg)
  if (/failed to fetch|network|load failed|fetch/i.test(msg)) return new CabinetError("network", msg)
  return new CabinetError("unknown", msg)
}

/** Unwraps a PostgREST result: throws a CabinetError on `error`. */
function ok<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw toCabinetError(res.error)
  return res.data
}

/* ---------- rows ---------- */

type Row = Record<string, unknown>

const ORG_COLS = "id, slug, name, tagline, telegram, created_at"
const PROFILE_COLS = "user_id, nick, onboarding, consent_at, last_seen_at, created_at"
const MENTORSHIP_COLS = "student_id, org_id, status, joined_at, removed_at"
const TASK_COLS = "id, student_id, org_id, author_id, university_id, title, details, due_on, done_at, created_at, updated_at"
const NOTE_COLS = "org_id, student_id, university_id, body, author_id, updated_at"

const s = (v: unknown): string | null => (typeof v === "string" ? v : null)
const iso = (v: unknown): string => (typeof v === "string" ? v : "")

function orgOf(r: Row): Organization {
  return {
    id: iso(r.id),
    slug: iso(r.slug),
    name: iso(r.name),
    tagline: s(r.tagline),
    telegram: s(r.telegram),
    createdAt: iso(r.created_at),
  }
}

function profileOf(r: Row): Profile {
  const ob = r.onboarding
  return {
    userId: iso(r.user_id),
    nick: s(r.nick),
    onboarding: ob && typeof ob === "object" ? (ob as ChinaProfile) : null,
    consentAt: iso(r.consent_at),
    lastSeenAt: s(r.last_seen_at),
    createdAt: iso(r.created_at),
  }
}

function mentorshipOf(r: Row): Mentorship {
  return {
    studentId: iso(r.student_id),
    orgId: iso(r.org_id),
    status: r.status === "removed" ? "removed" : "active",
    joinedAt: iso(r.joined_at),
    removedAt: s(r.removed_at),
  }
}

function taskOf(r: Row): Task {
  return {
    id: iso(r.id),
    studentId: iso(r.student_id),
    orgId: s(r.org_id),
    authorId: s(r.author_id),
    universityId: s(r.university_id),
    title: iso(r.title),
    details: s(r.details),
    dueOn: s(r.due_on),
    doneAt: s(r.done_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }
}

function noteOf(r: Row): MentorNote {
  return {
    orgId: iso(r.org_id),
    studentId: iso(r.student_id),
    universityId: iso(r.university_id),
    body: iso(r.body),
    authorId: s(r.author_id),
    updatedAt: iso(r.updated_at),
  }
}

function planOf(items: Row[], docs: Row[]): Plan {
  const byUni = new Map<string, Record<string, boolean>>()
  for (const d of docs) {
    const uni = iso(d.university_id)
    const m = byUni.get(uni) ?? {}
    m[iso(d.doc_id)] = Boolean(d.done)
    byUni.set(uni, m)
  }
  return (
    normalizePlan({
      universities: items.map((i) => ({
        id: iso(i.university_id),
        status: i.status as PlanStatus,
        docs: byUni.get(iso(i.university_id)) ?? {},
        note: s(i.note) ?? undefined,
      })),
    }) ?? { universities: [] }
  )
}

/* ---------- auth ---------- */

function userOf(u: { id: string; email?: string } | null | undefined): AuthUser | null {
  return u ? { id: u.id, email: u.email ?? null } : null
}

export function supabaseAuth(client: SupabaseClient): AuthApi {
  return {
    async getUser() {
      const { data, error } = await client.auth.getSession()
      if (error) throw toCabinetError(error)
      return userOf(data.session?.user)
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(userOf(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async sendMagicLink(email, opts) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: opts.redirectTo, shouldCreateUser: true, data: { consent_at: opts.consentAt } },
      })
      if (error) throw toCabinetError(error)
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw toCabinetError(error)
    },
  }
}

/* ---------- data ---------- */

export function supabaseData(client: SupabaseClient): CabinetApi {
  const from = (table: string) => client.from(table)

  async function bundlesOf(orgId: string, mentorships: Row[]): Promise<StudentBundle[]> {
    const ids = mentorships.map((m) => iso(m.student_id))
    if (ids.length === 0) return []
    const [profiles, items, docs, tasks, notes] = await Promise.all([
      from("profiles").select(PROFILE_COLS).in("user_id", ids).then(ok),
      from("plan_items").select("student_id, university_id, status, note, added_at").in("student_id", ids).order("added_at").then(ok),
      from("plan_docs").select("student_id, university_id, doc_id, done").in("student_id", ids).then(ok),
      from("tasks").select(TASK_COLS).in("student_id", ids).order("created_at").then(ok),
      from("mentor_notes").select(NOTE_COLS).eq("org_id", orgId).in("student_id", ids).then(ok),
    ])
    const profileById = new Map((profiles as Row[]).map((p) => [iso(p.user_id), profileOf(p)]))
    return mentorships.flatMap((m) => {
      const sid = iso(m.student_id)
      const profile = profileById.get(sid)
      if (!profile) return []
      return [
        {
          profile,
          mentorship: mentorshipOf(m),
          plan: planOf(
            (items as Row[]).filter((i) => i.student_id === sid),
            (docs as Row[]).filter((d) => d.student_id === sid),
          ),
          tasks: normalizeTasks((tasks as Row[]).filter((t) => t.student_id === sid).map(taskOf)),
          notes: (notes as Row[]).filter((n) => n.student_id === sid).map(noteOf),
        },
      ]
    })
  }

  return {
    async getProfile(uid) {
      return profileOf(ok(await from("profiles").select(PROFILE_COLS).eq("user_id", uid).single()) as Row)
    },
    async updateProfile(uid, patch: ProfilePatch) {
      const row: Row = {}
      if ("nick" in patch) row.nick = patch.nick
      if ("onboarding" in patch) row.onboarding = patch.onboarding
      if (patch.lastSeenAt !== undefined) row.last_seen_at = patch.lastSeenAt
      if (Object.keys(row).length === 0) return
      ok(await from("profiles").update(row).eq("user_id", uid))
    },
    async getMyOrg(uid) {
      const m = ok(
        await from("mentorships").select(MENTORSHIP_COLS).eq("student_id", uid).eq("status", "active").maybeSingle(),
      ) as Row | null
      if (!m) return null
      const org = ok(await from("organizations").select(ORG_COLS).eq("id", iso(m.org_id)).maybeSingle()) as Row | null
      if (!org) return null
      return { org: orgOf(org), mentorship: mentorshipOf(m) }
    },
    async joinOrg(code) {
      const data = ok(await client.rpc("join_org", { code })) as Row
      return orgOf(data)
    },
    async loadPlan(studentId) {
      const [items, docs] = await Promise.all([
        from("plan_items").select("university_id, status, note, added_at").eq("student_id", studentId).order("added_at").then(ok),
        from("plan_docs").select("university_id, doc_id, done").eq("student_id", studentId).then(ok),
      ])
      return planOf(items as Row[], docs as Row[])
    },
    async applyPlanOps(studentId, ops: PlanOp[]) {
      const deletes = ops.filter((o) => o.op === "delete_item").map((o) => o.id)
      const items = ops.flatMap((o) =>
        o.op === "upsert_item" ? [{ student_id: studentId, university_id: o.id, status: o.status, note: o.note }] : [],
      )
      const docs = ops.flatMap((o) =>
        o.op === "set_doc" ? [{ student_id: studentId, university_id: o.id, doc_id: o.docId, done: o.done }] : [],
      )
      if (deletes.length) ok(await from("plan_items").delete().eq("student_id", studentId).in("university_id", deletes))
      if (items.length) ok(await from("plan_items").upsert(items, { onConflict: "student_id,university_id" }))
      if (docs.length) ok(await from("plan_docs").upsert(docs, { onConflict: "student_id,university_id,doc_id" }))
    },
    async listTasks(studentId) {
      const rows = ok(await from("tasks").select(TASK_COLS).eq("student_id", studentId).order("created_at")) as Row[]
      return rows.map(taskOf)
    },
    async insertTask(t: NewTask) {
      const row = {
        student_id: t.studentId,
        org_id: t.orgId,
        author_id: t.authorId,
        university_id: t.universityId ?? null,
        title: t.title,
        details: t.details ?? null,
        due_on: t.dueOn ?? null,
      }
      return taskOf(ok(await from("tasks").insert(row).select(TASK_COLS).single()) as Row)
    },
    async updateTask(id, patch: TaskPatch) {
      const row: Row = {}
      if (patch.title !== undefined) row.title = patch.title
      if (patch.details !== undefined) row.details = patch.details
      if (patch.dueOn !== undefined) row.due_on = patch.dueOn
      if (patch.universityId !== undefined) row.university_id = patch.universityId
      if (patch.doneAt !== undefined) row.done_at = patch.doneAt
      if (Object.keys(row).length === 0) return
      ok(await from("tasks").update(row).eq("id", id))
    },
    async deleteTask(id) {
      ok(await from("tasks").delete().eq("id", id))
    },
    async listNotes(studentId) {
      const rows = ok(await from("mentor_notes").select(NOTE_COLS).eq("student_id", studentId)) as Row[]
      return rows.map(noteOf)
    },
    async deleteOwnAccount() {
      ok(await client.rpc("delete_own_account"))
    },

    async listMemberships(uid) {
      const rows = ok(await from("org_members").select(`role, organizations (${ORG_COLS})`).eq("user_id", uid)) as Row[]
      const out: Membership[] = []
      for (const r of rows) {
        const o = r.organizations
        if (o && typeof o === "object" && !Array.isArray(o)) out.push({ org: orgOf(o as Row), role: r.role === "admin" ? "admin" : "mentor" })
      }
      return out.sort((a, b) => a.org.name.localeCompare(b.org.name, "ru"))
    },
    async listStudents(orgId) {
      const ms = ok(
        await from("mentorships").select(MENTORSHIP_COLS).eq("org_id", orgId).eq("status", "active").order("joined_at"),
      ) as Row[]
      return bundlesOf(orgId, ms)
    },
    async getStudent(orgId, studentId) {
      const m = ok(
        await from("mentorships").select(MENTORSHIP_COLS).eq("org_id", orgId).eq("student_id", studentId).eq("status", "active").maybeSingle(),
      ) as Row | null
      if (!m) return null
      return (await bundlesOf(orgId, [m]))[0] ?? null
    },
    async removeStudent(orgId, studentId) {
      return Boolean(ok(await client.rpc("org_remove_student", { org: orgId, student: studentId })))
    },
    async upsertNote(note) {
      const row = {
        org_id: note.orgId,
        student_id: note.studentId,
        university_id: note.universityId,
        body: note.body,
        author_id: note.authorId,
      }
      return noteOf(
        ok(await from("mentor_notes").upsert(row, { onConflict: "org_id,student_id,university_id" }).select(NOTE_COLS).single()) as Row,
      )
    },
    async deleteNote(orgId, studentId, universityId) {
      ok(await from("mentor_notes").delete().match({ org_id: orgId, student_id: studentId, university_id: universityId }))
    },
    async getInviteCode(orgId) {
      return s(ok(await client.rpc("org_invite_code", { org: orgId })))
    },
    async reissueInvite(orgId) {
      return iso(ok(await client.rpc("org_reissue_invite", { org: orgId })))
    },
    async listMembers(orgId) {
      const rows = ok(await client.rpc("org_members_list", { org: orgId })) as Row[]
      return rows.map(
        (r): OrgMember => ({ userId: iso(r.user_id), role: (r.role === "admin" ? "admin" : "mentor") as OrgRole, email: iso(r.email), addedAt: iso(r.added_at) }),
      )
    },
    async addMemberByEmail(orgId, email, role) {
      ok(await client.rpc("org_add_member_by_email", { org: orgId, member_email: email, member_role: role }))
    },
    async updateOrg(orgId, patch: OrgPatch) {
      const row: Row = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.tagline !== undefined) row.tagline = patch.tagline
      if (patch.telegram !== undefined) row.telegram = patch.telegram
      if (Object.keys(row).length === 0) return
      ok(await from("organizations").update(row).eq("id", orgId))
    },
  }
}

export function supabaseBackend(url: string, anonKey: string): Backend {
  const client = createSupabase(url, anonKey)
  return { auth: supabaseAuth(client), data: supabaseData(client), fake: false }
}
