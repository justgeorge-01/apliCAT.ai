/**
 * Cabinet domain (SPEC-cabinet.md): the row types the UI works with, the
 * pure helpers of the mentor panel (student table rows), the account export,
 * and the brand-from-database mapping. No I/O here – see `auth/api.ts` for
 * the backend interface and `auth/supabaseBackend.ts` for Supabase.
 */
import type { Catalog } from "@/data/china.types"
import { findUniversity } from "@/data/china"
import type { ChinaProfile } from "./match"
import type { Partner } from "./partner"
import { FIXED_DATES, deadlineFeed, docProgress, type Plan } from "./plan"
import { openTasks, type Task } from "./tasks"

/* ---------- rows ---------- */

export type OrgRole = "admin" | "mentor"

export interface Organization {
  id: string
  slug: string
  name: string
  tagline: string | null
  /** Telegram handle without «@», e.g. `zhuiqiu_yu`. */
  telegram: string | null
  createdAt: string
}

export interface Membership {
  org: Organization
  role: OrgRole
}

export interface Mentorship {
  studentId: string
  orgId: string
  status: "active" | "removed"
  joinedAt: string
  removedAt: string | null
}

export interface Profile {
  userId: string
  nick: string | null
  onboarding: ChinaProfile | null
  consentAt: string
  lastSeenAt: string | null
  createdAt: string
}

export interface MentorNote {
  orgId: string
  studentId: string
  universityId: string
  body: string
  authorId: string | null
  updatedAt: string
}

export interface OrgMember {
  userId: string
  role: OrgRole
  email: string
  addedAt: string
}

/** Everything the mentor panel shows about one student. */
export interface StudentBundle {
  profile: Profile
  mentorship: Mentorship
  plan: Plan
  tasks: Task[]
  notes: MentorNote[]
}

export const NICK_MAX = 40

/* ---------- errors ---------- */

export type CabinetErrorCode =
  | "invalid_code"
  | "already_in_org"
  | "user_not_found"
  | "not_an_admin"
  | "not_a_member"
  | "not_signed_in"
  | "rate_limited"
  | "invalid_email"
  | "network"
  | "unknown"

export class CabinetError extends Error {
  code: CabinetErrorCode
  constructor(code: CabinetErrorCode, message?: string) {
    super(message ?? code)
    this.name = "CabinetError"
    this.code = code
  }
}

/** Russian wording for every error the UI can meet. */
export const CABINET_ERROR_RU: Record<CabinetErrorCode, string> = {
  invalid_code: "Код приглашения не найден. Проверьте код у наставника.",
  already_in_org: "У вас уже есть наставник. Снять с сопровождения может только он.",
  user_not_found: "Аккаунта с таким email ещё нет: человеку нужно сначала войти на сайт.",
  not_an_admin: "Это может сделать только администратор организации.",
  not_a_member: "Вы не состоите в этой организации.",
  not_signed_in: "Нужно войти.",
  rate_limited: "Слишком много запросов. Подождите минуту и попробуйте снова.",
  invalid_email: "Проверьте адрес электронной почты.",
  network: "Нет связи. Изменения не сохранены, попробуйте ещё раз.",
  unknown: "Что-то пошло не так. Попробуйте ещё раз.",
}

export function errorMessageRu(e: unknown): string {
  if (e instanceof CabinetError) return CABINET_ERROR_RU[e.code]
  return CABINET_ERROR_RU.unknown
}

/* ---------- display helpers ---------- */

/** «ученик #a1b2» – a student without a nick is named by the start of their id. */
export function studentLabel(p: Pick<Profile, "userId" | "nick">): string {
  const nick = p.nick?.trim()
  return nick ? nick : `ученик #${p.userId.replace(/-/g, "").slice(0, 4)}`
}

export function telegramUrl(handle: string | null | undefined): string | null {
  const h = handle?.trim().replace(/^@/, "")
  return h && /^[A-Za-z0-9_]{1,64}$/.test(h) ? `https://t.me/${h}` : null
}

/**
 * The brand of a student's organization as a `Partner` (spec §6): header name /
 * tagline and the lead button to the organization's Telegram. Nothing else
 * from partners.ts applies – an organization has no expert page.
 */
export function orgToPartner(org: Organization): Partner {
  const url = telegramUrl(org.telegram)
  return {
    slug: `org:${org.slug}`,
    name: org.name,
    tagline: org.tagline ?? undefined,
    ...(url ? { lead: { label: "Написать наставнику", url } } : {}),
  }
}

/* ---------- mentor table ---------- */

export interface StudentRow {
  studentId: string
  label: string
  universities: number
  /** Nearest upcoming deadline (plan facts + tasks), null when none. */
  nextDeadline: { title: string; date: string; daysLeft: number; display: string } | null
  /** Documents done / total across the plan, as a percentage (0 when the plan is empty). */
  docsPct: number
  docsDone: number
  docsTotal: number
  openTasks: number
  lastSeenAt: string | null
  joinedAt: string
}

