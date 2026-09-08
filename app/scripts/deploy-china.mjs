#!/usr/bin/env node
// Деплой витрины с кабинетом на ВТОРОЙ GitHub Pages сайт (SPEC-cabinet §7):
// `vite build` → содержимое dist/ пушится в ветку gh-pages репозитория владельца.
// Прод европейской Абитуры (deploy.yml в этом репозитории) не затрагивается.
//
//   npm run deploy:china              собрать и запушить
//   npm run deploy:china -- --dry-run только собрать и показать, куда бы пушили
//
// Переменные (app/.env.local, в git не попадают):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY – попадают в сборку (публичный anon-ключ);
//   DEPLOY_REPO   – git-адрес репозитория Pages, по умолчанию
//                   git@github.com:<владелец origin>/abitura-china.git;
//   DEPLOY_BRANCH – ветка Pages, по умолчанию gh-pages.
// VITE_PARTNER для публичной сборки не задаётся: бренд приходит из базы.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { APP_DIR, loadEnvLocal } from "./env.mjs"

loadEnvLocal()
const dryRun = process.argv.includes("--dry-run")
const branch = process.env.DEPLOY_BRANCH || "gh-pages"

function git(args, cwd) {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim()
}

function defaultRepo() {
  const origin = git(["remote", "get-url", "origin"], APP_DIR)
  const m = /github\.com[:/]([^/]+)\//.exec(origin)
  if (!m) return null
  return `git@github.com:${m[1]}/abitura-china.git`
}

const repo = process.env.DEPLOY_REPO || defaultRepo()
if (!repo) {
  console.error("Не удалось определить репозиторий Pages: задайте DEPLOY_REPO в app/.env.local.")
  process.exit(2)
}
const pagesUrl = (() => {
  const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(repo)
  return m ? `https://${m[1].toLowerCase()}.github.io/${m[2]}/` : "(адрес Pages смотрите в настройках репозитория)"
})()

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Внимание: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY не заданы – кабинет в сборке будет выключен.")
}

const buildEnv = { ...process.env }
delete buildEnv.VITE_PARTNER
delete buildEnv.BASE_PATH
console.log("Сборка: npm run build (base ./)")
execFileSync("npm", ["run", "build"], { cwd: APP_DIR, stdio: "inherit", env: buildEnv })

const dist = path.join(APP_DIR, "dist")
if (!existsSync(path.join(dist, "index.html"))) {
  console.error("dist/index.html не найден – сборка не удалась.")
  process.exit(1)
}

console.log(`Репозиторий: ${repo}, ветка ${branch}`)
console.log(`Адрес сайта: ${pagesUrl}`)
if (dryRun) {
  console.log("--dry-run: пуш пропущен.")
  process.exit(0)
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "abitura-china-deploy-"))
try {
  cpSync(dist, tmp, { recursive: true })
  // Pages не должен прогонять Jekyll: файлы с подчёркиванием остаются как есть.
  writeFileSync(path.join(tmp, ".nojekyll"), "")
  git(["init", "-q", "-b", branch], tmp)
  git(["add", "-A"], tmp)
  git(
    ["-c", "user.name=abitura-deploy", "-c", "user.email=deploy@abitura.local", "commit", "-q", "-m", `deploy: ${new Date().toISOString()}`],
    tmp,
  )
  git(["push", "--force", repo, `HEAD:${branch}`], tmp)
  console.log(`Готово. После первого пуша: Settings → Pages → Source: branch ${branch}, root.`)
  console.log(`Site URL / Redirect URLs в Supabase Auth: ${pagesUrl} и ${pagesUrl}**`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
