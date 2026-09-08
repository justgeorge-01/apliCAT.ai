import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, Eye, MessageSquareQuote } from "lucide-react"

import { DeadlineFeed } from "@/components/DeadlineFeed"
import { UniversityList } from "@/components/PlanUniversities"
import { fadeUp, stagger } from "@/lib/motion"
import { TasksPanel } from "@/components/TasksPanel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import type { CabinetApi } from "@/auth/api"
import { findUniversity, formatCheckedAt } from "@/data/china"
import type { Catalog, University } from "@/data/china.types"
import { errorMessageRu, lastSeenLabel, studentLabel, type MentorNote, type Organization, type StudentBundle } from "@/lib/cabinet"
import { profileIsFilled, profileSummary, pluralRu } from "@/lib/catalogView"
import { FIXED_DATES, deadlineFeed, upcomingWithin } from "@/lib/plan"
import { patchTask, remoteTaskStore, removeTask, sortTasks, upsertTask, type Task, type TaskInput, type TaskPatch } from "@/lib/tasks"

/* ---------- the comment editor ---------- */

const NOTE_MAX = 2000

function NoteEditor({ university, note, onSave, onDelete }: { university: University; note: MentorNote | null; onSave: (body: string) => Promise<boolean>; onDelete: () => Promise<void> }) {
  const [draft, setDraft] = useState(note?.body ?? "")
  const [busy, setBusy] = useState(false)
  const saved = note?.body ?? ""
  const [prevSaved, setPrevSaved] = useState(saved)
  if (prevSaved !== saved) {
    setPrevSaved(saved)
    setDraft(saved)
  }
  const dirty = draft.trim() !== (note?.body ?? "")
  const id = `mentor-note-${university.id}`
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">
        <MessageSquareQuote className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
        Комментарий наставника
      </div>
      <Label htmlFor={id} className="sr-only">
        Комментарий к вузу
      </Label>
      <Textarea
        id={id}
        value={draft}
        maxLength={NOTE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Что ученику важно знать про этот вуз: раунд, документы, на что смотреть"
        className="mt-2 min-h-20"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!dirty || busy || !draft.trim()}
          onClick={async () => {
            setBusy(true)
            await onSave(draft.trim())
            setBusy(false)
          }}
        >
          Сохранить
        </Button>
        {note && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onDelete()
              setBusy(false)
            }}
          >
            Удалить
          </Button>
        )}
        {note && <span className="text-xs text-fg-faint">обновлён {formatCheckedAt(note.updatedAt)}</span>}
      </div>
    </div>
  )
}

/* ---------- the card ---------- */

export interface MentorStudentProps {
  api: CabinetApi
  catalog: Catalog
  org: Organization
  /** The signed-in mentor. */
  viewerId: string
  bundle: StudentBundle
  now: Date
  onBack: () => void
  onOpenUniversity: (id: string) => void
  /** The parent keeps the students list in sync with the edits made here. */
  onChanged: (bundle: StudentBundle) => void
}

/**
 * Карточка ученика (cabinet spec §5): the student's «Мой план» read-only (the
 * same components), the onboarding answers with the «ученик знает, что вы это
 * видите» note, tasks with the add / edit / delete form, and a comment per
 * university.
 */
