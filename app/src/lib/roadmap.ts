import type { AnyProgram, RoadmapEntry, RoadmapStage, University } from "@/legacy"

export interface RoadmapProgressInfo {
  done: number
  total: number
  pct: number
  currentName: string | null
  stages: RoadmapStage[] | null
}

const isUniversity = (item: AnyProgram): item is University =>
  "program" in item && typeof (item as University).program === "string"

/** Checklist-based progress - mirror of the legacy roadmapProgress in shared.jsx */
export function roadmapProgress(rm: RoadmapEntry, item: AnyProgram): RoadmapProgressInfo {
  const stages =
    item && isUniversity(item) && typeof window.buildRoadmapStages === "function"
      ? window.buildRoadmapStages(item)
      : null

  if (!stages) {
    const total = 7
    const done = Math.min(rm.step || 0, total)
    return { done, total, pct: Math.round((done / total) * 100), currentName: null, stages: null }
  }

  let checked = 0
  let boxes = 0
  let doneStages = 0
  let currentName: string | null = null

  for (const s of stages) {
    const st = rm.checks?.[s.id] ?? []
    const full = s.checklist.length > 0 && s.checklist.every((_, i) => st[i])
    for (let i = 0; i < s.checklist.length; i++) {
      boxes++
      if (st[i]) checked++
    }
    if (full) doneStages++
    else if (!currentName) currentName = s.name
  }

  return {
    done: doneStages,
    total: stages.length,
    pct: boxes ? Math.round((checked / boxes) * 100) : 0,
    currentName,
    stages,
  }
}

export function lookupItem(id: string): AnyProgram | undefined {
  const d = window.AdmiticaData
  return (
    d.universities.find((u) => u.id === id) ||
    d.grants.find((g) => g.id === id) ||
    d.internships.find((i) => i.id === id)
  )
}

export function deadlineLabel(d: number): { txt: string; tone: "neutral" | "warn" | "info" | "danger" } {
  if (d > 900) return { txt: "Rolling", tone: "neutral" }
  if (d <= 0) return { txt: "Закрыто", tone: "danger" }
  if (d < 7) return { txt: `Через ${d} дн.`, tone: "warn" }
  if (d < 60) return { txt: `Через ${Math.round(d / 7)} нед.`, tone: d < 30 ? "warn" : "info" }
  return { txt: `Через ${Math.round(d / 30)} мес.`, tone: "neutral" }
}
