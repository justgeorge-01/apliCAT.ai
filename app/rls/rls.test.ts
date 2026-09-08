/**
 * RLS-тесты кабинета (SPEC-cabinet §2) против РЕАЛЬНОЙ базы Supabase.
 *
 * Запуск: `npm run test:rls` (или `npm test`) при заданном SUPABASE_DB_URL в
 * app/.env.local. Без него набор пропускается с явным сообщением.
 *
 * Как устроено: одно соединение postgres (Session Pooler). Каждый запрос «от
 * имени пользователя» выполняется в транзакции ровно так, как это делает
 * PostgREST: `set_config('request.jwt.claims', …)` + `set local role
 * authenticated` (или anon). Тестовые пользователи создаются вставкой в
 * auth.users (это же проверяет триггер handle_new_user) и удаляются в конце
 * вместе с тестовыми организациями. Через GoTrue/HTTP ничего не ходит.
 *
 * Роли: A, B – ученики; C – ученик организации Y; M1 – admin организации X,
 * M2 – mentor организации X; N – член организации Y.
 */
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import pg from "pg"

/* ---------- env ---------- */

function loadEnvLocal(): void {
  const file = path.resolve(__dirname, "..", ".env.local")
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = value
  }
}
loadEnvLocal()

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) {
  console.warn(
    "\n[rls] SUPABASE_DB_URL не задан – RLS-тесты пропущены. Положите строку Session Pooler (порт 5432) в app/.env.local и запустите `npm run test:rls`.\n",
  )
}

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 })

/* ---------- helpers ---------- */

type Row = Record<string, unknown>
let db: pg.Client

async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.query(text, params)
  return r.rows as T[]
}

/** Выполняет запрос как PostgREST от имени пользователя (uid) или anon (null). */
async function as<T extends Row = Row>(uid: string | null, text: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
  await db.query("begin")
  try {
    const claims = uid ? { sub: uid, role: "authenticated", aud: "authenticated" } : { role: "anon" }
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)])
    await db.query(uid ? "set local role authenticated" : "set local role anon")
    const r = await db.query(text, params)
    await db.query("commit")
    return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 }
  } catch (e) {
    await db.query("rollback")
    throw e
  }
}

/** Ожидает отказ: RLS / гранты (42501) или ошибку функции с данным текстом. */
async function denied(p: Promise<unknown>, match: string | RegExp = /42501|permission denied|row-level security/i): Promise<void> {
  let err: unknown = null
  try {
    await p
  } catch (e) {
    err = e
  }
  expect(err, "ожидался отказ, а запрос прошёл").not.toBeNull()
  const e = err as { code?: string; message?: string }
  const text = `${e.code ?? ""} ${e.message ?? ""}`
  expect(text).toMatch(match)
}

const EMAIL_DOMAIN = "example.invalid"
const emailOf = (tag: string) => `rls-test+${tag}@${EMAIL_DOMAIN}`

async function createUser(tag: string, consentAt = "2026-09-01T00:00:00Z"): Promise<string> {
  const id = randomUUID()
  await sql(
    `insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(),
       '{"provider":"email","providers":["email"]}'::jsonb, $3::jsonb, now(), now())`,
    [id, emailOf(tag), JSON.stringify({ consent_at: consentAt })],
  )
  return id
}

async function cleanup(): Promise<void> {
  await sql(`delete from auth.users where email like $1`, [`rls-test+%@${EMAIL_DOMAIN}`])
  await sql(`delete from public.organizations where slug like 'rls-test-%'`)
}

/* ---------- fixtures ---------- */

let A = "", B = "", C = "", M1 = "", M2 = "", N = ""
let X = "", Y = ""
const CODE_X = "RLS-TEST-X-1"
const CODE_Y = "RLS-TEST-Y-1"
const U1 = "tsinghua"
const U2 = "zju"

