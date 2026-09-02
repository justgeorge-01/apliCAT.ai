import { MessageCircle } from "lucide-react"

import type { Partner, PartnerLead } from "@/lib/partner"

export interface LeadInviteProps {
  /** A partner WITH a lead link (narrowed by `hasLead`). */
  partner: Partner & { lead: PartnerLead }
  /** Called when the user follows the link – mark the popup accepted. */
  onAccept: () => void
}

const FALLBACK_TEXT =
  "Витрина показывает только формальные условия с официальных страниц вузов. Какой вуз выбрать, как собрать документы и в какой раунд подаваться – это разбирает наставник."

/**
 * Content of the lead popup (spec §3.7): «<партнёр> разбирает такие кейсы» and
 * one link to the partner's Telegram. No form, no data collection – the only
 * action is following the link. Copy comes from the partner config.
 */
export function LeadInvite({ partner, onAccept }: LeadInviteProps) {
  const title = partner.expertPage?.title ?? `${partner.name} разбирает такие кейсы`
  const paragraphs = partner.expertPage?.paragraphs?.length ? partner.expertPage.paragraphs : [FALLBACK_TEXT]

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <MessageCircle className="size-6" />
      </span>

      <h2 className="mt-4 text-xl font-bold tracking-tight text-fg">{title}</h2>

      {paragraphs.map((p, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed text-fg-muted">
          {p}
        </p>
      ))}

      {/* A plain link (not window.open): the only outbound action of the popup. */}
      <a
        href={partner.lead.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onAccept}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-[0_8px_24px_-8px_var(--color-accent-glow)] transition-all duration-200 outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {partner.lead.label}
      </a>

      <p className="mt-3 text-xs text-fg-faint">
        Откроется Телеграм в новой вкладке. Мы ничего туда не передаём – напишете сами.
      </p>
    </div>
  )
}

export default LeadInvite
