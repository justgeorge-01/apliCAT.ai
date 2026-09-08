// Общий загрузчик app/.env.local для node-скриптов (миграции, сид организации,
// деплой). Vite читает тот же файл сам; здесь – та же семантика без зависимостей:
// KEY=VALUE, кавычки снимаются, строки с # пропускаются, уже заданные переменные
// окружения имеют приоритет.
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const ENV_FILE = path.join(APP_DIR, ".env.local")

export function parseEnv(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/** Читает .env.local (если есть) в process.env, не затирая заданное снаружи. */
export function loadEnvLocal() {
  if (!existsSync(ENV_FILE)) return {}
  const parsed = parseEnv(readFileSync(ENV_FILE, "utf8"))
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v
  }
  return parsed
}

export function requireEnv(name, hint) {
  const v = process.env[name]
  if (!v) {
    console.error(`Не задана переменная ${name}${hint ? ` – ${hint}` : ""}. Положите её в app/.env.local.`)
    process.exit(2)
  }
  return v
}
