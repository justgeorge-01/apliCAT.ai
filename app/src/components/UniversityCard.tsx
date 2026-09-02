import { useState } from "react"
import { motion } from "framer-motion"
import {
  Banknote,
  BookmarkCheck,
  BookmarkPlus,
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Info,
  Languages,
  Link,
  MapPin,
  Minus,
} from "lucide-react"

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

/* ---------- one fact: `display` as is + provenance (date + official link) ---------- */

function FactLine({ fact }: { fact: Fact }) {
  return (
    <div className="min-w-0">
      <div className="text-sm leading-snug break-words">{fact.display}</div>
      <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-fg-muted">
        <span>{provenanceText(fact)}</span>
        <span className="text-fg-faint" aria-hidden="true">
          ·
        </span>
        <a
          href={fact.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          <Link className="size-3" aria-hidden="true" />
          источник
        </a>
      </div>
    </div>
  )
}

/* ---------- a card row: label, facts (or the honest empty line), optional lead (badge) ---------- */

function FactRow({
  icon: Icon,
  label,
  facts,
  emptyText,
  lead,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
  label: string
  facts: Fact[]
  /** Printed when there is no fact – never a skipped row. */
  emptyText: string
  lead?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-fg-muted">{label}</div>
        {lead && <div className="mt-1">{lead}</div>}
        {facts.length > 0 ? (
          <div className="mt-1 grid gap-1.5">
            {facts.map((f, i) => (
              <FactLine key={`${f.key}:${i}`} fact={f} />
            ))}
          </div>
        ) : (
          <div className="mt-0.5 text-sm text-fg-muted">{emptyText}</div>
        )}
      </div>
    </div>
  )
}

/* ---------- match block: words only ---------- */

const TONE = {
  ok: { icon: CircleCheck, className: "text-positive" },
  gaps: { icon: CircleAlert, className: "text-warning" },
  unknown: { icon: Info, className: "text-fg-muted" },
} as const

function MatchBlock({ match }: { match: MatchResult }) {
  const [open, setOpen] = useState(false)
  const summary = matchSummary(match)
  const tone = TONE[summary.tone]
  const ToneIcon = tone.icon
  const lines = [
    ...match.gaps.map((t) => ({ t, icon: CircleAlert, cls: "text-warning" })),
    ...match.ok.map((t) => ({ t, icon: Check, cls: "text-positive" })),
    ...match.unknown.map((t) => ({ t, icon: Minus, cls: "text-fg-faint" })),
  ]

  return (
    <div className="rounded-xl border border-border bg-card-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        {/* the sentence stays in fg (readable on white); only the icon carries the tone */}
        <div className="flex min-w-0 items-start gap-1.5 text-[13px] leading-snug">
          <ToneIcon className={cn("mt-0.5 size-3.5 shrink-0", tone.className)} aria-hidden="true" />
          <span>
            <span className="text-fg-muted">По профилю: </span>
            {summary.text}
          </span>
        </div>
        {lines.length > 0 && (
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
        <ul className="mt-2 grid gap-1 text-[13px] leading-snug">
          {lines.map(({ t, icon: I, cls }, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <I className={cn("mt-0.5 size-3.5 shrink-0", cls)} aria-hidden="true" />
              <span className="min-w-0 break-words">{t}</span>
            </li>
          ))}
        </ul>
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
 * University card of the catalog (spec §3.2), modelled on ProgramCard:
 * p-5 sm:p-6 · tile size-10 · title 15px medium (wraps) · subtitle 13px ·
 * footer pt-3 gap-2. Prints `fact.display` as is; every fact row carries its
 * verification date and the official source link; an empty row says so.
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

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: EASE }} className="h-full">
      <Card className="h-full gap-4 p-5 sm:p-6" data-university={u.id}>
        {/* head */}
        <div className="flex items-start gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-base font-semibold text-accent-text"
            aria-hidden="true"
          >
            {u.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(u)}
                className="rounded-sm text-left text-[15px] leading-snug font-medium break-words underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {title}
              </button>
            ) : (
              <div className="text-[15px] leading-snug font-medium break-words">{title}</div>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-fg-muted">
              {u.name_ru && <span className="min-w-0 break-words">{u.name}</span>}
              {u.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  {u.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {partnerNote && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{partnerNote}</Badge>
          </div>
        )}

        {/* three key facts + CSCA */}
        <div className="grid gap-3">
          <FactRow icon={CalendarClock} label="Дедлайн подачи" facts={deadline} emptyText={empty} />
          <FactRow icon={Banknote} label="Стоимость обучения в год" facts={tuition} emptyText={empty} />
          <FactRow icon={Languages} label="Язык обучения и сертификат" facts={language} emptyText={empty} />
          <FactRow
            icon={ClipboardList}
            label="CSCA"
            facts={csca ? [csca] : []}
            emptyText={cscaEmptyText(u)}
            lead={<CscaBadge u={u} />}
          />
        </div>

        {/* profile match – words only */}
        {match ? (
          <MatchBlock match={match} />
        ) : (
          <div className="text-xs text-fg-muted">Соответствие не считается: профиль не заполнен</div>
        )}

        {/* footer */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <CoverageLine u={u} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={inPlan ? "secondary" : "outline"}
              size="sm"
              aria-pressed={inPlan}
              className={cn(inPlan && "text-accent-text")}
              onClick={() => onTogglePlan(u.id)}
            >
              {inPlan ? <BookmarkCheck /> : <BookmarkPlus />}
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
