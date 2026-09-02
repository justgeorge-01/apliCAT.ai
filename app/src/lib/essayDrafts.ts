import { readPersist } from "@/lib/persist"

/**
 * Essay prompts and the «best draft for a university» lookup – shared between
 * the Essay page and the legacy Detail (Uni-fit). Kept in `lib/` so pages
 * export only components (react-refresh/only-export-components).
 * Legacy feature, mounted only behind `FEATURES.ai`.
 */
export interface EssayPrompt {
  id: string
  uniId: string
  target: string
}

export const ESSAY_PROMPTS: EssayPrompt[] = [
  { id: "ps_bocconi", uniId: "u1", target: "Bocconi · Personal Statement" },
  { id: "sop_lse", uniId: "u2", target: "LSE · Statement of Purpose" },
  { id: "mot_hec", uniId: "u3", target: "HEC · Motivation Letter" },
]

/** Best essay the student wrote for a university: checks the Bank key ("uni_<id>")
 *  and any starter prompt that targets this uni. Returns the longest non-empty draft. */
export function essayForUni(uniId: string): string {
  const drafts = readPersist<Record<string, string>>("essayDrafts", {})
  const keys = ["uni_" + uniId, ...ESSAY_PROMPTS.filter((p) => p.uniId === uniId).map((p) => p.id)]
  let best = ""
  for (const k of keys) {
    const t = (drafts[k] || "").trim()
    if (t.length > best.length) best = t
  }
  return best
}
