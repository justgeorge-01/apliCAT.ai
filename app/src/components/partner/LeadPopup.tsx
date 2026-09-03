import type { ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  BLUR_PX,
  CARD_MAX_HEIGHT_VH,
  CARD_MAX_WIDTH_PX,
  CLOSE_ON_OUTSIDE_CLICK,
  OVERLAY_TINT,
  SHOW_CLOSE_ICON,
} from "./lead.constants"

export interface LeadPopupProps {
  /** Controlled open state – bind to the trigger hook's `isOpen`. */
  open: boolean
  /** Called whenever the modal wants to close («Не сейчас», outside-click). */
  onClose: () => void
  /** The invite content (see <LeadInvite>). */
  children: ReactNode
  /** Accessible name for the dialog (screen readers). Not visible content. */
  ariaLabel?: string
  /** Label of the secondary exit button under the card. */
  skipLabel?: string

  /* ---- presentation overrides (default to lead.constants) ---- */
  blurPx?: number
  overlayTint?: string
  maxWidthPx?: number
  maxHeightVh?: number
  showCloseIcon?: boolean
  closeOnOutsideClick?: boolean
}

/**
 * Centered lead modal: a blurred + dark-tinted full-screen overlay, a
 * theme-aware card (app design tokens) dead-center, and a «Не сейчас» button on
 * the scrim just below it. Built on Radix Dialog (controlled) so focus-trap and
 * body-scroll-lock come for free.
 *
 * Animation: tw-animate-css `data-[state]` utilities – the same pattern as the
 * project's dialog.tsx (framer's mount-time animation left a portaled modal
 * stuck invisible under React 19 StrictMode). Disabled automatically by the
 * global `prefers-reduced-motion` rule in index.css.
 */
export function LeadPopup({
  open,
  onClose,
  children,
  ariaLabel = "Предложение обсудить план с наставником",
  skipLabel = "Не сейчас",
  blurPx = BLUR_PX,
  overlayTint = OVERLAY_TINT,
  maxWidthPx = CARD_MAX_WIDTH_PX,
  maxHeightVh = CARD_MAX_HEIGHT_VH,
  showCloseIcon = SHOW_CLOSE_ICON,
  closeOnOutsideClick = CLOSE_ON_OUTSIDE_CLICK,
}: LeadPopupProps) {
  // Radix asks to close → bubble up. (Opening is driven solely by the hook.)
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {/* Blurred, dark-tinted backdrop. Covers the app fully. */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[100]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200",
          )}
          style={{
            backgroundColor: overlayTint,
            backdropFilter: `blur(${blurPx}px)`,
            WebkitBackdropFilter: `blur(${blurPx}px)`,
          }}
        />

        {/* Content = full-screen flex centering [card] + [skip button]. Both live
            inside Radix Content so the focus-trap covers them. Outside-click is
            handled here (a click on the empty layer) and gated by the constant. */}
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby={undefined}
          // Close only via the buttons: block Esc here.
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2",
            "duration-300 ease-out",
          )}
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
          }}
          onClick={(e) => {
            if (closeOnOutsideClick && e.target === e.currentTarget) onClose()
          }}
        >
          <DialogPrimitive.Title className="sr-only">{ariaLabel}</DialogPrimitive.Title>

          {/* The card – white on paper, graphite in the ink theme. */}
          <div
            className={cn(
              "relative w-full overflow-y-auto rounded-lg border border-border",
              "bg-card p-6 text-fg shadow-2xl",
            )}
            // Cap against the real available space: leaves room for the skip
            // button + gaps so the column can't clip on short viewports.
            style={{ maxWidth: maxWidthPx, maxHeight: `min(${maxHeightVh}vh, calc(100dvh - 8rem))` }}
          >
            {showCloseIcon && (
              <DialogPrimitive.Close
                aria-label="Закрыть окно"
                className={cn(
                  "absolute top-3 right-3 grid size-11 place-items-center rounded-lg",
                  "text-fg-muted transition-colors duration-200 outline-none",
                  "hover:bg-fg/5 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60",
                )}
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            )}

            {children}
          </div>

          {/* Secondary exit: paper-outline button on the dark scrim, under the card. */}
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              aria-label="Закрыть окно"
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-2.5",
                "text-sm font-semibold text-paper",
                "border border-paper/40 bg-paper/10 backdrop-blur-sm",
                "transition-colors duration-200 outline-none",
                "hover:bg-paper/20 focus-visible:ring-2 focus-visible:ring-paper/70",
              )}
            >
              {skipLabel}
            </button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default LeadPopup
