import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Textarea } from "@/components/ui/textarea"
import {
  ForumError,
  ROLE_RU,
  forumToken,
  toThreads,
  type ForumApi,
  type ForumPost,
  type ForumRole,
} from "@/data/forum"
import { useNow } from "@/lib/useNow"
import { cn } from "@/lib/utils"

const MINE_KEY = "admitica.guide.forum_mine"

function readMine(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : []
  } catch {
    return []
  }
}

function rememberMine(id: number): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...readMine(), id].slice(-200)))
  } catch {
    /* private mode */
  }
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function when(iso: string, now: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  if (d.toDateString() === now.toDateString()) return `сегодня, ${hm}`
  return d.getFullYear() === now.getFullYear()
    ? `${d.getDate()} ${MONTHS[d.getMonth()]}`
    : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const ROLE_OPTIONS: { id: ForumRole | null; label: string }[] = [
  { id: "applicant", label: "Поступаю" },
  { id: "student", label: "Учусь здесь" },
  { id: "graduate", label: "Выпускник" },
  { id: null, label: "Не указывать" },
]

function Composer({
  forum,
  universityId,
  token,
  parentId = null,
  onPosted,
  onCancel,
  compact = false,
}: {
  forum: ForumApi
  universityId: string
  token: string
  parentId?: number | null
  onPosted: (pending: boolean) => void
  onCancel?: () => void
  compact?: boolean
}) {
  const [body, setBody] = useState("")
  const [role, setRole] = useState<ForumRole | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldId = parentId ? `forum-reply-${parentId}` : "forum-body"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await forum.post({ universityId, body, token, parentId, role })
      rememberMine(r.id)
      setBody("")
      onPosted(r.status === "pending")
    } catch (err) {
      setError(err instanceof ForumError ? err.message : "Не получилось отправить. Попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label htmlFor={fieldId} className="sr-only">
        {parentId ? "Ответ" : "Сообщение"}
      </label>
      <Textarea
        id={fieldId}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={compact ? 3 : 4}
        placeholder={parentId ? "Ваш ответ" : "Вопрос или рассказ о вузе: общежитие, учёба, город, поступление"}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Кто вы">
        {ROLE_OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={role === o.id}
            onClick={() => setRole(o.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
              role === o.id ? "border-accent bg-accent font-semibold text-accent-fg" : "border-border text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || body.trim().length < 2}>
          {busy ? "Отправляем" : parentId ? "Ответить" : "Отправить"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}

function PostView({
  p,
  mine,
  now,
  onReply,
  onReport,
  onDelete,
  reported,
}: {
  p: ForumPost
  mine: boolean
  now: Date
  onReply?: () => void
  onReport: () => void
  onDelete: () => void
  reported: boolean
}) {
  if (p.deleted) {
    return <p className="text-sm text-fg-faint italic">Сообщение удалено автором</p>
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-fg-muted">
        <span className="text-sm font-semibold text-fg">{p.nickname}</span>
        {p.role && <span className="rounded border border-border px-1.5 py-px">{ROLE_RU[p.role]}</span>}
        <span>{when(p.created_at, now)}</span>
        {mine && <span className="text-fg-faint">это вы</span>}
      </div>
      <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-fg">{p.body}</p>
      <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
        {onReply && (
          <button type="button" onClick={onReply} className="hover:text-fg hover:underline">
            Ответить
          </button>
        )}
        {mine ? (
          <button type="button" onClick={onDelete} className="hover:text-danger hover:underline">
            Удалить
          </button>
        ) : reported ? (
          <span className="text-fg-faint">Жалоба отправлена</span>
        ) : (
          <button type="button" onClick={onReport} className="hover:text-fg hover:underline">
            Пожаловаться
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Микрофорум вуза: анонимные ники, без регистрации и без персональных данных.
 * Сервер вычёркивает контакты и держит лимиты; ссылки ждут модерации.
 */
export function ForumBlock({ forum, universityId }: { forum: ForumApi; universityId: string }) {
  const token = useMemo(() => forumToken(), [])
  const [posts, setPosts] = useState<ForumPost[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [nickname, setNickname] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reported, setReported] = useState<Set<number>>(() => new Set())
  const [mine, setMine] = useState<number[]>(() => readMine())
  const [version, setVersion] = useState(0)
  const now = useNow()

  useEffect(() => {
    let alive = true
    forum
      .list(universityId)
      .then((p) => {
        if (alive) {
          setPosts(p)
          setFailed(false)
        }
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [forum, universityId, version])

  useEffect(() => {
    let alive = true
    forum
      .whoami(token)
      .then((n) => {
        if (alive) setNickname(n)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [forum, token])

  const posted = (pending: boolean) => {
    setReplyTo(null)
    setMine(readMine())
    setNotice(pending ? "Сообщение со ссылкой появится после проверки." : null)
    setVersion((v) => v + 1)
  }

  const report = async (id: number) => {
    try {
      await forum.report(id, token)
    } finally {
      setReported((s) => new Set(s).add(id))
    }
  }

  const remove = async (id: number) => {
    if (await forum.deleteOwn(id, token).catch(() => false)) setVersion((v) => v + 1)
  }

  const threads = posts ? toThreads(posts) : []

  return (
    <section aria-labelledby="forum-h" className="flex flex-col gap-5">
      <HanziKicker as="h2" id="forum-h" hanzi="讨论">
        Обсуждение
      </HanziKicker>
      <p className="max-w-prose text-sm text-fg-muted">
        Спросите тех, кто здесь учится или поступал. Без регистрации: сайт выдаёт анонимный ник и ничего о вас не
        хранит. Имена, телефоны, почта и @ники вычёркиваются автоматически, сообщения со ссылками появляются после
        проверки.
      </p>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
        <p className="text-sm text-fg-muted">
          Вы пишете как <span className="font-semibold text-fg">{nickname ?? "…"}</span>
          <span className="text-fg-faint"> · ник привязан к этому браузеру</span>
        </p>
        <Composer forum={forum} universityId={universityId} token={token} onPosted={posted} />
        {notice && (
          <p role="status" className="text-sm text-fg-muted">
            {notice}
          </p>
        )}
      </div>

      {failed ? (
        <p className="text-sm text-fg-muted">Обсуждение сейчас не загрузилось. Обновите страницу чуть позже.</p>
      ) : posts === null ? (
        <div className="h-20 animate-pulse rounded-lg bg-card-2" aria-busy="true" aria-label="Загрузка обсуждения" />
      ) : threads.length === 0 ? (
        <p className="text-sm text-fg-muted">Пока никто не написал. Задайте первый вопрос.</p>
      ) : (
        <ul className="grid gap-0">
          {threads.map(({ post, replies }) => (
            <li key={post.id} className="grid gap-3 border-t border-border py-4">
              <PostView
                p={post}
                mine={mine.includes(post.id)}
                now={now}
                onReply={post.deleted ? undefined : () => setReplyTo(replyTo === post.id ? null : post.id)}
                onReport={() => report(post.id)}
                onDelete={() => remove(post.id)}
                reported={reported.has(post.id)}
              />
              {(replies.length > 0 || replyTo === post.id) && (
                <div className="ml-1 grid gap-3 border-l-2 border-border pl-4">
                  {replies.map((r) => (
                    <PostView
                      key={r.id}
                      p={r}
                      mine={mine.includes(r.id)}
                      now={now}
                      onReport={() => report(r.id)}
                      onDelete={() => remove(r.id)}
                      reported={reported.has(r.id)}
                    />
                  ))}
                  {replyTo === post.id && (
                    <Composer
                      forum={forum}
                      universityId={universityId}
                      token={token}
                      parentId={post.id}
                      onPosted={posted}
                      onCancel={() => setReplyTo(null)}
                      compact
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
