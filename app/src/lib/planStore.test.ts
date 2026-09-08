import { beforeEach, describe, expect, it } from "vitest"

import { createFakeBackend } from "@/auth/fakeBackend"
import { addToPlan, emptyPlan, setDoc, setNote, setStatus, type Plan } from "./plan"
import { diffPlans, localPlanStore, remotePlanStore } from "./planStore"

/* ---------- diff ---------- */

describe("diffPlans", () => {
  it("empty → empty: nothing to do", () => {
    expect(diffPlans(emptyPlan(), emptyPlan())).toEqual([])
  })

  it("a new university is an upsert plus its checked docs", () => {
    const next = setDoc(addToPlan(emptyPlan(), "a"), "a", "passport", true)
    expect(diffPlans(emptyPlan(), next)).toEqual([
      { op: "upsert_item", id: "a", status: "considering", note: null },
      { op: "set_doc", id: "a", docId: "passport", done: true },
    ])
  })

  it("status, note and a flipped checkbox each become one row; a removal is one delete", () => {
    const p0 = setDoc(addToPlan(addToPlan(emptyPlan(), "a"), "b"), "a", "passport", true)
    let p1 = setStatus(p0, "a", "applied")
    p1 = setNote(p1, "a", "заметка")
    p1 = setDoc(p1, "a", "passport", false)
    p1 = { universities: p1.universities.filter((e) => e.id !== "b") }
    expect(diffPlans(p0, p1)).toEqual([
      { op: "delete_item", id: "b" },
      { op: "upsert_item", id: "a", status: "applied", note: "заметка" },
      { op: "set_doc", id: "a", docId: "passport", done: false },
    ])
  })

  it("unchanged entries produce no ops", () => {
    const p = setDoc(addToPlan(emptyPlan(), "a"), "a", "passport", true)
    expect(diffPlans(p, { universities: p.universities.map((e) => ({ ...e })) })).toEqual([])
  })
})

/* ---------- local ---------- */

describe("localPlanStore", () => {
  const mem = new Map<string, string>()
  beforeEach(() => {
    mem.clear()
    globalThis.localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage
  })

  it("round-trips through admitica.cn.plan", async () => {
    expect(localPlanStore.kind).toBe("local")
    expect(await localPlanStore.load()).toEqual({ universities: [] })
    const p = setNote(addToPlan(emptyPlan(), "x"), "x", "n")
    await localPlanStore.save(p)
    expect(JSON.parse(mem.get("admitica.cn.plan")!)).toEqual(p)
    expect(await localPlanStore.load()).toEqual(p)
  })
})

/* ---------- remote (mock client = the in-memory backend) ---------- */

describe("remotePlanStore", () => {
  it("loads, diffs against the last saved state and serializes saves", async () => {
    const be = createFakeBackend({ storage: null, seed: false })
    const u = be.addUser("a@example.test")
    be.signInAs(u.id)
    const store = remotePlanStore(be.data, u.id)
    expect(store.kind).toBe("remote")
    expect(await store.load()).toEqual({ universities: [] })

    const p1 = setDoc(addToPlan(emptyPlan(), "tsinghua-university"), "tsinghua-university", "passport", true)
    const p2 = setStatus(addToPlan(p1, "zhejiang-university"), "tsinghua-university", "preparing")
    // two saves in a row without awaiting the first – the second must see the first
    const s1 = store.save(p1)
    const s2 = store.save(p2)
    await Promise.all([s1, s2])
    expect(await be.data.loadPlan(u.id)).toEqual(p2)
    expect(await store.load()).toEqual(p2)

    // removal cascades the docs
    const p3: Plan = { universities: p2.universities.filter((e) => e.id !== "tsinghua-university") }
    await store.save(p3)
    expect(be.state.planDocs).toEqual([])
    expect(be.state.planItems.map((i) => i.universityId)).toEqual(["zhejiang-university"])
  })

  it("a failed save rejects and leaves the next save with the same diff", async () => {
    const be = createFakeBackend({ storage: null, seed: false })
    const u = be.addUser("b@example.test")
    be.signInAs(u.id)
    let fail = true
    const api = {
      ...be.data,
      applyPlanOps: (sid: string, ops: Parameters<typeof be.data.applyPlanOps>[1]) => {
        if (fail) return Promise.reject(new Error("network"))
        return be.data.applyPlanOps(sid, ops)
      },
    }
    const store = remotePlanStore(api, u.id)
    const p = addToPlan(emptyPlan(), "fudan-university")
    await expect(store.save(p)).rejects.toThrow("network")
    fail = false
    await store.save(p)
    expect((await be.data.loadPlan(u.id)).universities.map((e) => e.id)).toEqual(["fudan-university"])
  })

  it("the mock client refuses to write another student's plan (as RLS would)", async () => {
    const be = createFakeBackend({ storage: null, seed: false })
    const a = be.addUser("a@example.test")
    const b = be.addUser("b@example.test")
    be.signInAs(a.id)
    const store = remotePlanStore(be.data, b.id)
    await expect(store.save(addToPlan(emptyPlan(), "fudan-university"))).rejects.toThrow(/row-level/)
  })
})
