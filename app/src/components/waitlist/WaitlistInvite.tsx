import { Sparkles } from "lucide-react"

export interface WaitlistInviteProps {
  /** Called when the user accepts (clicks the CTA) — mark the popup submitted. */
  onAccept: () => void
}

// The waitlist form lives on its own static page (opens in a new tab). Built
// from the Vite base so it resolves on GitHub Pages regardless of the sub-path.
const FORM_URL = `${import.meta.env.BASE_URL}waitlist.html`

/**
 * First-screen content of the waitlist popup — a friendly, NON-blocking invite.
 * Makes explicit that access isn't restricted; we're only asking whether the
 * user liked Admitica. The CTA opens the waitlist form (Yandex Form placeholder)
 * in a new tab and marks the popup submitted so it won't ask again.
 *
 * Styling uses the app's own design tokens (teal accent, fg/fg-muted), so it
 * matches the rest of the site and follows the active theme.
 */
export function WaitlistInvite({ onAccept }: WaitlistInviteProps) {
  const accept = () => {
    // Open synchronously inside the click handler so the browser doesn't treat
    // it as a blocked popup, then mark submitted (closes the modal).
    window.open(FORM_URL, "_blank", "noopener,noreferrer")
    onAccept()
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <Sparkles className="size-6" />
      </span>

      <h2 className="mt-4 text-xl font-bold tracking-tight text-fg">Нравится Admitica?</h2>

      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Доступ остаётся открытым — мы ничего не блокируем, пользуйтесь сколько угодно.
        Нам просто важно ваше мнение: если сервис оказался полезным, оставьте контакт —
        и мы позовём вас первыми, когда откроем полную версию.
      </p>

      <button
        type="button"
        onClick={accept}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition-colors duration-200 outline-none hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Да, оставить контакт →
      </button>

      <p className="mt-3 text-xs text-fg-faint">Откроется короткая форма в новой вкладке.</p>
    </div>
  )
}

export default WaitlistInvite
