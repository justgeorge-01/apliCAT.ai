import { Button } from "@/components/ui/button"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
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
      {/* 导师 «наставник» – the kicker of the invite, never a bare character */}
      <HanziKicker hanzi="导师" className="justify-center">
        Наставник
      </HanziKicker>

      <h2 className="mt-3 text-xl leading-snug font-bold text-balance text-accent-text">{title}</h2>

      {paragraphs.map((p, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed text-fg-muted">
          {p}
        </p>
      ))}

      {/* A plain link (not window.open): the only outbound action of the popup. */}
      <Button asChild size="xl" className="mt-6 w-full">
        <a href={partner.lead.url} target="_blank" rel="noopener noreferrer" onClick={onAccept}>
          {partner.lead.label}
        </a>
      </Button>

      <p className="mt-3 text-xs text-fg-muted">
        Откроется Телеграм в новой вкладке. Мы ничего туда не передаём – напишете сами.
      </p>
    </div>
  )
}

export default LeadInvite
