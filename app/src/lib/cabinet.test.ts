import { describe, expect, it } from "vitest"

import { createFakeBackend, DEMO_MENTOR_EMAIL, DEMO_ORG_CODE } from "@/auth/fakeBackend"
import { normalizeCatalog } from "@/data/china"
import {
  CabinetError,
  errorMessageRu,
  isUrgent,
  lastSeenLabel,
  orgToPartner,
  serializeAccount,
  shouldTouchLastSeen,
  studentLabel,
  studentRows,
  telegramUrl,
} from "./cabinet"
import { hasLead } from "./partner"

const NOW = new Date("2026-09-07T12:00:00Z")
/** The seed of the fake backend uses the ids of the real export, so the table is computed against it. */
const exportFiles = import.meta.glob("../../public/data/china.json", { eager: true, import: "default" })
const CATALOG = normalizeCatalog(Object.values(exportFiles)[0])

describe("display helpers", () => {
  it("studentLabel: nick or «ученик #xxxx»", () => {
    expect(studentLabel({ userId: "a1b2c3d4-0000", nick: null })).toBe("ученик #a1b2")
    expect(studentLabel({ userId: "a1b2", nick: "  Лена " })).toBe("Лена")
  })

  it("telegramUrl validates the handle", () => {
    expect(telegramUrl("@zhuiqiu_yu")).toBe("https://t.me/zhuiqiu_yu")
    expect(telegramUrl("bad handle")).toBeNull()
    expect(telegramUrl(null)).toBeNull()
  })

  it("orgToPartner: brand + lead to Telegram, no expert page", () => {
    const p = orgToPartner({ id: "1", slug: "zhuiqiu", name: "Zhuiqiu", tagline: "t", telegram: "zhuiqiu_yu", createdAt: "" })
    expect(p.slug).toBe("org:zhuiqiu")
    expect(hasLead(p)).toBe(true)
    expect(p.lead?.url).toBe("https://t.me/zhuiqiu_yu")
    expect(p.expertPage).toBeUndefined()
    expect(hasLead(orgToPartner({ id: "1", slug: "x", name: "X", tagline: null, telegram: null, createdAt: "" }))).toBe(false)
  })

  it("last visit", () => {
    expect(shouldTouchLastSeen(null, NOW)).toBe(true)
    expect(shouldTouchLastSeen("2026-09-07T11:30:00Z", NOW)).toBe(false)
    expect(shouldTouchLastSeen("2026-09-07T10:59:00Z", NOW)).toBe(true)
    expect(lastSeenLabel(null, NOW)).toBe("не заходил")
    expect(lastSeenLabel("2026-09-07T09:00:00Z", NOW)).toBe("сегодня")
    expect(lastSeenLabel("2026-09-06T09:00:00Z", NOW)).toBe("вчера")
    expect(lastSeenLabel("2026-09-04T09:00:00Z", NOW)).toBe("3 дня назад")
    expect(lastSeenLabel("2026-08-20T09:00:00Z", NOW)).toBe("2 недели назад")
  })

  it("errors have Russian wording", () => {
    expect(errorMessageRu(new CabinetError("invalid_code"))).toMatch(/Код приглашения/)
    expect(errorMessageRu(new Error("x"))).toMatch(/Что-то пошло не так/)
  })
})

describe("studentRows (mentor table)", () => {
  it("nearest deadline from plan + tasks, docs %, open tasks, sorted by deadline", async () => {
    const be = createFakeBackend({ storage: null, now: () => NOW })
    const mentor = be.state.users.find((u) => u.email === DEMO_MENTOR_EMAIL)!
    be.signInAs(mentor.id)
    const students = await be.data.listStudents("org-zhuiqiu")
    const rows = studentRows(students, CATALOG, NOW)
    expect(rows.map((r) => r.label)).toEqual(["ученик #ub7c", "Лена", "Марк"])
    const b = rows[0]
    expect(b.nextDeadline?.daysLeft).toBe(1)
    expect(isUrgent(b)).toBe(true)
    expect(b.openTasks).toBe(1)
    const lena = rows[1]
    expect(lena.universities).toBe(2)
    expect(lena.nextDeadline?.title).toMatch(/мотивационное/)
    expect(lena.docsDone).toBe(3)
    expect(lena.docsTotal).toBeGreaterThan(3)
    expect(lena.openTasks).toBe(2)
    const mark = rows[2]
    expect(mark.nextDeadline).toBeNull()
    expect(mark.docsPct).toBe(0)
    expect(isUrgent(mark)).toBe(false)
  })
})

