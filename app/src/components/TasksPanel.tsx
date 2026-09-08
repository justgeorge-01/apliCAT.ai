import { useState, type FormEvent } from "react"
import { CalendarDays, ListChecks, Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCheckedAt } from "@/data/china"
import { daysLeftLabel, type DeadlineItem } from "@/lib/plan"
import {
  canDeleteTask,
  canEditTask,
  canToggleTask,
  isDone,
  TASK_DETAILS_MAX,
  TASK_TITLE_MAX,
  type Task,
  type TaskInput,
  type TaskPatch,
  type TaskViewer,
} from "@/lib/tasks"
import { cn } from "@/lib/utils"

export interface UniversityOption {
  id: string
  name: string
}

export interface TasksPanelProps {
  tasks: readonly Task[]
  /** The «ближайшие 7 дней» slice of the deadline feed (tasks + university deadlines + common dates). */
  upcoming: readonly DeadlineItem[]
  viewer: TaskViewer
  /** Universities of the plan – the optional «вуз» of a task. */
  universities: readonly UniversityOption[]
  /** Name of the student's organization – the badge of a mentor's task. */
  orgName?: string | null
  /** Show the «подробности» field in the form (mentor panel). */
  withDetails?: boolean
  /** Hide every form and control (a plain read-only list). */
  readOnly?: boolean
  /** Guests: the tasks live in this browser only. */
  localOnly?: boolean
  onAdd: (input: TaskInput) => Promise<boolean>
  onToggle: (id: string) => void
  onEdit: (id: string, patch: TaskPatch) => Promise<boolean>
  onDelete: (id: string) => void
  onOpenUniversity?: (id: string) => void
}

/* ---------- form ---------- */

interface TaskFormProps {
  initial?: Partial<TaskInput>
  universities: readonly UniversityOption[]
  withDetails?: boolean
  submitLabel: string
  onSubmit: (input: TaskInput) => Promise<boolean>
  onCancel?: () => void
}

