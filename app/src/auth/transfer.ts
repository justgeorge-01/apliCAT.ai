/**
 * «Перенести план в аккаунт» (cabinet spec §3): after sign-in, when the account
 * is empty and this browser holds a plan, one button copies the plan, its
 * documents, the guest tasks and the onboarding answers into the account. The
 * local copy is marked as transferred (`admitica.cn.plan.transferred`), never
 * deleted.
 */
import type { CabinetApi } from "./api"
import type { Profile } from "@/lib/cabinet"
import { PROFILE_KEY, type ChinaProfile } from "@/lib/match"
import { readPersist } from "@/lib/persist"
import { emptyPlan, loadPlan, type Plan } from "@/lib/plan"
import { diffPlans } from "@/lib/planStore"
import { loadLocalTasks, type Task } from "@/lib/tasks"

export const TRANSFER_KEY = "cn.plan.transferred"
export const TRANSFER_STORAGE_KEY = "admitica." + TRANSFER_KEY

export interface TransferMark {
  at: string
  user: string
}

export interface LocalSnapshot {
  plan: Plan
  tasks: Task[]
  profile: ChinaProfile | null
}

export function localSnapshot(): LocalSnapshot {
  return { plan: loadPlan(), tasks: loadLocalTasks(), profile: readPersist<ChinaProfile | null>(PROFILE_KEY, null) }
}

export function transferMark(): TransferMark | null {
  const m = readPersist<unknown>(TRANSFER_KEY, null)
  return m && typeof m === "object" && typeof (m as TransferMark).user === "string" ? (m as TransferMark) : null
}

export function markTransferred(user: string, now: Date = new Date()): void {
  try {
    localStorage.setItem(TRANSFER_STORAGE_KEY, JSON.stringify({ at: now.toISOString(), user } satisfies TransferMark))
  } catch {
    /* quota */
  }
}

/** Offer the transfer? The account plan is empty, the browser plan is not, and this user has not transferred yet. */
export function transferOffer(uid: string, remotePlan: Plan, snapshot: LocalSnapshot = localSnapshot()): { universities: number; tasks: number } | null {
  if (remotePlan.universities.length > 0) return null
  if (snapshot.plan.universities.length === 0 && snapshot.tasks.length === 0) return null
  const mark = transferMark()
  if (mark && mark.user === uid) return null
  return { universities: snapshot.plan.universities.length, tasks: snapshot.tasks.length }
}

export interface TransferResult {
  plan: Plan
  tasks: Task[]
  onboarding: ChinaProfile | null
}

/** Copies the snapshot into the account; the onboarding answers only when the account has none. */
export async function transferLocal(api: CabinetApi, uid: string, remoteProfile: Profile | null, snapshot: LocalSnapshot = localSnapshot()): Promise<TransferResult> {
  const ops = diffPlans(emptyPlan(), snapshot.plan)
  if (ops.length) await api.applyPlanOps(uid, ops)
  const tasks: Task[] = []
  for (const t of snapshot.tasks) {
    const created = await api.insertTask({
      studentId: uid,
      authorId: uid,
      orgId: null,
      title: t.title,
      details: t.details,
      dueOn: t.dueOn,
      universityId: t.universityId,
    })
    if (t.doneAt) {
      await api.updateTask(created.id, { doneAt: t.doneAt })
      tasks.push({ ...created, doneAt: t.doneAt })
    } else tasks.push(created)
  }
  let onboarding = remoteProfile?.onboarding ?? null
  if (!onboarding && snapshot.profile) {
    await api.updateProfile(uid, { onboarding: snapshot.profile })
    onboarding = snapshot.profile
  }
  markTransferred(uid)
  return { plan: snapshot.plan, tasks, onboarding }
}

/** Keys cleared after the account is deleted (everything of the storefront, the theme included). */
export function clearLocalCabinetKeys(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("admitica.cn.")) localStorage.removeItem(k)
  } catch {
    /* private mode */
  }
}