/** A row per student for `MentorStudents`, sorted by the nearest deadline (none last). */
export function studentRows(students: readonly StudentBundle[], catalog: Catalog, now: Date): StudentRow[] {
  const rows = students.map((s): StudentRow => {
    let done = 0
    let total = 0
    for (const e of s.plan.universities) {
      const u = findUniversity(catalog, e.id)
      if (!u) continue
      const p = docProgress(e, u)
      done += p.done
      total += p.total
    }
    const feed = deadlineFeed(s.plan, catalog, [], now, { tasks: s.tasks })
    const next = feed[0] ?? null
    return {
      studentId: s.profile.userId,
      label: studentLabel(s.profile),
      universities: s.plan.universities.length,
      nextDeadline: next ? { title: next.title, date: next.date, daysLeft: next.daysLeft, display: next.display } : null,
      docsPct: total ? Math.round((done / total) * 100) : 0,
      docsDone: done,
      docsTotal: total,
      openTasks: openTasks(s.tasks).length,
      lastSeenAt: s.profile.lastSeenAt,
      joinedAt: s.mentorship.joinedAt,
    }
  })
  return rows.sort((a, b) => {
    if (a.nextDeadline && b.nextDeadline) return a.nextDeadline.date.localeCompare(b.nextDeadline.date) || a.label.localeCompare(b.label, "ru")
    if (a.nextDeadline) return -1
    if (b.nextDeadline) return 1
    return a.label.localeCompare(b.label, "ru")
  })
}

/** «Горит на неделе»: a deadline within 7 days. */
export function isUrgent(row: StudentRow, days = 7): boolean {
  return row.nextDeadline !== null && row.nextDeadline.daysLeft <= days
}

/* ---------- common dates the mentor table ignores ---------- */
// (`studentRows` passes an empty fixed-date list on purpose: a CSCA session is
// not the student's deadline; the plan page still shows it in the feed.)
export { FIXED_DATES }

/* ---------- account export ---------- */

export const ACCOUNT_EXPORT_FORMAT = "admitica.cn.account"
export const ACCOUNT_EXPORT_VERSION = 1

export interface AccountExportInput {
  email: string | null
  profile: Profile
  organization: Organization | null
  plan: Plan
  tasks: readonly Task[]
  notes: readonly MentorNote[]
}

/** «Экспорт данных (JSON)» – everything the account holds, verbatim. */
export function serializeAccount(input: AccountExportInput, now: Date = new Date()): string {
  return JSON.stringify(
    {
      format: ACCOUNT_EXPORT_FORMAT,
      version: ACCOUNT_EXPORT_VERSION,
      exported_at: now.toISOString(),
      account: {
        email: input.email,
        nick: input.profile.nick,
        consent_at: input.profile.consentAt,
        created_at: input.profile.createdAt,
        last_seen_at: input.profile.lastSeenAt,
      },
      onboarding: input.profile.onboarding,
      organization: input.organization
        ? { slug: input.organization.slug, name: input.organization.name, telegram: input.organization.telegram }
        : null,
      plan: input.plan,
      tasks: input.tasks,
      mentor_notes: input.notes,
    },
    null,
    2,
  )
}

/* ---------- last visit ---------- */

export const LAST_SEEN_MIN_INTERVAL_MS = 60 * 60 * 1000

/** The client updates `last_seen_at` at most once an hour. */
export function shouldTouchLastSeen(lastSeenAt: string | null, now: Date): boolean {
  if (!lastSeenAt) return true
  const t = Date.parse(lastSeenAt)
  return !Number.isFinite(t) || now.getTime() - t >= LAST_SEEN_MIN_INTERVAL_MS
}

/** «сегодня», «вчера», «3 дня назад», «не заходил» – for the mentor table. */
export function lastSeenLabel(lastSeenAt: string | null, now: Date): string {
  if (!lastSeenAt) return "не заходил"
  const t = Date.parse(lastSeenAt)
  if (!Number.isFinite(t)) return "не заходил"
  const days = Math.floor((now.getTime() - t) / 86_400_000)
  if (days <= 0) return "сегодня"
  if (days === 1) return "вчера"
  if (days < 7) return `${days} ${days < 5 ? "дня" : "дней"} назад`
  if (days < 30) {
    const w = Math.floor(days / 7)
    return `${w} ${w === 1 ? "неделю" : w < 5 ? "недели" : "недель"} назад`
  }
  const m = Math.floor(days / 30)
  return `${m} ${m === 1 ? "месяц" : m < 5 ? "месяца" : "месяцев"} назад`
}