describe.skipIf(!DB_URL)("RLS кабинета (реальная база)", () => {
  beforeAll(async () => {
    db = new pg.Client({
      connectionString: DB_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DB_URL ?? "") ? undefined : { rejectUnauthorized: false },
    })
    await db.connect()
    await cleanup()
    ;[A, B, C, M1, M2, N] = await Promise.all(["a", "b", "c", "m1", "m2", "n"].map((t) => createUser(t)))
    const orgs = await sql<{ id: string; slug: string }>(
      `insert into public.organizations (slug, name, tagline, telegram, invite_code)
       values ('rls-test-x', 'Org X', 'слоган X', 'org_x', $1), ('rls-test-y', 'Org Y', null, null, $2)
       returning id, slug`,
      [CODE_X, CODE_Y],
    )
    X = orgs.find((o) => o.slug === "rls-test-x")!.id
    Y = orgs.find((o) => o.slug === "rls-test-y")!.id
    await sql(
      `insert into public.org_members (org_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'mentor'), ($4, $5, 'mentor')`,
      [X, M1, M2, Y, N],
    )
    // ученики привязываются ровно так, как в приложении – через join_org
    await as(A, "select public.join_org($1)", [CODE_X])
    await as(C, "select public.join_org($1)", [CODE_Y])
  })

  afterAll(async () => {
    if (!db) return
    try {
      await cleanup()
    } finally {
      await db.end()
    }
  })

  /* ---------- profiles ---------- */

  it("триггер handle_new_user создаёт профиль с consent_at из метаданных", async () => {
    const rows = await sql<{ user_id: string; consent_at: Date }>(
      "select user_id, consent_at from public.profiles where user_id = any($1)",
      [[A, B, C, M1, M2, N]],
    )
    expect(rows).toHaveLength(6)
    expect(new Date(rows.find((r) => r.user_id === A)!.consent_at).toISOString()).toBe("2026-09-01T00:00:00.000Z")
  })

  it("profiles: читает сам и члены его активной организации, никто больше", async () => {
    expect((await as(A, "select user_id from public.profiles")).rows.map((r) => r.user_id)).toEqual([A])
    expect((await as(B, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(0)
    expect((await as(M1, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(1)
    expect((await as(M2, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(1)
    expect((await as(M1, "select user_id from public.profiles where user_id = $1", [B])).rowCount).toBe(0)
    expect((await as(N, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(0)
    await denied(as(null, "select user_id from public.profiles"))
  })

  it("profiles: пишет только сам и только nick / onboarding / last_seen_at", async () => {
    expect((await as(A, "update public.profiles set nick = 'Аня', onboarding = '{\"degree\":\"bachelor\"}', last_seen_at = now() where user_id = $1", [A])).rowCount).toBe(1)
    expect((await as(A, "update public.profiles set nick = 'x' where user_id = $1", [B])).rowCount).toBe(0)
    expect((await as(M1, "update public.profiles set nick = 'x' where user_id = $1", [A])).rowCount).toBe(0)
    await denied(as(A, "update public.profiles set consent_at = now() where user_id = $1", [A]))
    await denied(as(A, "insert into public.profiles (user_id) values ($1)", [randomUUID()]))
    await denied(as(A, "delete from public.profiles where user_id = $1", [A]))
  })

  /* ---------- organizations ---------- */

  it("organizations: читают члены и ученик своей активной организации (без invite_code)", async () => {
    const cols = "id, slug, name, tagline, telegram, created_at"
    expect((await as(M1, `select ${cols} from public.organizations where id = $1`, [X])).rowCount).toBe(1)
    expect((await as(M2, `select ${cols} from public.organizations where id = $1`, [X])).rowCount).toBe(1)
    const brand = await as<{ name: string; telegram: string }>(A, `select ${cols} from public.organizations`)
    expect(brand.rows.map((r) => r.name)).toEqual(["Org X"])
    expect(brand.rows[0].telegram).toBe("org_x")
    expect((await as(B, `select ${cols} from public.organizations`)).rowCount).toBe(0)
    expect((await as(N, `select ${cols} from public.organizations where id = $1`, [X])).rowCount).toBe(0)
    await denied(as(A, "select invite_code from public.organizations where id = $1", [X]))
    await denied(as(M1, "select invite_code from public.organizations where id = $1", [X]))
    await denied(as(null, `select ${cols} from public.organizations`))
  })

  it("organizations: меняет только admin", async () => {
    expect((await as(M2, "update public.organizations set name = 'hack' where id = $1", [X])).rowCount).toBe(0)
    expect((await as(A, "update public.organizations set name = 'hack' where id = $1", [X])).rowCount).toBe(0)
    expect((await as(M1, "update public.organizations set tagline = 'новый слоган' where id = $1", [X])).rowCount).toBe(1)
    await denied(as(M1, "update public.organizations set invite_code = 'HACK-1' where id = $1", [X]))
    await denied(as(M1, "insert into public.organizations (slug, name) values ('rls-test-z', 'Z')"))
    await denied(as(M1, "delete from public.organizations where id = $1", [X]))
  })

  it("org_invite_code / org_reissue_invite: код видят члены, перевыпускает admin", async () => {
    expect((await as<{ c: string }>(M2, "select public.org_invite_code($1) as c", [X])).rows[0].c).toBe(CODE_X)
    expect((await as<{ c: string }>(A, "select public.org_invite_code($1) as c", [X])).rows[0].c).toBeNull()
    expect((await as<{ c: string }>(N, "select public.org_invite_code($1) as c", [X])).rows[0].c).toBeNull()
    await denied(as(M2, "select public.org_reissue_invite($1)", [X]), /not_an_admin/)
    const fresh = (await as<{ c: string }>(M1, "select public.org_reissue_invite($1) as c", [X])).rows[0].c
    expect(fresh).toMatch(/^RLS-TEST-X-[A-Z2-9]{4}$/)
    // старый код больше не работает, привязка A не тронута
    await denied(as(B, "select public.join_org($1)", [CODE_X]), /invalid_code/)
    expect((await as(A, "select 1 from public.mentorships where org_id = $1 and status = 'active'", [X])).rowCount).toBe(1)
    // вернём известный код для остальных тестов
    await sql("update public.organizations set invite_code = $1 where id = $2", [CODE_X, X])
  })

  /* ---------- org_members ---------- */

  it("org_members: читают члены той же организации, пишет admin", async () => {
    expect((await as(M2, "select user_id from public.org_members where org_id = $1", [X])).rowCount).toBe(2)
    expect((await as(N, "select user_id from public.org_members where org_id = $1", [X])).rowCount).toBe(0)
    expect((await as(A, "select user_id from public.org_members")).rowCount).toBe(0)
    await denied(as(M2, "insert into public.org_members (org_id, user_id, role) values ($1, $2, 'mentor')", [X, B]))
    await denied(as(N, "insert into public.org_members (org_id, user_id, role) values ($1, $2, 'mentor')", [X, N]))
    expect((await as(M1, "insert into public.org_members (org_id, user_id, role) values ($1, $2, 'mentor')", [X, B])).rowCount).toBe(1)
    expect((await as(M2, "delete from public.org_members where org_id = $1 and user_id = $2", [X, B])).rowCount).toBe(0)
    expect((await as(M2, "update public.org_members set role = 'admin' where org_id = $1 and user_id = $2", [X, M2])).rowCount).toBe(0)
    expect((await as(M1, "delete from public.org_members where org_id = $1 and user_id = $2", [X, B])).rowCount).toBe(1)
  })

  it("org_members_list / org_add_member_by_email", async () => {
    const list = await as<{ email: string; role: string }>(M2, "select * from public.org_members_list($1)", [X])
    expect(list.rows.map((r) => r.email).sort()).toEqual([emailOf("m1"), emailOf("m2")].sort())
    expect((await as(A, "select * from public.org_members_list($1)", [X])).rowCount).toBe(0)
    expect((await as(N, "select * from public.org_members_list($1)", [X])).rowCount).toBe(0)
    await denied(as(M2, "select public.org_add_member_by_email($1, $2)", [X, emailOf("b")]), /not_an_admin/)
    await denied(as(M1, "select public.org_add_member_by_email($1, $2)", [X, "nobody@example.invalid"]), /user_not_found/)
    expect((await as<{ id: string }>(M1, "select public.org_add_member_by_email($1, $2, 'mentor') as id", [X, emailOf("b").toUpperCase()])).rows[0].id).toBe(B)
    expect((await as(M1, "delete from public.org_members where org_id = $1 and user_id = $2", [X, B])).rowCount).toBe(1)
  })

  /* ---------- mentorships / join_org ---------- */

  it("mentorships: ученик видит свои, члены – своей организации; напрямую не пишется", async () => {
    expect((await as(A, "select org_id from public.mentorships")).rows.map((r) => r.org_id)).toEqual([X])
    expect((await as(B, "select org_id from public.mentorships")).rowCount).toBe(0)
    expect((await as(M2, "select student_id from public.mentorships where org_id = $1", [X])).rows.map((r) => r.student_id)).toEqual([A])
    expect((await as(N, "select student_id from public.mentorships where org_id = $1", [X])).rowCount).toBe(0)
    await denied(as(B, "insert into public.mentorships (student_id, org_id) values ($1, $2)", [B, X]))
    await denied(as(M1, "insert into public.mentorships (student_id, org_id) values ($1, $2)", [B, X]))
    await denied(as(A, "update public.mentorships set status = 'removed' where student_id = $1", [A]))
    await denied(as(M1, "delete from public.mentorships where student_id = $1", [A]))
  })

  it("join_org: чужой/неверный код – отказ, вторая организация – отказ, повтор своего – без ошибки", async () => {
    await denied(as(B, "select public.join_org('NO-SUCH-CODE')"), /invalid_code/)
    await denied(as(A, "select public.join_org($1)", [CODE_Y]), /already_in_org/)
    const again = await as<{ j: { name: string } }>(A, "select public.join_org($1) as j", [` ${CODE_X.toLowerCase()} `])
    expect(again.rows[0].j.name).toBe("Org X")
    expect((await sql("select 1 from public.mentorships where student_id = $1 and status = 'active'", [A])).length).toBe(1)
    await denied(as(null, "select public.join_org($1)", [CODE_X]))
  })

  /* ---------- plan_items / plan_docs ---------- */

  it("plan_items: пишет только ученик, читают ученик и члены его организации", async () => {
    expect((await as(A, "insert into public.plan_items (student_id, university_id, status) values ($1, $2, 'preparing'), ($1, $3, 'considering')", [A, U1, U2])).rowCount).toBe(2)
    await denied(as(A, "insert into public.plan_items (student_id, university_id) values ($1, $2)", [B, U1]))
    await denied(as(M1, "insert into public.plan_items (student_id, university_id) values ($1, 'sjtu')", [A]))
    expect((await as(B, "select university_id from public.plan_items where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(M2, "select university_id from public.plan_items where student_id = $1", [A])).rowCount).toBe(2)
    expect((await as(N, "select university_id from public.plan_items where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(M1, "update public.plan_items set status = 'applied' where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(B, "delete from public.plan_items where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(A, "update public.plan_items set note = 'заметка' where student_id = $1 and university_id = $2", [A, U1])).rowCount).toBe(1)
  })

  it("plan_docs: done_at следует за done, удаление вуза уносит его документы", async () => {
    expect((await as(A, "insert into public.plan_docs (student_id, university_id, doc_id, done) values ($1, $2, 'passport', true)", [A, U2])).rowCount).toBe(1)
    const d1 = await as<{ done_at: Date | null }>(A, "select done_at from public.plan_docs where student_id = $1 and doc_id = 'passport'", [A])
    expect(d1.rows[0].done_at).not.toBeNull()
    expect((await as(A, "update public.plan_docs set done = false where student_id = $1 and doc_id = 'passport'", [A])).rowCount).toBe(1)
    const d2 = await as<{ done_at: Date | null }>(A, "select done_at from public.plan_docs where student_id = $1 and doc_id = 'passport'", [A])
    expect(d2.rows[0].done_at).toBeNull()
    expect((await as(M2, "select doc_id from public.plan_docs where student_id = $1", [A])).rowCount).toBe(1)
    expect((await as(B, "select doc_id from public.plan_docs where student_id = $1", [A])).rowCount).toBe(0)
    await denied(as(M2, "insert into public.plan_docs (student_id, university_id, doc_id, done) values ($1, $2, 'photo', true)", [A, U2]))
    expect((await as(A, "delete from public.plan_items where student_id = $1 and university_id = $2", [A, U2])).rowCount).toBe(1)
    expect((await sql("select 1 from public.plan_docs where student_id = $1", [A])).length).toBe(0)
  })

  /* ---------- tasks ---------- */

  let ownTask = ""
  let ownTask2 = ""
  let orgTask = ""

  it("tasks insert: ученик – себе без org_id; член – своей организации её ученику", async () => {
    ownTask = (await as<{ id: string }>(A, "insert into public.tasks (student_id, author_id, title, due_on) values ($1, $1, 'Собрать документы', '2026-12-01') returning id", [A])).rows[0].id
    ownTask2 = (await as<{ id: string }>(A, "insert into public.tasks (student_id, author_id, title) values ($1, $1, 'Личная задача') returning id", [A])).rows[0].id
    await denied(as(A, "insert into public.tasks (student_id, org_id, author_id, title) values ($1, $2, $1, 'x')", [A, X]))
    await denied(as(A, "insert into public.tasks (student_id, author_id, title) values ($1, $2, 'x')", [A, B]))
    await denied(as(B, "insert into public.tasks (student_id, author_id, title) values ($1, $2, 'x')", [A, B]))
    orgTask = (await as<{ id: string }>(M2, "insert into public.tasks (student_id, org_id, author_id, title, university_id) values ($1, $2, $3, 'Прислать мотивационное', $4) returning id", [A, X, M2, U1])).rows[0].id
    await denied(as(N, "insert into public.tasks (student_id, org_id, author_id, title) values ($1, $2, $3, 'x')", [A, Y, N]))
    await denied(as(M2, "insert into public.tasks (student_id, org_id, author_id, title) values ($1, $2, $3, 'x')", [B, X, M2]))
    await denied(as(M2, "insert into public.tasks (student_id, author_id, title) values ($1, $2, 'x')", [A, M2]))
  })

  it("tasks select: ученик и члены его организации", async () => {
    expect((await as(A, "select id from public.tasks")).rowCount).toBe(3)
    expect((await as(M1, "select id from public.tasks where student_id = $1", [A])).rowCount).toBe(3)
    expect((await as(B, "select id from public.tasks")).rowCount).toBe(0)
    expect((await as(N, "select id from public.tasks where student_id = $1", [A])).rowCount).toBe(0)
  })

  it("tasks update: ученик отмечает задачу наставника выполненной, но не правит её", async () => {
    expect((await as(A, "update public.tasks set done_at = now() where id = $1", [orgTask])).rowCount).toBe(1)
    expect((await as(A, "update public.tasks set done_at = null where id = $1", [orgTask])).rowCount).toBe(1)
    await denied(as(A, "update public.tasks set title = 'другое' where id = $1", [orgTask]), /only mark|42501/)
    await denied(as(A, "update public.tasks set due_on = '2027-01-01' where id = $1", [orgTask]), /only mark|42501/)
    expect((await as(A, "update public.tasks set title = 'Собрать все документы', due_on = '2026-11-30' where id = $1", [ownTask])).rowCount).toBe(1)
    expect((await as(M2, "update public.tasks set title = 'Прислать мотивационное письмо' where id = $1", [orgTask])).rowCount).toBe(1)
    expect((await as(M2, "update public.tasks set done_at = now() where id = $1", [ownTask])).rowCount).toBe(0)
    expect((await as(N, "update public.tasks set title = 'x' where id = $1", [orgTask])).rowCount).toBe(0)
    await denied(as(M2, "update public.tasks set student_id = $1 where id = $2", [B, orgTask]), /immutable|23514/)
    await denied(as(M2, "update public.tasks set org_id = null where id = $1", [orgTask]), /immutable|23514/)
  })

  it("tasks delete: ученик – только свои себе; член – задачи своей организации", async () => {
    expect((await as(A, "delete from public.tasks where id = $1", [orgTask])).rowCount).toBe(0)
    expect((await as(M2, "delete from public.tasks where id = $1", [ownTask2])).rowCount).toBe(0)
    expect((await as(N, "delete from public.tasks where id = $1", [orgTask])).rowCount).toBe(0)
    expect((await as(A, "delete from public.tasks where id = $1", [ownTask2])).rowCount).toBe(1)
    expect((await as(M1, "delete from public.tasks where id = $1", [orgTask])).rowCount).toBe(1)
    // задача организации для последующих проверок каскада
    orgTask = (await as<{ id: string }>(M2, "insert into public.tasks (student_id, org_id, author_id, title) values ($1, $2, $3, 'Ещё задача') returning id", [A, X, M2])).rows[0].id
  })

  /* ---------- mentor_notes ---------- */

  it("mentor_notes: пишут члены своей организации о своём ученике, ученик только читает", async () => {
    expect((await as(M2, "insert into public.mentor_notes (org_id, student_id, university_id, body, author_id) values ($1, $2, $3, 'Сначала HSK 5', $4)", [X, A, U1, M2])).rowCount).toBe(1)
    await denied(as(N, "insert into public.mentor_notes (org_id, student_id, university_id, body, author_id) values ($1, $2, $3, 'x', $4)", [Y, A, U1, N]))
    await denied(as(M2, "insert into public.mentor_notes (org_id, student_id, university_id, body, author_id) values ($1, $2, $3, 'x', $4)", [X, B, U1, M2]))
    await denied(as(M2, "insert into public.mentor_notes (org_id, student_id, university_id, body, author_id) values ($1, $2, $3, 'x', $4)", [X, A, U2, M1]))
    await denied(as(A, "insert into public.mentor_notes (org_id, student_id, university_id, body, author_id) values ($1, $2, $3, 'x', $2)", [X, A, U2]))
    expect((await as<{ body: string }>(A, "select body from public.mentor_notes")).rows.map((r) => r.body)).toEqual(["Сначала HSK 5"])
    expect((await as(M1, "select body from public.mentor_notes where student_id = $1", [A])).rowCount).toBe(1)
    expect((await as(B, "select body from public.mentor_notes")).rowCount).toBe(0)
    expect((await as(N, "select body from public.mentor_notes where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(A, "update public.mentor_notes set body = 'hack' where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(A, "delete from public.mentor_notes where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(M1, "update public.mentor_notes set body = 'HSK 5 и IELTS', author_id = $1 where student_id = $2 and university_id = $3", [M1, A, U1])).rowCount).toBe(1)
    await denied(as(M1, "update public.mentor_notes set body = 'x', author_id = $1 where student_id = $2", [M2, A]))
  })

  /* ---------- org_remove_student ---------- */

  it("org_remove_student: только член организации; ученик после этого не видит организацию", async () => {
    await denied(as(N, "select public.org_remove_student($1, $2)", [X, A]), /not_a_member/)
    await denied(as(A, "select public.org_remove_student($1, $2)", [X, A]), /not_a_member/)
    expect((await as<{ ok: boolean }>(M2, "select public.org_remove_student($1, $2) as ok", [X, A])).rows[0].ok).toBe(true)
    expect((await as<{ ok: boolean }>(M2, "select public.org_remove_student($1, $2) as ok", [X, A])).rows[0].ok).toBe(false)
    const m = await as<{ status: string; removed_by: string }>(A, "select status, removed_by from public.mentorships where org_id = $1", [X])
    expect(m.rows[0].status).toBe("removed")
    expect(m.rows[0].removed_by).toBe(M2)
    expect((await as(M2, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(0)
    expect((await as(M2, "select university_id from public.plan_items where student_id = $1", [A])).rowCount).toBe(0)
    expect((await as(A, "select id from public.organizations")).rowCount).toBe(0)
    expect((await as(A, "select body from public.mentor_notes")).rowCount).toBe(0)
    // задача организации осталась у ученика и всё ещё только помечается
    expect((await as(A, "select id from public.tasks where id = $1", [orgTask])).rowCount).toBe(1)
    await denied(as(A, "update public.tasks set title = 'x' where id = $1", [orgTask]), /only mark|42501/)
    // теперь ученик может подключиться к другой организации и вернуться обратно
    await as(A, "select public.join_org($1)", [CODE_Y])
    expect((await as(N, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(1)
    await as(N, "select public.org_remove_student($1, $2)", [Y, A])
    await as(A, "select public.join_org($1)", [CODE_X])
    expect((await sql("select 1 from public.mentorships where student_id = $1 and status = 'active'", [A])).length).toBe(1)
    expect((await as(M2, "select user_id from public.profiles where user_id = $1", [A])).rowCount).toBe(1)
  })

  /* ---------- delete_own_account ---------- */

  it("delete_own_account: после удаления строк ученика нет нигде", async () => {
    await denied(as(null, "select public.delete_own_account()"))
    await as(A, "select public.delete_own_account()")
    expect((await sql("select 1 from auth.users where id = $1", [A])).length).toBe(0)
    for (const t of ["profiles", "plan_items", "plan_docs", "tasks", "mentorships", "mentor_notes"]) {
      const col = t === "profiles" ? "user_id" : "student_id"
      expect((await sql(`select 1 from public.${t} where ${col} = $1`, [A])).length, t).toBe(0)
    }
    // остальные не пострадали
    expect((await sql("select 1 from auth.users where id = any($1)", [[B, C, M1, M2, N]])).length).toBe(5)
    expect((await sql("select 1 from public.organizations where id = any($1)", [[X, Y]])).length).toBe(2)
  })
})
