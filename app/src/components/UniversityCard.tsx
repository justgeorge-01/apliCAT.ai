import { useState } from "react"
import { ProvenanceIcon } from "@/components/ProvenanceBadge"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

import { CoverageLine } from "@/components/CoverageLine"
import { CscaBadge } from "@/components/CscaBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { factOf, factsOf } from "@/data/china"
import type { Fact, University } from "@/data/china.types"
import { cscaEmptyText, displayName, emptyFactText, matchSummary, provenanceText } from "@/lib/catalogView"
import type { MatchResult } from "@/lib/match"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}

/* ---------- one fact: `display` as is + the stamped provenance line ---------- */

function FactLine({ fact, sublabel }: { fact: Fact; sublabel?: string }) {
  return (
    <div className="min-w-0">
      {/* `display` is printed as is; the sub-label (the fact's own `label_ru`) only names it */}
      <div className="text-sm leading-snug break-words text-fg">
        {sublabel && <span className="text-fg-muted">{sublabel} – </span>}
        {fact.display}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-none text-fg-muted">
        <ProvenanceIcon fact={fact} />
        <span>{provenanceText(fact)}</span>
        <span className="text-fg-faint" aria-hidden="true">
          ·
        </span>
        <a
          href={fact.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-border-strong underline-offset-2 transition-colors hover:text-accent-text hover:decoration-current"
        >
          источник
        </a>
      </div>
    </div>
  )
}

/* ---------- a card row: label, facts (or the honest empty line), optional lead (badge) ---------- */

function FactRow({
  label,
  facts,
  emptyText,
  lead,
  sublabels = false,
}: {
  label: string
  facts: Fact[]
  /** Printed when there is no fact – never a skipped row. */
  emptyText: string
  lead?: React.ReactNode
  /** Rows that group several keys name each fact with its own `label_ru` («Минимальный уровень HSK – 5»). */
  sublabels?: boolean
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="font-body text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">{label}</dt>
      <dd className="mt-1.5 grid gap-2">
        {lead}
        {facts.length > 0 ? (
          facts.map((f, i) => (
            <FactLine key={`${f.key}:${i}`} fact={f} sublabel={sublabels ? f.label_ru : undefined} />
          ))
        ) : (
          <p className="text-sm leading-snug text-fg-muted">{emptyText}</p>
        )}
      </dd>
    </div>
  )
}

/* ---------- match block: words only ---------- */

const TONE = {
  ok: { mark: "bg-positive", text: "text-positive", rule: "border-positive" },
  gaps: { mark: "bg-warning", text: "text-warning", rule: "border-warning" },
  unknown: { mark: "bg-fg-faint", text: "text-fg-muted", rule: "border-border-strong" },
} as const

function MatchBlock({ match }: { match: MatchResult }) {
  const [open, setOpen] = useState(false)
  const summary = matchSummary(match)
  const tone = TONE[summary.tone]
  const groups = [
    { key: "gaps", title: "Не хватает", items: match.gaps, tone: TONE.gaps },
    { key: "ok", title: "Подходит", items: match.ok, tone: TONE.ok },
    { key: "unknown", title: "Не проверено", items: match.unknown, tone: TONE.unknown },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="rounded-lg border border-border bg-card-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        {/* the sentence stays in fg (readable on cream); only the mark carries the tone */}
        <div className="flex min-w-0 items-center gap-2 text-[13px] leading-snug">
          <span className={cn("size-2 shrink-0 rounded-[1px]", tone.mark)} aria-hidden="true" />
          <span>
            <span className="text-fg-muted">По профилю: </span>
            <span className="font-semibold text-fg">{summary.text}</span>
          </span>
        </div>
        {groups.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "свернуть" : "подробнее"}
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2.5 grid gap-2.5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className={cn("font-body text-xs font-semibold tracking-[0.14em] uppercase", g.tone.text)}>
                {g.title}
              </div>
              <ul className={cn("mt-1 grid gap-1 border-l-2 pl-2.5 text-[13px] leading-snug", g.tone.rule)}>
                {g.items.map((t, i) => (
                  <li key={i} className="min-w-0 break-words">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- card ---------- */

export interface UniversityCardProps {
  u: University
  inPlan: boolean
  onTogglePlan: (id: string) => void
  /** Opens the university page; when absent the card has no «Подробнее». */
  onOpen?: (u: University) => void
  /** `null` – the profile is not filled, so nothing is compared. */
  match: MatchResult | null
  /** Optional partner highlight, e.g. «в списке Zhuiqiu». */
  partnerNote?: string | null
}

/**
 * University card of the catalog (spec §3.2) in the «Азия / красный» system:
 * a white card on paper with a thin rim · Playfair title, muted city · fact
 * rows separated by hairlines, each provenance line stamped with a seal ·
 * CSCA label · the coverage scale as the footer's rule · red «В мой план».
 * Prints `fact.display` as is; every fact row carries its verification date
 * and the official source link; an empty row says so.
 */
export function UniversityCard({ u, inPlan, onTogglePlan, onOpen, match, partnerNote }: UniversityCardProps) {
  const title = displayName(u)
  const deadline = factsOf(u, "deadline.fall.application_non_eu")
  const tuition = factsOf(u, "fees.tuition_year_non_eu")
  const language = [
    ...factsOf(u, "requirements.language_of_instruction"),
    ...factsOf(u, "requirements.hsk_min"),
    ...factsOf(u, "requirements.ielts_min"),
  ]
  const csca = factOf(u, "requirements.csca_required")
  const empty = emptyFactText(u)
  const titleClass = "font-display text-[17px] leading-snug font-bold break-words text-fg"

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: EASE }} className="h-full">
      <Card className="h-full gap-4 p-5 sm:p-6" data-university={u.id}>
        {/* head */}
        <div className="min-w-0">
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(u)}
              className={cn(
                titleClass,
                "rounded-sm text-left underline-offset-4 transition-colors outline-none hover:text-accent-text hover:underline focus-visible:ring-2 focus-visible:ring-accent/60",
              )}
            >
              {title}
            </button>
          ) : (
            <div className={titleClass}>{title}</div>
          )}
          {(u.name_ru || u.city) && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-fg-muted">
              {u.name_ru && <span className="min-w-0 break-words">{u.name}</span>}
              {u.name_ru && u.city && (
                <span className="text-fg-faint" aria-hidden="true">
                  ·
                </span>
              )}
              {u.city && <span>{u.city}</span>}
            </div>
          )}
          {partnerNote && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{partnerNote}</Badge>
            </div>
          )}
        </div>

        {/* three key facts + CSCA – hairlines between the rows */}
        <dl className="divide-y divide-border">
          <FactRow label="Дедлайн подачи" facts={deadline} emptyText={empty} />
          <FactRow label="Стоимость обучения в год" facts={tuition} emptyText={empty} />
          <FactRow label="Язык обучения и сертификат" facts={language} emptyText={empty} sublabels />
          <FactRow label="CSCA" facts={csca ? [csca] : []} emptyText={cscaEmptyText(u)} lead={<CscaBadge u={u} />} />
        </dl>

        {/* profile match – words only */}
        {match ? (
          <MatchBlock match={match} />
        ) : (
          <p className="text-xs text-fg-muted">Соответствие не считается: профиль не заполнен</p>
        )}

        {/* footer: the coverage scale is the rule, then the actions */}
        <div className="mt-auto">
          <CoverageLine u={u} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant={inPlan ? "secondary" : "default"}
              size="sm"
              aria-pressed={inPlan}
              onClick={() => onTogglePlan(u.id)}
            >
              {inPlan && <Check className="size-3.5" aria-hidden="true" />}
              {inPlan ? "В плане" : "В мой план"}
            </Button>
            {onOpen && (
              <Button variant="outline" size="sm" onClick={() => onOpen(u)}>
                Подробнее
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
