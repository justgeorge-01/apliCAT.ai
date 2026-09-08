import { useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { CircleAlert, MessageSquareQuote, Trash2 } from "lucide-react"

import { SourceLink } from "@/components/DeadlineFeed"
import { DocChecklist } from "@/components/DocChecklist"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { applicationDeadline, findUniversity, formatCheckedAt, lastChecked } from "@/data/china"
import type { Catalog, University } from "@/data/china.types"
import type { MentorNote } from "@/lib/cabinet"
import { fadeUp } from "@/lib/motion"
import { NOTE_MAX, PLAN_STATUSES, PLAN_STATUS_LABELS_RU, type Plan, type PlanEntry, type PlanStatus } from "@/lib/plan"
import { cn } from "@/lib/utils"

/* ---------- status segments ---------- */

/**
 * The application status as segments (the Segmented look: paper track, red
 * active segment). A local grid rather than `Segmented` because four Russian
 * labels do not fit a 375px track without scrolling – here they wrap 2 x 2 on
 * narrow screens and sit in one row from `sm`. Read-only: the same look with
 * the buttons disabled (the mentor sees exactly what the student sees).
 */
function StatusSegments({
  value,
  onChange,
  labelledBy,
  readOnly,
}: {
  value: PlanStatus
  onChange?: (status: PlanStatus) => void
  labelledBy: string
  readOnly?: boolean
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 sm:grid-cols-4"
    >
      {PLAN_STATUSES.map((s) => {
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            disabled={readOnly}
            onClick={() => onChange?.(s)}
            className={cn(
              "rounded-md px-2 py-2 text-center text-[13px] leading-tight font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
              on ? "bg-accent font-semibold text-accent-fg" : "text-fg-muted",
              !readOnly && !on && "hover:bg-fg/5 hover:text-fg",
              readOnly && "cursor-default",
            )}
          >
            {PLAN_STATUS_LABELS_RU[s]}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- the student's note ---------- */

function NoteField({ id, value, onChange, readOnly }: { id: string; value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  const [draft, setDraft] = useState(value)
  // the saved value changed underneath (store reload) – adopt it
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(value)
  }
  if (readOnly) {
    if (!value) return null
    return (
      <div>
        <Label className="mb-1.5">Заметка ученика</Label>
        <p className="text-sm leading-relaxed whitespace-pre-line">{value}</p>
      </div>
    )
  }
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">
        Заметка
      </Label>
      <Textarea
        id={id}
        value={draft}
        maxLength={NOTE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== value) onChange?.(draft)
        }}
        placeholder="Для себя и наставника: программа, вопросы, что уточнить"
        className="min-h-16"
      />
    </div>
  )
}

/* ---------- the mentor's comment ---------- */

export function MentorNoteView({ note, orgName }: { note: MentorNote; orgName?: string | null }) {
  return (
    <blockquote className="border-l-2 border-accent pl-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">
        <MessageSquareQuote className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
        Комментарий наставника{orgName ? ` · ${orgName}` : ""}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{note.body}</p>
      <div className="mt-1 text-xs text-fg-faint">обновлён {formatCheckedAt(note.updatedAt)}</div>
    </blockquote>
  )
}

/* ---------- university block ---------- */

export interface UniversityBlockProps {
  university: University
  entry: PlanEntry
  /** The mentor's comment on this university, if any. */
  mentorNote?: MentorNote | null
  orgName?: string | null
  /** The mentor panel's editor for the comment – rendered instead of the plain comment. */
  noteEditor?: ReactNode
  readOnly?: boolean
  onStatus?: (status: PlanStatus) => void
  onDoc?: (docId: string, done: boolean) => void
  onNote?: (note: string) => void
  onRemove?: () => void
  onOpen: () => void
}

export function UniversityBlock({ university: u, entry, mentorNote, orgName, noteEditor, readOnly, onStatus, onDoc, onNote, onRemove, onOpen }: UniversityBlockProps) {
  const deadline = applicationDeadline(u)
  const checked = lastChecked(u)
  const statusId = `status-${u.id}`

  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-md text-left font-display text-lg leading-tight font-bold tracking-tight transition-colors duration-200 outline-none hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {u.name_ru ?? u.name}
            </button>
            <div className="mt-0.5 text-xs text-fg-muted">
              {u.city}
              {u.name_ru ? ` · ${u.name}` : ""}
            </div>
          </div>
          {!readOnly && onRemove && (
            <Button variant="ghost" size="icon-sm" aria-label="Убрать из плана" title="Убрать из плана" onClick={onRemove}>
              <Trash2 />
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <Label id={statusId} className="mb-1.5">
              Статус
            </Label>
            <StatusSegments value={entry.status} onChange={onStatus} labelledBy={statusId} readOnly={readOnly} />
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5">Дедлайн подачи</Label>
            {deadline ? (
              <>
                {/* printed as is – `fact.display` */}
                <div className="text-sm leading-snug">{deadline.display}</div>
                <SourceLink className="mt-1" url={deadline.source_url} verifiedAt={deadline.verified_at} />
              </>
            ) : (
              <div className="text-sm text-fg-muted">
                {checked ? `вуз не публикует · проверено ${formatCheckedAt(checked)}` : "не опубликовано"}
              </div>
            )}
          </div>
          <NoteField id={`note-${u.id}`} value={entry.note ?? ""} onChange={onNote} readOnly={readOnly} />
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <DocChecklist university={u} entry={entry} onToggle={onDoc ?? (() => {})} readOnly={readOnly} />
        </div>

        {(noteEditor || mentorNote) && (
          <div className="mt-5 border-t border-border pt-4">{noteEditor ?? (mentorNote && <MentorNoteView note={mentorNote} orgName={orgName} />)}</div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpen}>
            Открыть карточку вуза
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

/** An entry whose id is not in the current catalog (a plan imported from another data version). */
export function UnknownBlock({ id, onRemove }: { id: string; onRemove?: () => void }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="gap-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Вуз «{id}» не найден в каталоге</div>
              <div className="mt-0.5 text-xs text-fg-muted">
                Возможно, план из другой версии данных. Уберите запись или дождитесь обновления каталога.
              </div>
            </div>
          </div>
          {onRemove && (
            <Button variant="ghost" size="icon-sm" aria-label="Убрать из плана" title="Убрать из плана" onClick={onRemove}>
              <Trash2 />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

/* ---------- the list ---------- */

export interface UniversityListProps {
  catalog: Catalog
  plan: Plan
  notes?: readonly MentorNote[]
  orgName?: string | null
  readOnly?: boolean
  /** Mentor panel: the comment editor per university. */
  renderNoteEditor?: (u: University) => ReactNode
  onStatus?: (id: string, status: PlanStatus) => void
  onDoc?: (id: string, docId: string, done: boolean) => void
  onNote?: (id: string, note: string) => void
  onRemove?: (id: string) => void
  onOpen: (id: string) => void
}

/**
 * The university blocks of «Мой план» – the same component for the student
 * (editable) and the mentor (`readOnly`, with the comment editor). The two
 * therefore always show the same things.
 */
export function UniversityList({ catalog, plan, notes = [], orgName, readOnly, renderNoteEditor, onStatus, onDoc, onNote, onRemove, onOpen }: UniversityListProps) {
  return (
    <div className="flex flex-col gap-4">
      {plan.universities.map((entry) => {
        const u = findUniversity(catalog, entry.id)
        if (!u) return <UnknownBlock key={entry.id} id={entry.id} onRemove={readOnly ? undefined : () => onRemove?.(entry.id)} />
        return (
          <UniversityBlock
            key={entry.id}
            university={u}
            entry={entry}
            mentorNote={notes.find((n) => n.universityId === entry.id) ?? null}
            orgName={orgName}
            noteEditor={renderNoteEditor?.(u)}
            readOnly={readOnly}
            onStatus={(s) => onStatus?.(entry.id, s)}
            onDoc={(docId, done) => onDoc?.(entry.id, docId, done)}
            onNote={(note) => onNote?.(entry.id, note)}
            onRemove={() => onRemove?.(entry.id)}
            onOpen={() => onOpen(entry.id)}
          />
        )
      })}
    </div>
  )
}
