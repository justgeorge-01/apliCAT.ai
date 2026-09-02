import { useId, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Archive, Bot, ChevronDown, ExternalLink, FlaskConical, UserCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { badgeVariants } from "@/components/ui/badge-variants"
import type { VariantProps } from "class-variance-authority"
import { formatCheckedAt } from "@/data/china"
import type { Fact } from "@/data/china.types"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * The four provenance states of a fact (spec §3.3):
 *  - auto    – extracted by the pipeline from a fetch/browser snapshot;
 *  - manual  – typed in by an operator in the Пульт;
 *  - wayback – the official page was unreachable, the value comes from an
 *              archive.org copy (`snapshot.render_method === "wayback"`);
 *  - demo    – the built-in fixture, plainly grey.
 */
type ProvenanceKind = "auto" | "manual" | "wayback" | "demo"

interface Provenance {
  kind: ProvenanceKind
  /** Badge text, e.g. «проверено автоматически · 31 августа 2026». */
  label: string
  /** One-line explanation inside the expanded panel. */
  note: string
}

function provenanceOf(fact: Fact): Provenance {
  const checked = formatCheckedAt(fact.verified_at)
  if (fact.origin === "demo") {
    return {
      kind: "demo",
      label: `демо · ${checked}`,
      note: "Демо-факт: перенесён вручную с официальной страницы, конвейер проверки не проходил.",
    }
  }
  if (fact.snapshot?.render_method === "wayback") {
    const archived = formatCheckedAt(fact.snapshot.archived_at ?? fact.verified_at)
    return {
      kind: "wayback",
      label: `по архивной копии от ${archived}`,
      note: `Официальная страница была недоступна, значение взято из архивной копии (archive.org) от ${archived}.`,
    }
  }
  if (fact.origin === "manual") {
    return {
      kind: "manual",
      label: `проверено вручную · ${checked}`,
      note: "Значение введено оператором по официальной странице вуза.",
    }
  }
  const fetched = fact.snapshot?.fetched_at ? formatCheckedAt(fact.snapshot.fetched_at) : null
  return {
    kind: "auto",
    label: `проверено автоматически · ${checked}`,
    note: fetched
      ? `Значение извлечено конвейером из снимка официальной страницы от ${fetched}.`
      : "Значение извлечено конвейером из снимка официальной страницы.",
  }
}

const ICONS: Record<ProvenanceKind, typeof Bot> = {
  auto: Bot,
  manual: UserCheck,
  wayback: Archive,
  demo: FlaskConical,
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

/** Teal for pipeline/operator checks, warning for an archive copy, plain grey for demo. */
const VARIANTS: Record<ProvenanceKind, BadgeVariant> = {
  auto: "default",
  manual: "default",
  wayback: "warning",
  demo: "secondary",
}

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
  const Icon = ICONS[p.kind]
  const caveat = CERTAINTY_CAVEAT[fact.certainty]
  const snap = fact.snapshot

  return (
    <>
      <Badge asChild variant={VARIANTS[p.kind]} className={cn("whitespace-normal", className)}>
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
          <Icon aria-hidden="true" />
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
            <div className="rounded-xl border border-border bg-card-2 p-3.5 text-[13px] leading-relaxed">
              {fact.quote ? (
                <blockquote className="border-l-2 border-accent-text/50 pl-3 text-fg-muted italic">
                  «{fact.quote}»
                </blockquote>
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

export default ProvenanceBadge
