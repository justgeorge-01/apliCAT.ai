import { useState, type FormEvent } from "react"
import { Eye, LogIn, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { telegramUrl, type Organization } from "@/lib/cabinet"
import { normalizeJoinCode } from "@/auth/url"

export interface MentorCardProps {
  /** The student's active organization, null when there is none. */
  org: Organization | null
  signed: boolean
  /** Guests: leads to the sign-in screen. */
  onSignIn?: () => void
  /** Signed-in without an organization: `join_org(code)`; resolves true on success. */
  onJoin?: (code: string) => Promise<boolean>
}

/** The single line the spec asks for – the student is told what the mentor sees. */
export const MENTOR_SEES = "Наставник видит твой план, документы, задачи и ответы онбординга."

/**
 * Наставник (cabinet spec §4 `MentorCard`): the organization with a Telegram
 * button and the visibility line; without an organization – the invitation
 * code field; for a guest – why an account is useful and the sign-in button.
 */
export function MentorCard({ org, signed, onSignIn, onJoin }: MentorCardProps) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = normalizeJoinCode(code)
    if (!clean) {
      setHint("Код выглядит как ZHUIQIU-7F3K: латиница, цифры и дефис.")
      return
    }
    setHint(null)
    setBusy(true)
    const ok = (await onJoin?.(clean)) ?? false
    setBusy(false)
    if (ok) setCode("")
  }

  const tg = org ? telegramUrl(org.telegram) : null

  return (
    <Card className="gap-0 p-5">
      <HanziKicker hanzi="导师" as="h2">
        Наставник
      </HanziKicker>

      {!signed ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            С аккаунтом план хранится не только в этом браузере, а наставник видит его в своей панели: статусы,
            документы, задачи и оставляет комментарии к вузам.
          </p>
          {onSignIn && (
            <div className="mt-4">
              <Button variant="outline" onClick={onSignIn}>
                <LogIn />
                Войти
              </Button>
            </div>
          )}
        </>
      ) : org ? (
        <>
          <div className="mt-2 font-display text-lg leading-tight font-bold">{org.name}</div>
          {org.tagline && <p className="mt-1 text-sm text-fg-muted">{org.tagline}</p>}
          {tg && (
            <div className="mt-4">
              <Button asChild variant="outline">
                <a href={tg} target="_blank" rel="noopener noreferrer">
                  <Send />
                  Написать в Telegram
                </a>
              </Button>
            </div>
          )}
          <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs leading-relaxed text-fg-muted">
            <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{MENTOR_SEES} Снять с сопровождения может только наставник.</span>
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Есть наставник? Введите код приглашения из его ссылки. После подключения он увидит план, документы,
            задачи и ответы онбординга.
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
            <Label htmlFor="join-code">Код приглашения</Label>
            <div className="flex gap-2">
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ZHUIQIU-7F3K"
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase"
              />
              <Button type="submit" disabled={!code.trim() || busy}>
                Подключиться
              </Button>
            </div>
            {hint && <p className="text-xs text-danger">{hint}</p>}
          </form>
        </>
      )}
    </Card>
  )
}
