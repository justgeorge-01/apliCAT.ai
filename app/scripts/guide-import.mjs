#!/usr/bin/env node
// Сливает подборки ссылок по вузам в public/data/guide.json.
//
//   node scripts/guide-import.mjs <папка с <id>.json> [--check] [--dry-run]
//
// Каждый файл в папке – один вуз: { id, name_zh, description: { text_ru, sources[] }, links: [...] }
// (формат – src/data/guide.ts). Вуз из папки заменяет свою запись целиком; вузы, которых
// в папке нет, остаются как были; поля telegram_channel и discussion не трогаются.
//
// Что отсеивается и печатается в отчёт:
//   - id, которого нет в каталоге public/data/china.json;
//   - ссылка не https, без русского заголовка, с неизвестной темой или языком, повтор адреса;
//   - заголовок или пересказ с @ником или длиннее разумного (пересказ – до 40 слов);
//   - с --check: ссылка, на которую сайт ответил 404 или 410. Площадки, чей robots.txt
//     запрещает роботов (Xiaohongshu, Zhihu, Tieba, WeChat), не проверяются вовсе;
//     сетевые ошибки ссылку не выкидывают – только печатаются.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const GUIDE = path.join(APP, "public/data/guide.json")
const CATALOG = path.join(APP, "public/data/china.json")

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith("--"))
const check = args.includes("--check")
const dryRun = args.includes("--dry-run")
if (!dir || !existsSync(dir)) {
  console.error("Использование: node scripts/guide-import.mjs <папка> [--check] [--dry-run]")
  process.exit(2)
}

const TOPICS = new Set(["russians", "life", "dorm", "campus", "study", "city", "admission"])
const LANGS = new Set(["zh", "ru", "en"])
const PLATFORMS = new Set(["official", "bilibili", "youtube", "xiaohongshu", "zhihu", "wechat", "tieba", "telegram", "media", "blog", "other"])
const NO_ROBOTS = /(^|\.)(xiaohongshu\.com|xhslink\.com|zhihu\.com|tieba\.baidu\.com|weixin\.sogou\.com|mp\.weixin\.qq\.com)$/i
const HANDLE = /(^|\s)@[A-Za-z0-9_]{3,}/

const str = (x) => (typeof x === "string" && x.trim() ? x.trim() : null)
const words = (s) => (s ? s.split(/\s+/).length : 0)
function https(u) {
  try {
    return new URL(u).protocol === "https:"
  } catch {
    return false
  }
}

const catalogIds = new Set(JSON.parse(readFileSync(CATALOG, "utf8")).universities.map((u) => u.id))
const guide = existsSync(GUIDE)
  ? JSON.parse(readFileSync(GUIDE, "utf8"))
  : { generated_at: "", telegram_channel: null, universities: {} }

const report = []
const note = (id, msg) => report.push(`${id}: ${msg}`)

async function status(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (Abitura link check)" } })
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (Abitura link check)" } })
    }
    return res.status
  } catch (e) {
    return `сеть: ${e.cause?.code ?? e.name}`
  } finally {
    clearTimeout(t)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let imported = 0
let kept = 0

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  let raw
  try {
    raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"))
  } catch (e) {
    note(file, `не JSON (${e.message})`)
    continue
  }
  const id = str(raw.id) ?? file.replace(/\.json$/, "")
  if (!catalogIds.has(id)) {
    note(id, "нет в каталоге – пропущен")
    continue
  }
  const seen = new Set()
  const links = []
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    const url = str(l?.url)
    const why = !url || !https(url)
      ? "не https"
      : !str(l.title_ru)
        ? "нет русского заголовка"
        : !TOPICS.has(l.topic)
          ? `тема «${l.topic}»`
          : !LANGS.has(l.lang)
            ? `язык «${l.lang}»`
            : seen.has(url)
              ? "повтор"
              : HANDLE.test(`${l.title_ru} ${l.summary_ru ?? ""}`)
                ? "ник в тексте"
                : words(l.summary_ru) > 40
                  ? "пересказ длиннее 40 слов"
                  : null
    if (why) {
      note(id, `ссылка отброшена (${why}): ${url ?? "—"}`)
      continue
    }
    seen.add(url)
    links.push({
      url,
      title_orig: str(l.title_orig),
      title_ru: str(l.title_ru),
      summary_ru: str(l.summary_ru),
      lang: l.lang,
      platform: PLATFORMS.has(l.platform) ? l.platform : "other",
      topic: l.topic,
      published: /^\d{4}-(0[1-9]|1[0-2])/.test(l.published ?? "") ? l.published.slice(0, 7) : null,
    })
  }

  if (check) {
    for (const l of [...links]) {
      const host = new URL(l.url).hostname
      if (NO_ROBOTS.test(host)) continue
      const s = await status(l.url)
      if (s === 404 || s === 410) {
        links.splice(links.indexOf(l), 1)
        note(id, `ссылка отброшена (HTTP ${s}): ${l.url}`)
      } else if (typeof s !== "number" || s >= 400) {
        note(id, `не проверена (${s}), оставлена: ${l.url}`)
      }
      await sleep(1200)
    }
  }

  const d = raw.description
  const sources = Array.isArray(d?.sources) ? d.sources.map(str).filter((s) => s && https(s)) : []
  const description = str(d?.text_ru) && sources.length ? { text_ru: str(d.text_ru), sources } : null
  if (!description) note(id, "описание без https-источника – не публикуется")

  const prev = guide.universities[id] ?? {}
  guide.universities[id] = { ...prev, name_zh: str(raw.name_zh) ?? prev.name_zh ?? null, description, links }
  imported++
  kept += links.length
}

guide.generated_at = new Date().toISOString().slice(0, 10)
console.log(report.length ? report.join("\n") : "замечаний нет")
console.log(`\nВузов: ${imported}, ссылок: ${kept}${dryRun ? " (dry-run, файл не записан)" : ""}`)
if (!dryRun) writeFileSync(GUIDE, JSON.stringify(guide, null, 2) + "\n")
