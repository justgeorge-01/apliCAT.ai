/**
 * «Мой план» storage (cabinet spec §4): one interface, two implementations.
 *
 *  - `localPlanStore`  – `admitica.cn.plan` in localStorage (guests; exactly the
 *    old behaviour);
 *  - `remotePlanStore` – `plan_items` + `plan_docs` in Supabase through
 *    `CabinetApi`. `save(next)` diffs `next` against the last state the
 *    database is known to hold and sends only the changed rows; saves are
 *    serialized so two quick clicks never race.
 *
 * Screens call `store.save(next)` after updating their React state
 * (optimistic UI); a rejected promise means «show a toast, keep the state».
 */
import type { CabinetApi } from "@/auth/api"
import { loadPlan, savePlan, type Plan, type PlanEntry, type PlanStatus } from "./plan"

export interface PlanStore {
  kind: "local" | "remote"
  load(): Promise<Plan>
  save(plan: Plan): Promise<void>
}

/* ---------- ops ---------- */

export type PlanOp =
  | { op: "upsert_item"; id: string; status: PlanStatus; note: string | null }
  | { op: "delete_item"; id: string }
  | { op: "set_doc"; id: string; docId: string; done: boolean }

/**
 * Rows to write so the database goes from `prev` to `next`. Removing a
 * university is one `delete_item` (the docs cascade); a new university is an
 * `upsert_item` plus `set_doc` for its checked documents; a changed status or
 * note is an `upsert_item`; a flipped checkbox is a `set_doc`.
 */
export function diffPlans(prev: Plan, next: Plan): PlanOp[] {
  const ops: PlanOp[] = []
  const before = new Map<string, PlanEntry>(prev.universities.map((e) => [e.id, e]))
  const after = new Map<string, PlanEntry>(next.universities.map((e) => [e.id, e]))

  for (const id of before.keys()) if (!after.has(id)) ops.push({ op: "delete_item", id })

  for (const e of next.universities) {
    const old = before.get(e.id)
    const note = e.note ?? null
    if (!old || old.status !== e.status || (old.note ?? null) !== note) {
      ops.push({ op: "upsert_item", id: e.id, status: e.status, note })
    }
    const docIds = new Set([...Object.keys(e.docs), ...Object.keys(old?.docs ?? {})])
    for (const docId of docIds) {
      const was = Boolean(old?.docs[docId])
      const now = Boolean(e.docs[docId])
      if (!old ? now : was !== now) ops.push({ op: "set_doc", id: e.id, docId, done: now })
    }
  }
  return ops
}

/* ---------- local ---------- */

export const localPlanStore: PlanStore = {
  kind: "local",
  async load() {
    return loadPlan()
  },
  async save(plan) {
    savePlan(plan)
  },
}

/* ---------- remote ---------- */

export function remotePlanStore(api: CabinetApi, studentId: string): PlanStore {
  // The plan the database holds after the last successful write. Until the
  // first load it is unknown, so `save` loads first.
  let known: Plan | null = null
  let queue: Promise<void> = Promise.resolve()

  const load = async (): Promise<Plan> => {
    const plan = await api.loadPlan(studentId)
    known = plan
    return plan
  }

  return {
    kind: "remote",
    load,
    save(next) {
      const run = async () => {
        const base = known ?? (await load())
        const ops = diffPlans(base, next)
        if (ops.length === 0) {
          known = next
          return
        }
        await api.applyPlanOps(studentId, ops)
        known = next
      }
      // Serialize: a failed save does not block the next attempt (the diff is
      // taken against `known`, which the failed save left untouched).
      const p = queue.then(run, run)
      queue = p.catch(() => {})
      return p
    },
  }
}
