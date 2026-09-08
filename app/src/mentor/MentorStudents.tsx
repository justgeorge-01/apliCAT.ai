import { useState } from "react"
import { motion } from "framer-motion"
import { Flame, UserMinus } from "lucide-react"

import { fadeUp } from "@/lib/motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isUrgent, lastSeenLabel, type StudentRow } from "@/lib/cabinet"
import { daysLeftLabel } from "@/lib/plan"
import { cn } from "@/lib/utils"

export interface MentorStudentsProps {
  rows: readonly StudentRow[]
  loading: boolean
  now: Date
  onOpen: (studentId: string) => void
  /** `org_remove_student` – after a confirmation dialog. */
  onRemove: (studentId: string) => Promise<boolean>
}

const COLS = ["Ученик", "Вузов", "Ближайший дедлайн", "Документы", "Задач", "Визит", ""] as const

function Deadline({ row }: { row: StudentRow }) {
  if (!row.nextDeadline) return <span className="text-fg-faint">нет</span>
  const d = row.nextDeadline
  const urgent = isUrgent(row)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className={cn("font-semibold", urgent && "text-accent-text")}>{daysLeftLabel({ daysLeft: d.daysLeft, passed: false, precision: "day" })}</span>
      <span className="text-fg-muted">· {d.title}</span>
    </span>
  )
}

function DocsBar({ row }: { row: StudentRow }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">{row.docsTotal ? `${row.docsPct}%` : "–"}</span>
      {row.docsTotal > 0 && (
        <span className="h-1 w-14 overflow-hidden bg-fg/12" aria-hidden="true">
          <span className="block h-full origin-left bg-accent" style={{ transform: `scaleX(${row.docsPct / 100})` }} />
        </span>
      )}
    </span>
  )
}

/**
 * Ученики (cabinet spec §5): the table – nick or «ученик #a1b2», universities,
 * nearest deadline (plan + tasks), documents %, open tasks, last visit – sorted
 * by the nearest deadline, with the «горит на неделе» filter. On 375 the rows
 * become cards. «Снять с сопровождения» asks first.
 */
export function MentorStudents({ rows, loading, now, onOpen, onRemove }: MentorStudentsProps) {
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [pending, setPending] = useState<StudentRow | null>(null)
  const [busy, setBusy] = useState(false)
  const urgentCount = rows.filter((r) => isUrgent(r)).length
  const shown = urgentOnly ? rows.filter((r) => isUrgent(r)) : rows

  const confirmRemove = async () => {
    if (!pending) return
    setBusy(true)
    const ok = await onRemove(pending.studentId)
    setBusy(false)
    if (ok) setPending(null)
  }

  const removeButton = (row: StudentRow) => (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Снять с сопровождения: ${row.label}`}
      title="Снять с сопровождения"
      onClick={(e) => {
        e.stopPropagation()
        setPending(row)
      }}
    >
      <UserMinus />
    </Button>
  )

  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-fg-muted">
            {loading ? "Загружаем учеников" : `${rows.length} на сопровождении`}
          </div>
          <Button
            variant={urgentOnly ? "default" : "secondary"}
            size="sm"
            aria-pressed={urgentOnly}
            onClick={() => setUrgentOnly((s) => !s)}
            disabled={urgentCount === 0 && !urgentOnly}
          >
            <Flame />
            Горит на неделе{urgentCount ? ` (${urgentCount})` : ""}
          </Button>
        </div>

        {!loading && shown.length === 0 && (
          <p className="mt-4 text-sm text-fg-muted">
            {rows.length === 0 ? "Пока никого: отправьте ученику ссылку-приглашение." : "На этой неделе ни у кого не горит."}
          </p>
        )}

        {/* table from md */}
        {shown.length > 0 && (
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">
                  {COLS.map((c, i) => (
                    <th key={i} className="py-2 pr-3 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((row) => (
                  <tr
                    key={row.studentId}
                    className="cursor-pointer transition-colors duration-200 hover:bg-fg/5"
                    onClick={() => onOpen(row.studentId)}
                  >
                    <td className="py-2.5 pr-3 font-semibold">
                      <button type="button" className="rounded-md text-left outline-none hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent/60">
                        {row.label}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.universities}</td>
                    <td className="py-2.5 pr-3">
                      <Deadline row={row} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <DocsBar row={row} />
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.openTasks}</td>
                    <td className="py-2.5 pr-3 text-fg-muted">{lastSeenLabel(row.lastSeenAt, now)}</td>
                    <td className="py-1 text-right">{removeButton(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* cards below md */}
        {shown.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-border md:hidden">
            {shown.map((row) => (
              <li key={row.studentId} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(row.studentId)}
                    className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{row.label}</span>
                      {isUrgent(row) && <Badge variant="default">горит</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-fg-muted">
                      <Deadline row={row} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                      <span>вузов {row.universities}</span>
                      <span>
                        документы <DocsBar row={row} />
                      </span>
                      <span>задач {row.openTasks}</span>
                      <span>визит: {lastSeenLabel(row.lastSeenAt, now)}</span>
                    </div>
                  </button>
                  {removeButton(row)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Снять с сопровождения?</DialogTitle>
            <DialogDescription>
              {pending?.label} перестанет видеть организацию и ваши комментарии; его план и задачи останутся у него.
              Он сможет подключиться снова по коду приглашения.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={busy}>
              Снять
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
