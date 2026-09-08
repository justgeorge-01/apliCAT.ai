#!/usr/bin/env node
// Создание / обновление организации и её участников (SPEC-cabinet §0.3).
// Работает напрямую с базой (SUPABASE_DB_URL), поэтому не зависит от RLS.
//
//   npm run db:org -- --slug zhuiqiu --name "Zhuiqiu" --telegram zhuiqiu_yu \
//       --tagline "Наставник по поступлению в вузы Китая" \
//       --admin owner@example.com --mentor mentor@example.com [--code ZHUIQIU-7F3K]
//
// Участник добавляется только если у него уже есть аккаунт (вошёл хотя бы раз);
// иначе скрипт так и скажет. Инвайт-код без --code генерируется в формате
// SLUG-XXXX; повторный запуск без --code существующий код не меняет.
import { randomInt } from "node:crypto"
import pg from "pg"

import { loadEnvLocal, requireEnv } from "./env.mjs"

loadEnvLocal()
const url = requireEnv("SUPABASE_DB_URL", "строка подключения Session Pooler (порт 5432)")

const args = process.argv.slice(2)
const opts = { admin: [], mentor: [] }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (!a.startsWith("--")) continue
  const key = a.slice(2)
  const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true"
  if (key === "admin" || key === "mentor") opts[key].push(val)
  else opts[key] = val
}

if (!opts.slug) {
  console.error("Нужен --slug (например, zhuiqiu). См. шапку scripts/db-org.mjs.")
  process.exit(2)
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
function makeCode(slug) {
  let s = ""
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `${slug.toUpperCase()}-${s}`
}

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
})

try {
  await client.connect()
  const existing = (await client.query("select * from public.organizations where slug = $1", [opts.slug])).rows[0]
  const name = opts.name ?? existing?.name
  if (!name) {
    console.error("Для новой организации нужен --name.")
    process.exit(2)
  }
  const code = opts.code ? String(opts.code).toUpperCase() : (existing?.invite_code ?? makeCode(opts.slug))
  const row = (
    await client.query(
      `insert into public.organizations (slug, name, tagline, telegram, invite_code)
       values ($1, $2, $3, $4, $5)
       on conflict (slug) do update set
         name = excluded.name,
         tagline = coalesce(excluded.tagline, public.organizations.tagline),
         telegram = coalesce(excluded.telegram, public.organizations.telegram),
         invite_code = excluded.invite_code
       returning *`,
      [opts.slug, name, opts.tagline ?? null, opts.telegram ?? null, code],
    )
  ).rows[0]
  console.log(`Организация «${row.name}» (${row.slug}), id ${row.id}`)
  console.log(`Инвайт-код: ${row.invite_code}`)
  console.log(`Ссылка приглашения: <адрес сайта>/?join=${row.invite_code}`)

  for (const [role, emails] of [
    ["admin", opts.admin],
    ["mentor", opts.mentor],
  ]) {
    for (const email of emails) {
      const u = (await client.query("select id from auth.users where lower(email) = lower($1)", [email])).rows[0]
      if (!u) {
        console.log(`  ${role} ${email}: аккаунта нет – пусть сначала войдёт по magic link, затем повторите.`)
        continue
      }
      await client.query(
        `insert into public.org_members (org_id, user_id, role) values ($1, $2, $3)
         on conflict (org_id, user_id) do update set role = excluded.role`,
        [row.id, u.id, role],
      )
      console.log(`  ${role} ${email}: добавлен`)
    }
  }
} finally {
  await client.end()
}
