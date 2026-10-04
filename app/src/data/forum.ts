/**
 * Микрофорум на странице вуза (supabase/migrations/0002_forum.sql).
 *
 * Без аккаунтов и персональных данных: браузер хранит случайный токен
 * (`admitica.guide.forum_token`), сервер по его хэшу выдаёт ник вроде «Анонимная
 * лягушка». Писать можно только через функции базы: они вычёркивают телефоны,
 * почту и @ники, держат лимиты, отправляют сообщения со ссылками на модерацию.
 *
 * Клиент – обычный fetch к PostgREST с публичным anon-ключом: витрине не нужен
 * весь supabase-js. Без VITE_SUPABASE_* форума нет; в dev с VITE_FORUM_FAKE=1 –
 * память вкладки (для вёрстки и скриншотов).
 */
import { SUPABASE_ENV } from "@/lib/features"

export type ForumRole = "applicant" | "student" | "graduate"

export interface ForumPost {
  id: number
  university_id: string
  parent_id: number | null
  body: string
  nickname: string
  role: ForumRole | null
  created_at: string
  /** Стёр сам автор: текста нет, ответы остаются. */
  deleted: boolean
}

export interface ForumThread {
  post: ForumPost
  replies: ForumPost[]
}

export interface PostResult {
  id: number
  nickname: string
  status: "published" | "pending"
}

export interface ForumApi {
  list(universityId: string): Promise<ForumPost[]>
  whoami(token: string): Promise<string>
  post(input: { universityId: string; body: string; token: string; parentId?: number | null; role?: ForumRole | null }): Promise<PostResult>
  report(postId: number, token: string): Promise<void>
  deleteOwn(postId: number, token: string): Promise<boolean>
}

export const ROLE_RU: Record<ForumRole, string> = {
  applicant: "поступаю",
  student: "учусь здесь",
  graduate: "выпускник",
}

/* Списки ника – те же, что в app_private.forum_nickname (forum.sql.test.ts сверяет). */
export const NICK_ADJ_M = ["Анонимный", "Тихий", "Любопытный", "Сонный", "Весёлый", "Задумчивый", "Смелый", "Вежливый", "Бодрый", "Внимательный", "Спокойный", "Добрый", "Хитрый", "Мудрый", "Быстрый", "Скромный"] as const
export const NICK_ADJ_F = ["Анонимная", "Тихая", "Любопытная", "Сонная", "Весёлая", "Задумчивая", "Смелая", "Вежливая", "Бодрая", "Внимательная", "Спокойная", "Добрая", "Хитрая", "Мудрая", "Быстрая", "Скромная"] as const
export const NICK_ANIMALS_M = ["кот", "ёж", "барсук", "енот", "волк", "медведь", "тигр", "журавль", "дельфин", "филин", "пингвин", "хомяк", "бобёр", "лемур", "краб"] as const
export const NICK_ANIMALS_F = ["лягушка", "панда", "сова", "лиса", "выдра", "белка", "черепаха", "цапля", "рысь", "ласка", "сорока", "пчела", "акула", "мышь", "утка"] as const

/** Тот же выбор, что в SQL: байты хэша автора → прилагательное в роде животного. */
export function nicknameFromKey(hexKey: string): string {
  const byte = (i: number) => parseInt(hexKey.slice(i * 2, i * 2 + 2), 16) || 0
  const a = byte(0) % 16
  const n = (byte(1) * 256 + byte(2)) % 30
  return n < 15 ? `${NICK_ADJ_M[a]} ${NICK_ANIMALS_M[n]}` : `${NICK_ADJ_F[a]} ${NICK_ANIMALS_F[n - 15]}`
}

/**
 * То же вычёркивание, что app_private.forum_redact: почта, @ники, телефоны от 10
 * цифр. Решает сервер; здесь – для тестовой базы в dev и для подсказки в форме.
 */
export function redactContacts(body: string): string {
  return body
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[почта скрыта]")
    .replace(/(^|[^A-Za-z0-9_])@[A-Za-z0-9_]{3,}/g, "$1[ник скрыт]")
    .replace(/\+?\d(?:[\s()-]*\d){9,}/g, "[телефон скрыт]")
}

/* ---------- ошибки ---------- */

const ERRORS_RU: Record<string, string> = {
  forum_too_fast: "Слишком часто. Подождите несколько секунд и отправьте снова.",
  forum_day_limit: "На сегодня лимит сообщений исчерпан. Попробуйте завтра.",
  forum_empty: "Сообщение пустое.",
  forum_too_long: "Сообщение длиннее 2000 знаков.",
  forum_bad_parent: "На это сообщение уже нельзя ответить.",
  forum_not_found: "Сообщение не найдено.",
  forum_no_token: "Не удалось определить автора. Обновите страницу.",
}

export class ForumError extends Error {
  code: string
  constructor(code: string) {
    super(ERRORS_RU[code] ?? "Не получилось. Попробуйте ещё раз.")
    this.code = code
  }
}

