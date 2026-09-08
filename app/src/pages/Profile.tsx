import { useState } from "react"
import { motion } from "framer-motion"
import { Download, Eye, LogOut, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Label } from "@/components/ui/label"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import { useToast } from "@/components/ui/use-toast"
import { useCabinet } from "@/auth/useCabinet"
import { isoDate } from "@/data/china"
import { NICK_MAX, serializeAccount, telegramUrl } from "@/lib/cabinet"
import { profileIsFilled, profileSummary } from "@/lib/catalogView"
import type { ChinaProfile } from "@/lib/match"
import type { Plan } from "@/lib/plan"

const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } }

/* The kicker sits on an inner span: index.css styles h2 outside a cascade
   layer, so the body-font utility on the heading itself would be overridden. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3">
      <Kicker as="span">{children}</Kicker>
    </h2>
  )
}

export interface ProfileProps {
  /** The onboarding answers the shell holds (mirrored from the account). */
  onboarding: ChinaProfile | null
  /** Opens the five-question wizard – the same component as the onboarding. */
  onEditOnboarding: () => void
  plan: Plan
  theme: "dark" | "light"
  onToggleTheme: () => void
}

/**
 * Профиль (cabinet spec §4): nick, the onboarding answers (edited with the
 * same wizard), the mentor line, the theme, the JSON export, sign-out and the
 * account deletion (an e-mail with a link back to «Удалить аккаунт и все данные?»).
 */
export default function Profile({ onboarding, onEditOnboarding, plan, theme, onToggleTheme }: ProfileProps) {
  const toast = useToast()
  const cabinet = useCabinet()
  const [nick, setNick] = useState(cabinet.profile?.nick ?? "")
  const [nickBusy, setNickBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteSent, setDeleteSent] = useState(false)

  // the account's nick arrived / changed underneath – adopt it
  const savedNick = cabinet.profile?.nick ?? ""
  const [prevNick, setPrevNick] = useState(savedNick)
  if (prevNick !== savedNick) {
    setPrevNick(savedNick)
    setNick(savedNick)
  }

  const saveNick = async () => {
    const clean = nick.trim().slice(0, NICK_MAX)
    if (clean === (cabinet.profile?.nick ?? "")) return
    setNickBusy(true)
    const ok = await cabinet.updateProfile({ nick: clean || null })
    setNickBusy(false)
    if (ok) toast(clean ? "Ник сохранён" : "Ник убран")
  }

  const exportJson = () => {
    if (!cabinet.profile) return
    const now = new Date()
    const json = serializeAccount(
      { email: cabinet.user?.email ?? null, profile: cabinet.profile, organization: cabinet.org, plan, tasks: cabinet.tasks, notes: cabinet.notes },
      now,
    )
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `abitura-china-account-${isoDate(now)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
    toast("Файл с данными аккаунта сохранён")
  }

  const requestDelete = async () => {
    setDeleteBusy(true)
    const ok = await cabinet.requestDeleteLink()
    setDeleteBusy(false)
    if (ok) {
      setDeleteSent(true)
      toast("Письмо с подтверждением отправлено")
    }
  }

  const email = cabinet.user?.email ?? ""
  const filled = profileIsFilled(onboarding)
  const tg = telegramUrl(cabinet.org?.telegram)

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-2xl">
      <motion.div variants={fadeUp}>
        <Kicker accent>Аккаунт</Kicker>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-accent-text sm:text-4xl">Профиль</h1>
        <p className="mt-2 text-sm text-fg-muted">{email}</p>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-6">
        <Card className="gap-0 p-6">
          <SectionTitle>Ник</SectionTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="profile-nick" className="mb-1.5">
                Как к вам обращаться (необязательно)
              </Label>
              <Input
                id="profile-nick"
                value={nick}
                maxLength={NICK_MAX}
                onChange={(e) => setNick(e.target.value)}
                onBlur={saveNick}
                placeholder="Без ника наставник увидит «ученик #…»"
              />
            </div>
            <Button variant="secondary" onClick={saveNick} disabled={nickBusy || nick.trim() === (cabinet.profile?.nick ?? "")}>
              Сохранить
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <SectionTitle>Ответы онбординга</SectionTitle>
            {filled && onboarding ? (
              <p className="text-sm leading-relaxed">{profileSummary(onboarding).join(" · ")}</p>
            ) : (
              <p className="text-sm text-fg-muted">Пять вопросов ещё не отвечены: степень, направление, язык, HSK или IELTS, бюджет.</p>
            )}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onEditOnboarding}>
                {filled ? "Изменить ответы" : "Ответить"}
              </Button>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <SectionTitle>Наставник</SectionTitle>
            {cabinet.org ? (
              <>
                <p className="text-sm">
                  {cabinet.org.name}
                  {cabinet.org.tagline ? <span className="text-fg-muted"> · {cabinet.org.tagline}</span> : null}
                </p>
                <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
                  <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Наставник видит твой план, документы, задачи, ответы онбординга и последний визит. Снять с
                    сопровождения может только он.
                  </span>
                </p>
                {tg && (
                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm">
                      <a href={tg} target="_blank" rel="noopener noreferrer">
                        Написать в Telegram
                      </a>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-fg-muted">Наставника нет. Код приглашения вводится на странице «Мой план».</p>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <SectionTitle>Внешний вид</SectionTitle>
            <div className="flex items-center justify-between py-1">
              <span className="text-[13px]">Тема оформления</span>
              <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <SectionTitle>Данные</SectionTitle>
            <p className="mb-3 text-xs leading-relaxed text-fg-muted">
              В аккаунте: email, ник, ответы онбординга, план с документами и статусами, задачи, комментарии
              наставника. Файлов нет и не будет.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportJson} disabled={!cabinet.profile}>
                <Download />
                Экспорт данных (JSON)
              </Button>
              <Button variant="ghost" onClick={() => void cabinet.signOut()}>
                <LogOut />
                Выйти
              </Button>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <SectionTitle>Удаление</SectionTitle>
            <p className="mb-3 text-xs leading-relaxed text-fg-muted">
              Удаление аккаунта подтверждается письмом: пришлём ссылку на {email || "вашу почту"}, по ней откроется
              экран «Удалить аккаунт и все данные?». Данные в этом браузере тоже будут очищены.
            </p>
            {deleteSent ? (
              <p className="text-sm">Письмо отправлено. Откройте ссылку из него, чтобы подтвердить удаление.</p>
            ) : (
              <Button
                variant="ghost"
                className="border border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                onClick={requestDelete}
                disabled={deleteBusy}
              >
                <Trash2 /> Удалить аккаунт
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
