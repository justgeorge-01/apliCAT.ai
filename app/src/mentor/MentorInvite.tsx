import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Copy, RefreshCw } from "lucide-react"

import { fadeUp } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import type { CabinetApi } from "@/auth/api"
import { inviteUrl } from "@/auth/url"
import { errorMessageRu } from "@/lib/cabinet"

/** Clipboard API first, then the textarea fallback (older WebViews, http). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* denied – fallback */
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export interface MentorInviteProps {
  api: CabinetApi
  orgId: string
  isAdmin: boolean
}

/**
 * Приглашение (cabinet spec §5): the `<site>/?join=CODE` link, copy, and –
 * for an admin – «перевыпустить код» (the old one stops working; students
 * already connected are not affected).
 */
export function MentorInvite({ api, orgId, isAdmin }: MentorInviteProps) {
  const toast = useToast()
  // undefined – loading; null – the organization has no code
  const [code, setCode] = useState<string | null | undefined>(undefined)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const loading = code === undefined

  useEffect(() => {
    let alive = true
    api
      .getInviteCode(orgId)
      .then((c) => alive && setCode(c))
      .catch((e: unknown) => {
        if (!alive) return
        toast(errorMessageRu(e))
        setCode(null)
      })
    return () => {
      alive = false
    }
  }, [api, orgId, toast])

  const link = code ? inviteUrl(location.href, code) : ""

  const copy = async () => {
    if (!link) return
    toast((await copyText(link)) ? "Ссылка скопирована" : "Не удалось скопировать, выделите ссылку вручную")
  }

  const reissue = async () => {
    setBusy(true)
    try {
      setCode(await api.reissueInvite(orgId))
      toast("Код перевыпущен, старая ссылка больше не работает")
      setConfirm(false)
    } catch (e) {
      toast(errorMessageRu(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 p-5">
        <p className="text-sm leading-relaxed text-fg-muted">
          Отправьте ученику ссылку. Он войдёт по email и будет подключён к организации; если аккаунта ещё нет, ссылка
          сначала приведёт на вход. Один ученик – одна организация.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-fg-muted">Загружаем код</p>
        ) : code ? (
          <>
            <div className="mt-4 rounded-lg border border-border bg-card-2 px-3 py-2.5 font-mono text-sm break-all select-all">{link}</div>
            <div className="mt-2 text-xs text-fg-muted">
              Код: <span className="font-mono font-semibold text-fg">{code}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={copy}>
                <Copy />
                Скопировать ссылку
              </Button>
              <Button variant="outline" onClick={() => setConfirm(true)} disabled={!isAdmin} title={isAdmin ? undefined : "Только администратор организации"}>
                <RefreshCw />
                Перевыпустить код
              </Button>
            </div>
            {!isAdmin && <p className="mt-2 text-xs text-fg-faint">Перевыпустить код может администратор организации.</p>}
          </>
        ) : (
          <p className="mt-4 text-sm text-fg-muted">Кода нет: попросите администратора перевыпустить его.</p>
        )}
      </Card>

      <Dialog open={confirm} onOpenChange={(o) => !o && !busy && setConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перевыпустить код приглашения?</DialogTitle>
            <DialogDescription>
              Старая ссылка перестанет работать сразу. Ученики, которые уже подключены, остаются на сопровождении.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
              Отмена
            </Button>
            <Button onClick={reissue} disabled={busy}>
              Перевыпустить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
