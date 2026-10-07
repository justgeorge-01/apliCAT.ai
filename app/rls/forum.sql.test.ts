/**
 * Миграция форума (supabase/migrations/0002_forum.sql) на настоящем Postgres –
 * PGlite в памяти, без сети и без Supabase. Обвязка Supabase воспроизведена
 * минимально: роли anon / authenticated, схема extensions с pgcrypto,
 * request.headers как у PostgREST. Запросы «от посетителя» идут ровно как в
 * PostgREST: `set local role anon` в транзакции.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { NICK_ADJ_F, NICK_ADJ_M, NICK_ANIMALS_F, NICK_ANIMALS_M, nicknameFromKey, redactContacts } from "@/data/forum"

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

const SQL = readFileSync(path.resolve(__dirname, "../supabase/migrations/0002_forum.sql"), "utf8")
let db: PGlite

type Row = Record<string, unknown>

/** Как PostgREST: роль anon, заголовки запроса с IP. */
async function anon<T extends Row = Row>(text: string, params: unknown[] = [], ip = "203.0.113.7"): Promise<T[]> {
  await db.query("begin")
  try {
    await db.query("select set_config('request.headers', $1, true)", [JSON.stringify({ "x-forwarded-for": `${ip}, 10.0.0.1` })])
    await db.query("set local role anon")
    const r = await db.query<T>(text, params)
    await db.query("commit")
    return r.rows
  } catch (e) {
    await db.query("rollback")
    throw e
  }
}

async function fails(p: Promise<unknown>, match: RegExp): Promise<void> {
  let err: unknown = null
  try {
    await p
  } catch (e) {
    err = e
  }
  expect(err, "ожидался отказ").not.toBeNull()
  expect(String((err as Error).message)).toMatch(match)
}

const T = Array.from({ length: 40 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`)
let seq = 0
/** Свежий токен на каждый пост: лимит «раз в 15 секунд» – на автора. */
const fresh = () => T[seq++]

async function post(uni: string, body: string, token = fresh(), parent: number | null = null, role: string | null = null, ip?: string) {
  const [r] = await anon<{ r: { id: number; nickname: string; status: string } }>(
    "select public.forum_post($1, $2, $3::uuid, $4, $5) as r",
    [uni, body, token, parent, role],
    ip,
  )
  return r.r
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema extensions;
    grant usage on schema public to anon, authenticated;
    -- худший случай: проект создан с «Automatically expose new tables» – Supabase
    -- раздаёт права на всё новое; миграция обязана отозвать лишнее сама
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges grant all on tables to anon, authenticated;
    alter default privileges grant all on functions to anon, authenticated;
    alter default privileges grant all on sequences to anon, authenticated;
  `)
  await db.exec(SQL)
})

describe("форум: ник и автор", () => {
  it("ник выдаёт сервер, один и тот же для одного токена", async () => {
    const [a] = await anon<{ n: string }>("select public.forum_whoami($1::uuid) as n", [T[39]])
    const [b] = await anon<{ n: string }>("select public.forum_whoami($1::uuid) as n", [T[39]])
    expect(a.n).toBe(b.n)
    expect(a.n).toMatch(/^[А-ЯЁ][а-яё]+ [а-яё]+$/)
  })

  it("списки ника в SQL и в приложении совпадают", async () => {
    for (const w of [...NICK_ADJ_M, ...NICK_ADJ_F, ...NICK_ANIMALS_M, ...NICK_ANIMALS_F]) expect(SQL).toContain(`'${w}'`)
    const { rows: [r] } = await db.query<{ n: string }>("select app_private.forum_nickname('a1b2c3d4') as n")
    expect(r.n).toBe(nicknameFromKey("a1b2c3d4"))
  })
})

