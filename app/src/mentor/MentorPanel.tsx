import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"

import { fadeUp, stagger } from "@/lib/motion"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Segmented } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useCabinet } from "@/auth/useCabinet"
import type { Catalog } from "@/data/china.types"
import { errorMessageRu, studentRows, type Organization, type StudentBundle } from "@/lib/cabinet"
import { useNow } from "@/lib/useNow"
import { MentorInvite } from "./MentorInvite"
import { MentorSettings } from "./MentorSettings"
import { MentorStudent } from "./MentorStudent"
import { MentorStudents } from "./MentorStudents"

type View = "students" | "invite" | "settings"

export interface MentorPanelProps {
  catalog: Catalog
  onOpenUniversity: (id: string) => void
}

/**
 * Панель наставника (cabinet spec §5): students · invitation · organization
 * (admin). Shown to members of an organization; a person who is both a
 * student and a mentor keeps the student tabs too.
 */
export default function MentorPanel({ catalog, onOpenUniversity }: MentorPanelProps) {
  const toast = useToast()
  const cabinet = useCabinet()
  const now = useNow()
  const api = cabinet.backend?.data ?? null
  const [chosenOrgId, setOrgId] = useState<string | null>(null)
  // brand edits made in «Организация» before the memberships are reloaded
  const [orgOverrides, setOrgOverrides] = useState<Record<string, Organization>>({})
  const [view, setView] = useState<View>("students")
  const [studentId, setStudentId] = useState<string | null>(null)
  // students of one organization; a different org id means «not loaded yet»
  const [loadedStudents, setStudents] = useState<{ orgId: string; list: StudentBundle[] } | null>(null)

  const membership = cabinet.memberships.find((m) => m.org.id === chosenOrgId) ?? cabinet.memberships[0] ?? null
  const orgId = membership?.org.id ?? null
  const org = orgId ? (orgOverrides[orgId] ?? membership?.org ?? null) : null
  const isAdmin = membership?.role === "admin"

  useEffect(() => {
    if (!api || !orgId) return
    let alive = true
    api
      .listStudents(orgId)
      .then((list) => alive && setStudents({ orgId, list }))
      .catch((e: unknown) => alive && toast(errorMessageRu(e)))
    return () => {
      alive = false
    }
  }, [api, orgId, toast])

  const students = loadedStudents?.orgId === orgId ? loadedStudents.list : null
  const loading = students === null
  const updateStudents = useCallback(
    (fn: (list: StudentBundle[]) => StudentBundle[]) => setStudents((s) => (s ? { ...s, list: fn(s.list) } : s)),
    [],
  )

  const rows = useMemo(() => (students ? studentRows(students, catalog, now) : []), [students, catalog, now])

  const remove = async (sid: string) => {
    if (!api || !orgId) return false
    try {
      await api.removeStudent(orgId, sid)
      updateStudents((list) => list.filter((s) => s.profile.userId !== sid))
      if (studentId === sid) setStudentId(null)
      toast("Ученик снят с сопровождения")
      return true
    } catch (e) {
      toast(errorMessageRu(e))
      return false
    }
  }

  if (!api || !cabinet.signed) return null

  const current = studentId ? (students?.find((s) => s.profile.userId === studentId) ?? null) : null

  if (current && org && cabinet.user) {
    return (
      <MentorStudent
        api={api}
        catalog={catalog}
        org={org}
        viewerId={cabinet.user.id}
        bundle={current}
        now={now}
        onBack={() => setStudentId(null)}
        onOpenUniversity={onOpenUniversity}
        onChanged={(b) => updateStudents((list) => list.map((s) => (s.profile.userId === b.profile.userId ? b : s)))}
      />
    )
  }

  const options: { id: View; label: string }[] = [
    { id: "students", label: "Ученики" },
    { id: "invite", label: "Приглашение" },
    ...(isAdmin ? [{ id: "settings" as const, label: "Организация" }] : []),
  ]

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
        <HanziKicker hanzi="导师">Наставник</HanziKicker>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-accent-text sm:text-4xl">{org?.name ?? "Панель наставника"}</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {membership ? (isAdmin ? "Вы администратор организации" : "Вы наставник организации") : "Вы не состоите ни в одной организации"}
        </p>
        {cabinet.memberships.length > 1 && (
          <div className="mt-3 max-w-xs">
            <Select value={orgId ?? ""} onChange={(e) => setOrgId(e.target.value)} aria-label="Организация">
              {cabinet.memberships.map((m) => (
                <option key={m.org.id} value={m.org.id}>
                  {m.org.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </motion.div>

      {org && (
        <>
          <motion.div variants={fadeUp} className="mb-4">
            <Segmented value={view} onChange={setView} options={options} />
          </motion.div>
          {view === "students" && <MentorStudents rows={rows} loading={loading} now={now} onOpen={setStudentId} onRemove={remove} />}
          {view === "invite" && <MentorInvite api={api} orgId={org.id} isAdmin={isAdmin} />}
          {view === "settings" && isAdmin && (
            <MentorSettings api={api} org={org} isAdmin={isAdmin} onOrgChanged={(o) => setOrgOverrides((m) => ({ ...m, [o.id]: o }))} />
          )}
        </>
      )}
    </motion.div>
  )
}
