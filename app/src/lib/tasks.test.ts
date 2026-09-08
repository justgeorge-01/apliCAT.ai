import { beforeEach, describe, expect, it } from "vitest"

import { createFakeBackend, DEMO_MENTOR_EMAIL, DEMO_STUDENT_EMAIL } from "@/auth/fakeBackend"
import {
  canDeleteTask,
  canEditTask,
  canToggleTask,
  cleanTaskInput,
  localTaskStore,
  normalizeTasks,
  patchTask,
  remoteTaskStore,
  removeTask,
  sortTasks,
  upsertTask,
  type Task,
} from "./tasks"

const base = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  studentId: "s",
  orgId: null,
  authorId: "s",
  universityId: null,
  title: "Задача",
  details: null,
  dueOn: null,
  doneAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...over,
})

describe("task permissions mirror RLS", () => {
  const student = { kind: "student", uid: "s" } as const
  const mentor = { kind: "mentor", orgId: "org" } as const
  const own = base()
  const fromOrg = base({ id: "t2", orgId: "org", authorId: "m" })

  it("student: toggles any of their tasks, edits/deletes only their own", () => {
    expect(canToggleTask(own, student)).toBe(true)
    expect(canToggleTask(fromOrg, student)).toBe(true)
    expect(canEditTask(own, student)).toBe(true)
    expect(canEditTask(fromOrg, student)).toBe(false)
    expect(canDeleteTask(own, student)).toBe(true)
    expect(canDeleteTask(fromOrg, student)).toBe(false)
  })

  it("mentor: only the organization's tasks", () => {
    expect(canToggleTask(own, mentor)).toBe(false)
    expect(canToggleTask(fromOrg, mentor)).toBe(true)
    expect(canEditTask(fromOrg, mentor)).toBe(true)
    expect(canDeleteTask(fromOrg, mentor)).toBe(true)
    expect(canEditTask(base({ orgId: "other" }), mentor)).toBe(false)
  })
})

describe("task reducers", () => {
  it("cleanTaskInput trims, caps, validates the date", () => {
    expect(cleanTaskInput({ title: "   " })).toBeNull()
    expect(cleanTaskInput({ title: " x ".padEnd(200, "y"), dueOn: "2026-13-99", universityId: " ", details: "  " })).toMatchObject({
      dueOn: null,
      universityId: null,
      details: null,
    })
    expect(cleanTaskInput({ title: "a" })!.title).toBe("a")
    expect(cleanTaskInput({ title: "a", dueOn: "2026-12-01" })!.dueOn).toBe("2026-12-01")
  })

  it("upsert / patch / remove never mutate", () => {
    const l0 = [base()]
    const l1 = upsertTask(l0, base({ id: "t2" }))
    expect(l0).toHaveLength(1)
    expect(l1.map((t) => t.id)).toEqual(["t1", "t2"])
    const l2 = patchTask(l1, "t1", { doneAt: "2026-09-02T00:00:00Z" }, new Date("2026-09-02T00:00:00Z"))
    expect(l1[0].doneAt).toBeNull()
    expect(l2[0].doneAt).toBe("2026-09-02T00:00:00Z")
    expect(l2[0].updatedAt).toBe("2026-09-02T00:00:00.000Z")
    expect(removeTask(l2, "t2").map((t) => t.id)).toEqual(["t1"])
  })

  it("sortTasks: open by due date (undated last), then done by completion", () => {
    const list = [
      base({ id: "u", dueOn: null }),
      base({ id: "d1", dueOn: "2026-10-01", doneAt: "2026-09-05T00:00:00Z" }),
      base({ id: "b", dueOn: "2026-10-02" }),
      base({ id: "a", dueOn: "2026-10-01" }),
      base({ id: "d2", doneAt: "2026-09-06T00:00:00Z" }),
    ]
    expect(sortTasks(list).map((t) => t.id)).toEqual(["a", "b", "u", "d2", "d1"])
  })

  it("normalizeTasks drops garbage and duplicates", () => {
    expect(normalizeTasks("x")).toEqual([])
    const out = normalizeTasks([{ id: "1", title: "ok", dueOn: "bad" }, { id: "1", title: "dup" }, { title: "no id" }, null])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: "1", title: "ok", dueOn: null, studentId: "local" })
  })
})

describe("localTaskStore", () => {
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

  it("adds, updates and removes in admitica.cn.tasks", async () => {
    const store = localTaskStore(() => new Date("2026-09-07T10:00:00Z"))
    const t = await store.add({ title: "Собрать документы", dueOn: "2026-12-01" })
    expect(t.studentId).toBe("local")
    expect(JSON.parse(mem.get("admitica.cn.tasks")!)).toHaveLength(1)
    await store.update(t.id, { doneAt: "2026-09-08T00:00:00Z" })
    expect((await store.list())[0].doneAt).toBe("2026-09-08T00:00:00Z")
    await store.remove(t.id)
    expect(await store.list()).toEqual([])
    await expect(store.add({ title: "  " })).rejects.toThrow("empty_title")
  })
})

describe("remoteTaskStore (mock client)", () => {
  it("student adds to themself; mentor adds for the organization; refusals as in RLS", async () => {
    const be = createFakeBackend({ storage: null, now: () => new Date("2026-09-07T10:00:00Z") })
    const lena = be.state.users.find((u) => u.email === DEMO_STUDENT_EMAIL)!
    const mentor = be.state.users.find((u) => u.email === DEMO_MENTOR_EMAIL)!
    be.signInAs(lena.id)
    const mine = remoteTaskStore(be.data, { studentId: lena.id, authorId: lena.id, orgId: null })
    const before = (await mine.list()).length
    const t = await mine.add({ title: "Записаться на HSK" })
    expect(t.orgId).toBeNull()
    expect((await mine.list()).length).toBe(before + 1)
    // the mentor's task: only done_at
    const orgTask = be.state.tasks.find((x) => x.studentId === lena.id && x.orgId !== null && x.doneAt === null)!
    await mine.update(orgTask.id, { doneAt: "2026-09-07T11:00:00Z" })
    await expect(mine.update(orgTask.id, { title: "x" })).rejects.toThrow(/only done_at/)
    await mine.remove(orgTask.id)
    expect(be.state.tasks.some((x) => x.id === orgTask.id)).toBe(true)

    be.signInAs(mentor.id)
    const theirs = remoteTaskStore(be.data, { studentId: lena.id, authorId: mentor.id, orgId: "org-zhuiqiu" })
    const m = await theirs.add({ title: "Прислать транскрипт", dueOn: "2026-10-01", universityId: "tsinghua-university" })
    expect(m.orgId).toBe("org-zhuiqiu")
    await theirs.remove(t.id) // the student's own task – refused silently
    expect(be.state.tasks.some((x) => x.id === t.id)).toBe(true)
    await theirs.remove(m.id)
    expect(be.state.tasks.some((x) => x.id === m.id)).toBe(false)
  })
})