function TaskForm({ initial, universities, withDetails, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [dueOn, setDueOn] = useState(initial?.dueOn ?? "")
  const [universityId, setUniversityId] = useState(initial?.universityId ?? "")
  const [details, setDetails] = useState(initial?.details ?? "")
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    const ok = await onSubmit({ title, dueOn: dueOn || null, universityId: universityId || null, details: details || null })
    setBusy(false)
    if (ok && !initial) {
      setTitle("")
      setDueOn("")
      setUniversityId("")
      setDetails("")
    }
    if (ok) onCancel?.()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="task-title" className="mb-1.5">
          Название
        </Label>
        <Input
          id="task-title"
          value={title}
          maxLength={TASK_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: заказать перевод аттестата"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="task-due" className="mb-1.5">
            Срок
          </Label>
          <Input id="task-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="task-uni" className="mb-1.5">
            Вуз (необязательно)
          </Label>
          <Select id="task-uni" value={universityId} onChange={(e) => setUniversityId(e.target.value)}>
            <option value="">Без вуза</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {withDetails && (
        <div>
          <Label htmlFor="task-details" className="mb-1.5">
            Подробности (необязательно)
          </Label>
          <Textarea
            id="task-details"
            value={details}
            maxLength={TASK_DETAILS_MAX}
            onChange={(e) => setDetails(e.target.value)}
            className="min-h-20"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!title.trim() || busy}>
          {initial ? null : <Plus />}
          {submitLabel}
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

/* ---------- one task ---------- */

function TaskRow({
  task,
  viewer,
  universities,
  orgName,
  readOnly,
  withDetails,
  onToggle,
  onEdit,
  onDelete,
  onOpenUniversity,
}: {
  task: Task
  viewer: TaskViewer
  universities: readonly UniversityOption[]
  orgName?: string | null
  readOnly?: boolean
  withDetails?: boolean
  onToggle: (id: string) => void
  onEdit: (id: string, patch: TaskPatch) => Promise<boolean>
  onDelete: (id: string) => void
  onOpenUniversity?: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const done = isDone(task)
  const uni = task.universityId ? universities.find((u) => u.id === task.universityId) : undefined
  const canToggle = !readOnly && canToggleTask(task, viewer)
  const canEdit = !readOnly && canEditTask(task, viewer)
  const canDelete = !readOnly && canDeleteTask(task, viewer)
  const id = `task-${task.id}`

  if (editing) {
    return (
      <li className="py-3">
        <TaskForm
          initial={{ title: task.title, dueOn: task.dueOn, universityId: task.universityId, details: task.details }}
          universities={universities}
          withDetails={withDetails}
          submitLabel="Сохранить"
          onSubmit={(input) => onEdit(task.id, { title: input.title, dueOn: input.dueOn ?? null, universityId: input.universityId ?? null, details: input.details ?? null })}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <Checkbox
        id={id}
        checked={done}
        disabled={!canToggle}
        onCheckedChange={() => onToggle(task.id)}
        aria-label={done ? "Вернуть в работу" : "Сделано"}
        className="mt-0.5 rounded-[2px] border-fg/70 bg-card data-[state=checked]:border-fg data-[state=checked]:bg-card data-[state=checked]:text-accent-text"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={cn("block text-sm leading-snug", canToggle && "cursor-pointer", done && "text-fg-muted line-through")}>
          {task.title}
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          {task.orgId ? <Badge variant="default">от {orgName ?? "наставника"}</Badge> : null}
          {task.dueOn && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
              {formatCheckedAt(task.dueOn)}
            </span>
          )}
          {uni &&
            (onOpenUniversity ? (
              <button type="button" onClick={() => onOpenUniversity(uni.id)} className="underline-offset-2 hover:text-accent-text hover:underline">
                {uni.name}
              </button>
            ) : (
              <span>{uni.name}</span>
            ))}
        </div>
        {task.details && <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-fg-muted">{task.details}</p>}
      </div>
      {(canEdit || canDelete) && (
        <div className="flex shrink-0 items-center gap-0.5">
          {canEdit && (
            <Button variant="ghost" size="icon-sm" aria-label="Изменить задачу" title="Изменить" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon-sm" aria-label="Удалить задачу" title="Удалить" onClick={() => onDelete(task.id)}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/* ---------- panel ---------- */

/**
 * Задачи (cabinet spec §4): «ближайшие 7 дней» on top – tasks, university
 * deadlines and the common dates in one list – then the open tasks, the done
 * ones folded, and the form. A mentor's task carries the organization badge
 * and can only be marked done by the student; the student's own can be edited
 * and deleted. The mentor panel renders the same component with `viewer.kind
 * === "mentor"`.
 */
export function TasksPanel({
  tasks,
  upcoming,
  viewer,
  universities,
  orgName,
  withDetails,
  readOnly,
  localOnly,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
  onOpenUniversity,
}: TasksPanelProps) {
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const open = tasks.filter((t) => !isDone(t))
  const done = tasks.filter(isDone)
  const rowProps = { viewer, universities, orgName, readOnly, withDetails, onToggle, onEdit, onDelete, onOpenUniversity }

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <Kicker as="h2">Задачи</Kicker>
        <span className="text-xs text-fg-muted">
          открытых{" "}
          <span className="font-display text-base leading-none font-bold text-accent-text tabular-nums">{open.length}</span>
        </span>
      </div>

      {/* the next seven days */}
      <section aria-label="Ближайшие 7 дней" className="mt-4">
        <div className="text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">Ближайшие 7 дней</div>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">На этой неделе ничего не горит.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {upcoming.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold">{it.title}</span>
                    {it.kind === "task" && (
                      <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                        <ListChecks className="size-3 shrink-0" aria-hidden="true" />
                        задача
                      </span>
                    )}
                    {it.kind === "common" && <span className="text-xs text-fg-muted">общие</span>}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {it.subtitle ? `${it.subtitle} · ` : ""}
                    {it.display}
                  </div>
                </div>
                <span className={cn("shrink-0 text-xs font-semibold", it.daysLeft <= 1 ? "text-accent-text" : "text-fg-muted")}>
                  {daysLeftLabel(it)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* open tasks */}
      <section aria-label="Открытые задачи" className="mt-5 border-t border-border pt-4">
        {open.length === 0 ? (
          <p className="text-sm text-fg-muted">{readOnly ? "Открытых задач нет." : "Открытых задач нет. Добавьте первую – например, заказать перевод аттестата."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} {...rowProps} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section aria-label="Выполненные задачи" className="mt-3">
          <Button variant="ghost" size="xs" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
            {showDone ? "Скрыть выполненные" : `Выполненные (${done.length})`}
          </Button>
          {showDone && (
            <ul className="mt-1 flex flex-col divide-y divide-border">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} {...rowProps} />
              ))}
            </ul>
          )}
        </section>
      )}

      {!readOnly && (
        <div className="mt-4 border-t border-border pt-4">
          {adding ? (
            <TaskForm universities={universities} withDetails={withDetails} submitLabel="Добавить" onSubmit={onAdd} onCancel={() => setAdding(false)} />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Добавить задачу
            </Button>
          )}
        </div>
      )}

      {localOnly && !readOnly && (
        <p className="mt-3 text-xs text-fg-faint">Задачи хранятся только в этом браузере. С аккаунтом их увидит и наставник.</p>
      )}
    </Card>
  )
}