export function MentorStudent({ api, catalog, org, viewerId, bundle, now, onBack, onOpenUniversity, onChanged }: MentorStudentProps) {
  const toast = useToast()
  const student = bundle.profile
  const [tasks, setTasks] = useState<Task[]>(bundle.tasks)
  const [notes, setNotes] = useState<MentorNote[]>(bundle.notes)
  const [showPast, setShowPast] = useState(false)
  // a fresh bundle from the parent (reload) – adopt its tasks and notes
  const [prevBundle, setPrevBundle] = useState(bundle)
  if (prevBundle !== bundle) {
    setPrevBundle(bundle)
    setTasks(bundle.tasks)
    setNotes(bundle.notes)
  }

  const store = useMemo(() => remoteTaskStore(api, { studentId: student.userId, authorId: viewerId, orgId: org.id }), [api, student.userId, viewerId, org.id])
  const publish = (next: { tasks?: Task[]; notes?: MentorNote[] }) => onChanged({ ...bundle, tasks: next.tasks ?? tasks, notes: next.notes ?? notes })
  const fail = (e: unknown) => {
    toast(errorMessageRu(e))
    return false
  }

  const addTask = async (input: TaskInput) => {
    try {
      const t = await store.add(input)
      const next = upsertTask(tasks, t)
      setTasks(next)
      publish({ tasks: next })
      return true
    } catch (e) {
      return fail(e)
    }
  }
  const editTask = async (id: string, patch: TaskPatch) => {
    const before = tasks
    const next = patchTask(tasks, id, patch)
    setTasks(next)
    try {
      await store.update(id, patch)
      publish({ tasks: next })
      return true
    } catch (e) {
      setTasks(before)
      return fail(e)
    }
  }
  const toggleTask = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (t) void editTask(id, { doneAt: t.doneAt ? null : new Date().toISOString() })
  }
  const deleteTask = async (id: string) => {
    const before = tasks
    const next = removeTask(tasks, id)
    setTasks(next)
    try {
      await store.remove(id)
      publish({ tasks: next })
    } catch (e) {
      setTasks(before)
      fail(e)
    }
  }

  const saveNote = async (universityId: string, body: string) => {
    try {
      const saved = await api.upsertNote({ orgId: org.id, studentId: student.userId, universityId, body, authorId: viewerId })
      const next = [...notes.filter((n) => n.universityId !== universityId), saved]
      setNotes(next)
      publish({ notes: next })
      toast("Комментарий сохранён")
      return true
    } catch (e) {
      return fail(e)
    }
  }
  const deleteNote = async (universityId: string) => {
    try {
      await api.deleteNote(org.id, student.userId, universityId)
      const next = notes.filter((n) => n.universityId !== universityId)
      setNotes(next)
      publish({ notes: next })
    } catch (e) {
      fail(e)
    }
  }

  const feedAll = useMemo(
    () => deadlineFeed(bundle.plan, catalog, FIXED_DATES, now, { includePast: true, tasks, orgName: org.name }),
    [bundle.plan, catalog, now, tasks, org.name],
  )
  const feedItems = showPast ? feedAll : feedAll.filter((i) => !i.passed)
  const hiddenPast = feedAll.length - feedAll.filter((i) => !i.passed).length
  const upcoming = upcomingWithin(feedAll, 7)
  const universities = bundle.plan.universities.flatMap((e) => {
    const u = findUniversity(catalog, e.id)
    return u ? [{ id: u.id, name: u.name_ru ?? u.name }] : []
  })
  const count = bundle.plan.universities.length
  const answers = student.onboarding

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-5">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ChevronLeft /> К ученикам
        </Button>
      </motion.div>

      <motion.header variants={fadeUp} className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance text-accent-text sm:text-4xl">{studentLabel(student)}</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {count ? `${count} ${pluralRu(count, "вуз", "вуза", "вузов")} в плане` : "план пуст"} · визит: {lastSeenLabel(student.lastSeenAt, now)} · подключён{" "}
          {formatCheckedAt(bundle.mentorship.joinedAt)}
        </p>
      </motion.header>

      <div className="flex flex-col gap-4">
        <motion.div variants={fadeUp}>
          <Card className="gap-0 p-5">
            <div className="text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">Ответы онбординга</div>
            {profileIsFilled(answers) && answers ? (
              <p className="mt-2 text-sm leading-relaxed">{profileSummary(answers).join(" · ")}</p>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">Ученик ещё не ответил на пять вопросов.</p>
            )}
            <p className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-xs leading-relaxed text-fg-muted">
              <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>Ученик знает, что вы это видите: ему показана та же строка о видимости плана, документов, задач и ответов.</span>
            </p>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <TasksPanel
            tasks={sortTasks(tasks)}
            upcoming={upcoming}
            viewer={{ kind: "mentor", orgId: org.id }}
            universities={universities}
            orgName={org.name}
            withDetails
            onAdd={addTask}
            onToggle={toggleTask}
            onEdit={editTask}
            onDelete={(id) => void deleteTask(id)}
            onOpenUniversity={onOpenUniversity}
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
          <aside className="flex flex-col gap-4 lg:order-2">
            <motion.div variants={fadeUp}>
              <DeadlineFeed items={feedItems} hiddenPast={hiddenPast} showPast={showPast} onToggleShowPast={() => setShowPast((s) => !s)} onOpenUniversity={onOpenUniversity} />
            </motion.div>
          </aside>
          <div className="lg:order-1">
            {count === 0 ? (
              <motion.div variants={fadeUp}>
                <Card className="gap-0 p-5 text-sm text-fg-muted">План ученика пуст: вузы появятся здесь, как только он добавит их из каталога.</Card>
              </motion.div>
            ) : (
              <UniversityList
                catalog={catalog}
                plan={bundle.plan}
                notes={notes}
                orgName={org.name}
                readOnly
                renderNoteEditor={(u) => (
                  <NoteEditor
                    university={u}
                    note={notes.find((n) => n.universityId === u.id) ?? null}
                    onSave={(body) => saveNote(u.id, body)}
                    onDelete={() => deleteNote(u.id)}
                  />
                )}
                onOpen={onOpenUniversity}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
