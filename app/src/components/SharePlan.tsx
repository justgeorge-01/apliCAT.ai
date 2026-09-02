import { useRef, useState, type ChangeEvent } from "react"
import { Copy, Download, Send, Share2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kicker } from "@/components/ui/kicker"
import { useToast } from "@/components/ui/use-toast"
import { isoDate } from "@/data/china"
import { getPartner, hasLead } from "@/lib/partner"
import { parsePlan, serializePlan, shareUrl, type Plan } from "@/lib/plan"

/* ---------- clipboard ---------- */

/** Clipboard API first, then the textarea fallback (older WebViews, http). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* denied / insecure context – try the fallback */
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

/* ---------- share ---------- */

export interface SharePlanProps {
  /** The digest from `planSummary` – printed and sent as is. */
  text: string
}

/**
 * «Поделиться с наставником» (spec §3.4): the plain-text digest goes to
 * `https://t.me/share/url?text=…` or to the clipboard. Nothing is sent
 * anywhere else; the text can be inspected before sharing.
 */
export function SharePlan({ text }: SharePlanProps) {
  const toast = useToast()
  const [showText, setShowText] = useState(false)
  const partner = getPartner()

  const copy = async () => {
    if (await copyText(text)) {
      toast("Свод скопирован")
    } else {
      setShowText(true)
      toast("Не удалось скопировать, выделите текст вручную")
    }
  }

  return (
    <Card className="gap-0 p-5">
      <Kicker as="h2" className="flex items-center gap-1.5">
        <Share2 className="size-3.5 text-accent-text" />
        Поделиться с наставником
      </Kicker>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Текстовый свод: вузы, статусы, ближайшие дедлайны и готовность документов. Отправляется только этот
        текст, ничего больше.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <a href={shareUrl(text)} target="_blank" rel="noopener noreferrer">
            <Send />
            В Telegram
          </a>
        </Button>
        <Button variant="outline" onClick={copy}>
          <Copy />
          Скопировать
        </Button>
        <Button variant="ghost" onClick={() => setShowText((s) => !s)} aria-expanded={showText}>
          {showText ? "Скрыть текст" : "Показать текст"}
        </Button>
      </div>

      {showText && (
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card-2 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-fg">
          {text}
        </pre>
      )}

      {hasLead(partner) && (
        <p className="mt-3 text-xs text-fg-muted">
          {partner.name} разбирает такие кейсы:{" "}
          <a
            href={partner.lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent-text underline-offset-2 hover:underline"
          >
            {partner.lead.label}
          </a>
        </p>
      )}
    </Card>
  )
}

/* ---------- export / import ---------- */

export interface PlanBackupProps {
  plan: Plan
  /** Called with the parsed plan – the page replaces its plan with it. */
  onImport: (plan: Plan) => void
}

function uniCount(n: number): string {
  const abs = n % 100
  const last = abs % 10
  const word = abs > 10 && abs < 20 ? "вузов" : last === 1 ? "вуз" : last >= 2 && last <= 4 ? "вуза" : "вузов"
  return `${n} ${word}`
}

/**
 * Экспорт/импорт JSON (spec §3.4) – insurance against a cleared localStorage.
 * The file is built with a Blob and read with FileReader; nothing leaves the
 * device. Import REPLACES the current plan (after a confirmation when the
 * current plan is not empty).
 */
export function PlanBackup({ plan, onImport }: PlanBackupProps) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Plan | null>(null)
  const count = plan.universities.length

  const exportJson = () => {
    const now = new Date()
    const blob = new Blob([serializePlan(plan, now)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `admitica-china-plan-${isoDate(now)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
    toast("Файл плана сохранён")
  }

  const onFile = (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    // reset so the same file can be picked again
    ev.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = typeof reader.result === "string" ? parsePlan(reader.result) : null
      if (!parsed) {
        toast("Файл не похож на план Admitica")
        return
      }
      if (count > 0) {
        setPending(parsed)
      } else {
        onImport(parsed)
        toast(`План восстановлен: ${uniCount(parsed.universities.length)}`)
      }
    }
    reader.onerror = () => toast("Не удалось прочитать файл")
    reader.readAsText(file)
  }

  const confirmImport = () => {
    if (!pending) return
    onImport(pending)
    toast(`План заменён: ${uniCount(pending.universities.length)}`)
    setPending(null)
  }

  return (
    <Card className="gap-0 p-5">
      <Kicker as="h2">Резервная копия</Kicker>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        План хранится только в этом браузере. Сохраните JSON-файл, чтобы не потерять статусы и отметки при очистке
        данных, и восстановите его при необходимости.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportJson} disabled={count === 0}>
          <Download />
          Экспорт JSON
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload />
          Импорт JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onFile}
        />
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заменить текущий план?</DialogTitle>
            <DialogDescription>
              В файле {uniCount(pending?.universities.length ?? 0)}, в текущем плане {uniCount(count)}. Текущий план
              будет заменён планом из файла вместе со статусами и отметками документов.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Отмена
            </Button>
            <Button onClick={confirmImport}>Заменить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