function codeOf(text: string): string {
  return /forum_[a-z_]+/.exec(text)?.[0] ?? "unknown"
}

/* ---------- токен ---------- */

const TOKEN_KEY = "admitica.guide.forum_token"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Случайный токен этого браузера; без localStorage живёт до перезагрузки. */
export function forumToken(storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()): string {
  try {
    const saved = storage?.getItem(TOKEN_KEY)
    if (saved && UUID_RE.test(saved)) return saved
  } catch {
    /* private mode */
  }
  const fresh = crypto.randomUUID()
  try {
    storage?.setItem(TOKEN_KEY, fresh)
  } catch {
    /* quota / private mode */
  }
  return fresh
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/* ---------- чтение ---------- */

/** Ветки: сообщения верхнего уровня новыми сверху, ответы под ними по порядку; пустые удалённые ветки не показываются. */
export function toThreads(posts: ForumPost[]): ForumThread[] {
  const replies = new Map<number, ForumPost[]>()
  for (const p of posts) {
    if (p.parent_id !== null) replies.set(p.parent_id, [...(replies.get(p.parent_id) ?? []), p])
  }
  return posts
    .filter((p) => p.parent_id === null)
    .map((post) => ({
      post,
      replies: (replies.get(post.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .filter((t) => !t.post.deleted || t.replies.some((r) => !r.deleted))
    .sort((a, b) => b.post.created_at.localeCompare(a.post.created_at))
}

/* ---------- PostgREST ---------- */

const COLUMNS = "id,university_id,parent_id,body,nickname,role,created_at"

function restApi(url: string, anonKey: string): ForumApi {
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" }
  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) })
    const text = await res.text()
    if (!res.ok) throw new ForumError(codeOf(text))
    return (text ? JSON.parse(text) : null) as T
  }
  return {
    async list(universityId) {
      const q = new URLSearchParams({ select: COLUMNS, university_id: `eq.${universityId}`, order: "created_at.asc", limit: "500" })
      const res = await fetch(`${url}/rest/v1/forum_posts?${q}`, { headers })
      if (!res.ok) throw new ForumError("unknown")
      const rows = (await res.json()) as Omit<ForumPost, "deleted">[]
      // текст удалённого стирается в базе до «–»: отличаем по нему, статус в API не отдаётся
      return rows.map((r) => ({ ...r, deleted: r.body === "–" }))
    },
    whoami: (token) => rpc<string>("forum_whoami", { p_token: token }),
    post: ({ universityId, body, token, parentId, role }) =>
      rpc<PostResult>("forum_post", {
        p_university: universityId,
        p_body: body,
        p_token: token,
        p_parent: parentId ?? null,
        p_role: role ?? null,
      }),
    report: (postId, token) => rpc<void>("forum_report", { p_post: postId, p_token: token }),
    deleteOwn: (postId, token) => rpc<boolean>("forum_delete_own", { p_post: postId, p_token: token }),
  }
}

/* ---------- dev: память вкладки ---------- */

function fakeKey(token: string): string {
  let h = 2166136261
  for (const ch of token) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h.toString(16).padStart(8, "0")
}

function fakeApi(): ForumApi {
  const rows: (ForumPost & { author: string; status: string })[] = []
  let seq = 1
  return {
    async list(universityId) {
      return rows
        .filter((r) => r.university_id === universityId && (r.status === "published" || r.status === "deleted"))
        .map((r) => ({
          id: r.id,
          university_id: r.university_id,
          parent_id: r.parent_id,
          body: r.body,
          nickname: r.nickname,
          role: r.role,
          created_at: r.created_at,
          deleted: r.deleted,
        }))
    },
    async whoami(token) {
      return nicknameFromKey(fakeKey(token))
    },
    async post({ universityId, body, token, parentId, role }) {
      const text = redactContacts(body).trim()
      if (text.length < 2) throw new ForumError("forum_empty")
      const status = /(https?:\/\/|www\.|t\.me\/)/i.test(text) ? "pending" : "published"
      const nickname = nicknameFromKey(fakeKey(token))
      const id = seq++
      rows.push({ id, university_id: universityId, parent_id: parentId ?? null, body: text, nickname, role: role ?? null, created_at: new Date().toISOString(), deleted: false, author: fakeKey(token), status })
      return { id, nickname, status }
    },
    async report() {},
    async deleteOwn(postId, token) {
      const r = rows.find((x) => x.id === postId && x.author === fakeKey(token))
      if (!r) return false
      Object.assign(r, { body: "–", deleted: true, status: "deleted" })
      return true
    },
  }
}

let api: ForumApi | null | undefined

/** Форум этой сборки или null, если базы нет. */
export function getForum(): ForumApi | null {
  if (api !== undefined) return api
  if (import.meta.env.DEV && import.meta.env.VITE_FORUM_FAKE === "1") api = fakeApi()
  else api = SUPABASE_ENV ? restApi(SUPABASE_ENV.url.replace(/\/+$/, ""), SUPABASE_ENV.anonKey) : null
  return api
}
