import { useId, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatCheckedAt } from "@/data/china"
import type { Fact } from "@/data/china.types"
import { PROVENANCE_ICON, PROVENANCE_VARIANT, provenanceOf } from "@/lib/provenance"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

const CERTAINTY_CAVEAT: Record<Fact["certainty"], string | null> = {
  verified: null,
  estimate: "оценка",
  community_estimate: "оценка сообщества",
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export interface ProvenanceBadgeProps {
  fact: Fact
  className?: string
}

/**
 * Provenance badge of one fact. Click expands the verbatim quote and the link
 * to the official page. Renders a fragment – the badge button and, when open,
 * a full-width panel – so it sits inside a `flex flex-wrap` meta line and the
 * panel wraps onto its own line.
 */
export function ProvenanceBadge({ fact, className }: ProvenanceBadgeProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const p = provenanceOf(fact)
  const Icon = PROVENANCE_ICON[p.kind]
  const caveat = CERTAINTY_CAVEAT[fact.certainty]
  const snap = fact.snapshot

  return (
    <>
      <Badge asChild variant={PROVENANCE_VARIANT[p.kind]} className={cn("gap-1.5 py-0.5 pr-2 pl-1 whitespace-normal", className)}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          title={open ? "Скрыть источник" : "Показать цитату и ссылку на источник"}
          className={cn(
            "cursor-pointer text-left outline-none hover:brightness-110",
            p.kind === "demo" && "text-fg-faint",
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{p.label}</span>
          {caveat && <span className="opacity-80">· {caveat}</span>}
          <ChevronDown
            aria-hidden="true"
            className={cn("transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      </Badge>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="w-full overflow-hidden"
          >
            {/* the cream insert with the red line on its left – with or without a quote */}
            <div className="rounded-lg border border-border border-l-2 border-l-accent bg-card-2 p-3.5 text-[13px] leading-relaxed">
              {fact.quote ? (
                <blockquote className="text-fg-muted italic">«{fact.quote}»</blockquote>
              ) : (
                <p className="text-fg-faint">
                  Дословная цитата не сохранена: сверьте значение на официальной странице.
                </p>
              )}
              <p className="mt-2.5 text-xs text-fg-muted">{p.note}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted">
                <a
                  href={fact.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 font-medium text-accent-text hover:underline"
                >
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">Официальная страница · {hostOf(fact.source_url)}</span>
                </a>
                <span>проверено {formatCheckedAt(fact.verified_at)}</span>
                {snap?.render_method !== "wayback" && snap?.fetched_at && (
                  <span>снимок {formatCheckedAt(snap.fetched_at)}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** The state icon alone – for compact lines (the catalog card) where the full badge is too heavy. */
export function ProvenanceIcon({ fact, className }: { fact: Fact; className?: string }) {
  const Icon = PROVENANCE_ICON[provenanceOf(fact).kind]
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden="true" />
}

export default ProvenanceBadge
