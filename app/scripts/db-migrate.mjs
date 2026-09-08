#!/usr/bin/env node
// Применяет supabase/migrations/*.sql к базе из SUPABASE_DB_URL (Session Pooler,
// порт 5432). Учёт применённых файлов – app_private.schema_migrations (схема не
// публикуется через API). Повторный запуск ничего не переприменяет.
//
//   npm run db:migrate          применить всё новое
//   npm run db:migrate -- --dry только показать, что ждёт применения
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import pg from "pg"

import { APP_DIR, loadEnvLocal, requireEnv } from "./env.mjs"

loadEnvLocal()
const url = requireEnv("SUPABASE_DB_URL", "строка подключения Session Pooler (порт 5432)")
const dry = process.argv.includes("--dry")

const dir = path.join(APP_DIR, "supabase", "migrations")
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query("create schema if not exists app_private")
  await client.query(
    "create table if not exists app_private.schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  )
  const applied = new Set((await client.query("select name from app_private.schema_migrations")).rows.map((r) => r.name))
  const pending = files.filter((f) => !applied.has(f))
  if (pending.length === 0) {
    console.log("Миграции: всё применено, новых файлов нет.")
  }
  for (const f of pending) {
    if (dry) {
      console.log(`ждёт применения: ${f}`)
      continue
    }
    const sql = readFileSync(path.join(dir, f), "utf8")
    process.stdout.write(`применяю ${f} … `)
    await client.query("begin")
    try {
      await client.query(sql)
      await client.query("insert into app_private.schema_migrations (name) values ($1)", [f])
      await client.query("commit")
      console.log("ок")
    } catch (e) {
      await client.query("rollback")
      console.log("ошибка")
      throw e
    }
  }
} finally {
  await client.end()
}
