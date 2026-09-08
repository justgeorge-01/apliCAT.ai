import { useState, type FormEvent } from "react"
import { motion } from "framer-motion"
import { MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Label } from "@/components/ui/label"
import { errorMessageRu } from "@/lib/cabinet"
import { PolicyContent } from "@/pages/Policy"
import type { Backend } from "./api"
import { redirectUrl } from "./url"

const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } }

export interface SignInProps {
  backend: Backend
  /** An invitation code from `?join=` waiting for the sign-in. */
  pendingJoin?: string | null
  onBack: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Вход (cabinet spec §3): e-mail + the consent checkbox → `signInWithOtp` →
 * «Проверьте почту». No password, no name. Errors in Russian. With the dev
 * backend the button signs in at once («без письма»).
 */
export default function SignIn({ backend, pendingJoin, onBack }: SignInProps) {
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)

  const valid = EMAIL_RE.test(email.trim()) && consent

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await backend.auth.sendMagicLink(email.trim(), { redirectTo: redirectUrl(location.href), consentAt: new Date().toISOString() })
      setSentTo(email.trim())
    } catch (err) {
      setError(errorMessageRu(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-md">
      <motion.div variants={fadeUp}>
        <Button variant="outline" size="sm" onClick={onBack}>
          Назад
        </Button>
        <Kicker accent className="mt-4">
          Аккаунт
        </Kicker>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-accent-text">
          {sentTo ? "Проверьте почту" : "Войти по ссылке из письма"}
        </h1>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-6">
        <Card className="gap-0 p-6">
          {sentTo ? (
            <div className="flex flex-col items-start gap-3">
              <MailCheck className="size-8 text-accent-text" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                Письмо со ссылкой для входа отправлено на <b>{sentTo}</b>. Откройте его на этом устройстве и нажмите
                ссылку: вы вернётесь сюда уже вошедшим.
              </p>
              <p className="text-xs leading-relaxed text-fg-muted">
                Письма нет пару минут – проверьте «Спам». Ссылка действует ограниченное время; если она устарела,
                запросите новую.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
                Изменить адрес
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-fg-muted">
                Пароля нет: введите email, мы пришлём ссылку для входа. Аккаунт хранит план, задачи и ответы онбординга
                и позволяет подключить наставника. Имя не спрашиваем.
              </p>
              {pendingJoin && (
                <p className="rounded-lg border border-border bg-card-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
                  После входа вы подключитесь к наставнику по коду <span className="font-mono font-semibold text-fg">{pendingJoin}</span>.
                </p>
              )}
              <div>
                <Label htmlFor="signin-email" className="mb-1.5">
                  Email
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="signin-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                <label htmlFor="signin-consent" className="text-sm leading-snug">
                  Согласен с{" "}
                  <button
                    type="button"
                    onClick={() => setPolicyOpen(true)}
                    className="font-medium text-accent-text underline underline-offset-2 hover:no-underline"
                  >
                    политикой и дисклеймером
                  </button>
                  : email нужен только для входа, данные видит наставник, если я его подключу.
                </label>
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <div>
                <Button type="submit" size="lg" disabled={!valid || busy}>
                  {backend.fake ? "Войти (демо, без письма)" : "Получить ссылку для входа"}
                </Button>
              </div>
              {backend.fake && (
                <p className="text-xs text-fg-faint">
                  Демо-бэкенд: вход без письма, данные в этом браузере. Наставник – mentor@demo.abitura, ученик с
                  данными – student@demo.abitura.
                </p>
              )}
            </form>
          )}
        </Card>
      </motion.div>

      <Dialog open={policyOpen} onOpenChange={(o) => !o && setPolicyOpen(false)}>
        <DialogContent aria-describedby={undefined} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Политика и дисклеймер</DialogTitle>
          </DialogHeader>
          <PolicyContent compact />
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