describe("account export", () => {
  it("serializes everything the account holds", async () => {
    const be = createFakeBackend({ storage: null, now: () => NOW })
    const lena = be.state.users.find((u) => u.email === "student@demo.abitura")!
    be.signInAs(lena.id)
    const profile = await be.data.getProfile(lena.id)
    const org = (await be.data.getMyOrg(lena.id))!.org
    const json = serializeAccount(
      {
        email: lena.email,
        profile,
        organization: org,
        plan: await be.data.loadPlan(lena.id),
        tasks: await be.data.listTasks(lena.id),
        notes: await be.data.listNotes(lena.id),
      },
      NOW,
    )
    const parsed = JSON.parse(json)
    expect(parsed.format).toBe("admitica.cn.account")
    expect(parsed.account.email).toBe("student@demo.abitura")
    expect(parsed.onboarding.ielts).toBe(6.5)
    expect(parsed.organization.slug).toBe("zhuiqiu")
    expect(parsed.plan.universities).toHaveLength(2)
    expect(parsed.tasks.length).toBeGreaterThan(0)
    expect(parsed.mentor_notes[0].body).toMatch(/IELTS/)
  })
})

describe("fake backend follows the spec's rules", () => {
  it("join_org: invalid code, second organization, idempotent repeat; removal by a member", async () => {
    const be = createFakeBackend({ storage: null, now: () => NOW })
    const u = be.addUser("new@example.test")
    be.signInAs(u.id)
    await expect(be.data.joinOrg("NOPE-1")).rejects.toMatchObject({ code: "invalid_code" })
    const org = await be.data.joinOrg(` ${DEMO_ORG_CODE.toLowerCase()} `)
    expect(org.name).toBe("Zhuiqiu")
    expect((await be.data.getMyOrg(u.id))?.org.slug).toBe("zhuiqiu")
    await be.data.joinOrg(DEMO_ORG_CODE)
    expect(be.state.mentorships.filter((m) => m.studentId === u.id)).toHaveLength(1)
    be.state.orgs.push({ ...be.state.orgs[0], id: "org-2", slug: "two", inviteCode: "TWO-1234" })
    await expect(be.data.joinOrg("TWO-1234")).rejects.toMatchObject({ code: "already_in_org" })

    await expect(be.data.removeStudent("org-zhuiqiu", u.id)).rejects.toMatchObject({ code: "not_a_member" })
    const mentor = be.state.users.find((x) => x.email === DEMO_MENTOR_EMAIL)!
    be.signInAs(mentor.id)
    expect(await be.data.removeStudent("org-zhuiqiu", u.id)).toBe(true)
    expect(await be.data.removeStudent("org-zhuiqiu", u.id)).toBe(false)
    expect(await be.data.getMyOrg(u.id)).toBeNull()
  })

  it("delete_own_account removes every row of the user and signs out", async () => {
    const be = createFakeBackend({ storage: null, now: () => NOW })
    be.signInAs("u-lena")
    let seen: unknown = "unset"
    be.auth.onChange((u) => (seen = u))
    await be.data.deleteOwnAccount()
    expect(seen).toBeNull()
    expect(be.state.profiles.some((p) => p.userId === "u-lena")).toBe(false)
    expect(be.state.tasks.some((t) => t.studentId === "u-lena")).toBe(false)
    expect(be.state.notes.some((n) => n.studentId === "u-lena")).toBe(false)
    expect(be.state.planItems.some((i) => i.studentId === "u-lena")).toBe(false)
  })

  it("organization settings: admin only; members list; add by email", async () => {
    const be = createFakeBackend({ storage: null, now: () => NOW })
    be.signInAs("u-mentor2")
    await expect(be.data.updateOrg("org-zhuiqiu", { name: "x" })).rejects.toMatchObject({ code: "not_an_admin" })
    await expect(be.data.reissueInvite("org-zhuiqiu")).rejects.toMatchObject({ code: "not_an_admin" })
    expect(await be.data.getInviteCode("org-zhuiqiu")).toBe(DEMO_ORG_CODE)
    be.signInAs("u-mentor")
    await expect(be.data.addMemberByEmail("org-zhuiqiu", "nobody@example.test", "mentor")).rejects.toMatchObject({ code: "user_not_found" })
    await be.data.addMemberByEmail("org-zhuiqiu", "STUDENT3@demo.abitura", "mentor")
    expect((await be.data.listMembers("org-zhuiqiu")).map((m) => m.email)).toContain("student3@demo.abitura")
    const code = await be.data.reissueInvite("org-zhuiqiu")
    expect(code).toMatch(/^ZHUIQIU-[A-Z2-9]{4}$/)
    expect(await be.data.getInviteCode("org-zhuiqiu")).toBe(code)
    be.signInAs("u-lena")
    expect(await be.data.getInviteCode("org-zhuiqiu")).toBeNull()
  })
})