describe("форум: запись", () => {
  it("сообщение публикуется, ник приходит с сервера", async () => {
    const r = await post("tsinghua-university", "Какие общежития для иностранцев?")
    expect(r.status).toBe("published")
    expect(r.nickname).toMatch(/ /)
  })

  it("телефоны, почта и @ники вычёркиваются до записи, годы и суммы – нет", async () => {
    const r = await post("tsinghua-university", "Пишите +7 (999) 123-45-67, a.b@mail.ru или @my_handle. Учусь 2023-2027, 30 000 юаней")
    const { rows: [row] } = await db.query<{ body: string }>("select body from public.forum_posts where id = $1", [r.id])
    expect(row.body).toContain("[телефон скрыт]")
    expect(row.body).toContain("[почта скрыта]")
    expect(row.body).toContain("[ник скрыт]")
    expect(row.body).not.toMatch(/999|mail\.ru|my_handle/)
    expect(row.body).toContain("2023-2027")
    expect(row.body).toContain("30 000")
  })

  it("вычёркивание в приложении совпадает с серверным", async () => {
    for (const s of [
      "Пишите +7 (999) 123-45-67, a.b@mail.ru или @my_handle",
      "WeChat 13812345678, учусь 2023-2027, 30 000 юаней, HSK 5",
      "email: x_y@uni.edu.cn; tg:@abc; @ab остаётся",
    ]) {
      const { rows: [r] } = await db.query<{ v: string }>("select app_private.forum_redact($1) as v", [s])
      expect(redactContacts(s)).toBe(r.v)
    }
  })

  it("сообщение со ссылкой ждёт модерации и посетителю не видно", async () => {
    const r = await post("tsinghua-university", "Вот тут всё есть: https://example.com/dorm")
    expect(r.status).toBe("pending")
    const rows = await anon("select id from public.forum_posts where id = $1", [r.id])
    expect(rows).toHaveLength(0)
  })

  it("ответ – только на опубликованное сообщение верхнего уровня того же вуза", async () => {
    const top = await post("fudan-university", "Как с кухнями в общежитии?")
    const reply = await post("fudan-university", "Кухня общая на этаж", fresh(), top.id, "student")
    expect(reply.status).toBe("published")
    await fails(post("fudan-university", "Ответ на ответ", fresh(), reply.id), /forum_bad_parent/)
    await fails(post("tsinghua-university", "Чужой вуз", fresh(), top.id), /forum_bad_parent/)
  })

  it("пустое, слишком длинное, неизвестная роль – отказ", async () => {
    await fails(post("fudan-university", " "), /forum_empty/)
    await fails(post("fudan-university", "а".repeat(2001)), /forum_too_long/)
    await fails(post("fudan-university", "текст", fresh(), null, "admin"), /forum_bad_role/)
    await fails(post("../etc", "текст"), /forum_bad_university/)
  })

  it("один автор не чаще раза в 15 секунд", async () => {
    const t = fresh()
    await post("peking-university", "Первое сообщение", t)
    await fails(post("peking-university", "Второе сразу", t), /forum_too_fast/)
  })

  it("с одного IP не больше 30 сообщений в сутки; сам IP не хранится", async () => {
    const ip = "198.51.100.42"
    for (let i = 0; i < 30; i++) await post("zhejiang-university", `Сообщение ${i}`, `11111111-0000-4000-8000-${String(i).padStart(12, "0")}`, null, null, ip)
    await fails(post("zhejiang-university", "Тридцать первое", "22222222-0000-4000-8000-000000000000", null, null, ip), /forum_day_limit/)
    const leaks = await db.query("select 1 from app_private.forum_rate where ip_hash like '%198.51%'")
    expect(leaks.rows).toHaveLength(0)
  })
})

describe("форум: права посетителя", () => {
  it("видит только безопасные колонки", async () => {
    await fails(anon("select author_key from public.forum_posts limit 1"), /permission denied/)
    await fails(anon("select status from public.forum_posts limit 1"), /permission denied/)
    const rows = await anon("select id, body, nickname, role, created_at from public.forum_posts limit 1")
    expect(rows.length).toBe(1)
  })

  it("последовательность и служебные функции закрыты даже при открытых правах по умолчанию", async () => {
    await fails(anon("select nextval('public.forum_posts_id_seq')"), /permission denied/)
    await fails(anon("select app_private.forum_nickname('aabbcc')"), /permission denied/)
    await fails(anon("select count(*) from app_private.forum_rate"), /permission denied/)
  })

  it("не пишет мимо функций и не видит служебную схему", async () => {
    await fails(
      anon("insert into public.forum_posts (university_id, body, nickname, author_key) values ('x', 'hack', 'Админ', 'k')"),
      /permission denied/,
    )
    await fails(anon("update public.forum_posts set nickname = 'Админ'"), /permission denied/)
    await fails(anon("select salt from app_private.forum_secret"), /permission denied/)
  })
})

describe("форум: жалобы и удаление", () => {
  it("после трёх жалоб от разных авторов сообщение скрывается; повторная жалоба не считается", async () => {
    const r = await post("wuhan-university", "Спорное сообщение")
    const t1 = fresh()
    await anon("select public.forum_report($1, $2::uuid)", [r.id, t1])
    await anon("select public.forum_report($1, $2::uuid)", [r.id, t1])
    await anon("select public.forum_report($1, $2::uuid)", [r.id, fresh()])
    expect(await anon("select id from public.forum_posts where id = $1", [r.id])).toHaveLength(1)
    await anon("select public.forum_report($1, $2::uuid)", [r.id, fresh()])
    expect(await anon("select id from public.forum_posts where id = $1", [r.id])).toHaveLength(0)
  })

  it("автор стирает своё сообщение, чужой – нет; ветка остаётся", async () => {
    const author = fresh()
    const r = await post("nanjing-university", "Удалю потом", author)
    const [other] = await anon<{ ok: boolean }>("select public.forum_delete_own($1, $2::uuid) as ok", [r.id, fresh()])
    expect(other.ok).toBe(false)
    const [own] = await anon<{ ok: boolean }>("select public.forum_delete_own($1, $2::uuid) as ok", [r.id, author])
    expect(own.ok).toBe(true)
    const [row] = await anon<{ body: string }>("select body from public.forum_posts where id = $1", [r.id])
    expect(row.body).toBe("–")
  })
})
