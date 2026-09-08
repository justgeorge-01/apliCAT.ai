import { useState } from "react"
import { motion } from "framer-motion"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Kicker } from "@/components/ui/kicker"

const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
}

export interface DeleteAccountProps {
  email: string | null
  /** `delete_own_account()`; resolves true when the account is gone. */
  onConfirm: () => Promise<boolean>
  onCancel: () => void
}

/**
 * «Удалить аккаунт и все данные?» (cabinet spec §4) – the screen the
 * confirmation e-mail returns to (`?confirm=delete`). The only destructive
 * action of the cabinet; labelled as such, never one click away.
 */
export default function DeleteAccount({ email, onConfirm, onCancel }: DeleteAccountProps) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    const ok = await onConfirm()
    if (!ok) setBusy(false)
  }
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="mx-auto max-w-md">
      <Kicker accent>Аккаунт</Kicker>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-accent-text">Удалить аккаунт и все данные?</h1>
      <Card className="mt-6 gap-0 p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="text-sm leading-relaxed">
            <p>
              Вы перешли по ссылке из письма{email ? ` на ${email}` : ""}. Будут удалены безвозвратно: аккаунт, ник и
              ответы онбординга, план с документами и статусами, задачи, связь с наставником и его комментарии о вас.
            </p>
            <p className="mt-2 text-fg-muted">
              Каталог и план в этом браузере не трогаем: витрина продолжит работать без аккаунта. Экспортировать
              данные можно в профиле до удаления.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            Удалить навсегда
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Отмена
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}
