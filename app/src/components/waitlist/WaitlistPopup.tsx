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
} from "./waitlist.constants"

export interface WaitlistPopupProps {
  /** Controlled open state — bind to the trigger hook's `isOpen`. */
  open: boolean
  /** Called whenever the modal wants to close (Esc, «Пропустить», outside-click). */
  onClose: () => void
  /**
   * The waitlist form goes here later. Empty for now — the visible placeholder
   * below renders while this slot is empty.
   */
  children?: ReactNode
  /** Accessible name for the dialog (screen readers). Not visible content. */
  ariaLabel?: string
  /** Label of the secondary exit button under the card. */
  skipLabel?: string

  /* ---- presentation overrides (default to waitlist.constants) ---- */
  blurPx?: number
  overlayTint?: string
  maxWidthPx?: number
  maxHeightVh?: number
  showCloseIcon?: boolean
  closeOnOutsideClick?: boolean
}

/**
 * Centered, blocking waitlist modal: a blurred + dark-tinted full-screen
 * overlay, a theme-aware card (app design tokens) dead-center, and a white
 * «Пропустить»/«Не сейчас» button on the dark scrim just below it. Same
 * behaviour on desktop and mobile — only the size/margins differ. Built on Radix Dialog (controlled) so focus-trap, Esc,
 * and body-scroll-lock come for free.
 *
 * Animation: the entrance/exit use tw-animate-css `data-[state]` utilities —
 * the same proven pattern as the project's own dialog.tsx (overlay fades in
 * carrying the blur; the content layer fades + zooms 95→100 + rises). This is
 * deliberately NOT framer-motion: framer's mount-time `initial→animate` left the
 * portaled modal stuck at `initial` (opacity 0) under React 19 StrictMode, i.e.
 * an invisible modal. The CSS approach is reliable in dev and prod and is
 * disabled automatically by the global `prefers-reduced-motion` rule in
 * index.css (instant appearance), satisfying the reduced-motion requirement.
 *
 * Scaffold only: renders {children}, or a visible placeholder while empty.
 */
export function WaitlistPopup({
  open,
  onClose,
  children,
  ariaLabel = "Лист ожидания Admitica",
  skipLabel = "Пропустить",
  blurPx = BLUR_PX,
  overlayTint = OVERLAY_TINT,
  maxWidthPx = CARD_MAX_WIDTH_PX,
  maxHeightVh = CARD_MAX_HEIGHT_VH,
  showCloseIcon = SHOW_CLOSE_ICON,
  closeOnOutsideClick = CLOSE_ON_OUTSIDE_CLICK,
}: WaitlistPopupProps) {
  // TODO: контент формы вейтлиста (поля + согласие) — заполняется отдельно.
  // Сейчас здесь только пустой слот {children} и видимая заглушка ниже.

  // Radix asks to close → bubble up. (Opening is driven solely by the hook.)
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {/* Blurred, dark-tinted backdrop. Fades in (carrying the blur, so the
            blur "appears"). Covers the app fully, so nothing behind is clickable. */}
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
            inside Radix Content so the focus-trap covers them. The layer fills the
            screen, so Radix's own onPointerDownOutside never fires; outside-click
            is handled here — a click on the empty backdrop (target === this layer)
            closes when allowed. The whole layer fades + zooms in, which reads as
            the card + button rising into place. */}
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby={undefined}
          // Close only via the buttons: block Esc here, and outside-click is
          // gated by CLOSE_ON_OUTSIDE_CLICK (default off) in the onClick below.
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
          {/* Accessible name (visually hidden) — satisfies Radix's title
              requirement and screen readers; not visible form copy. */}
          <DialogPrimitive.Title className="sr-only">{ariaLabel}</DialogPrimitive.Title>

          {/* The card — uses the app's own design tokens (theme-aware, like the
              project's dialog.tsx): dark surface in dark theme, white in light.
              Sits on the dark blurred scrim either way. */}
          <div
            className={cn(
              "relative w-full overflow-y-auto rounded-2xl border border-border",
              "bg-card p-6 text-fg shadow-2xl",
            )}
            // Cap against the real available space, not raw vh: leaves room for
            // the «Пропустить» button + gaps + padding so the column can't
            // overflow / clip on short or landscape viewports. dvh tracks the
            // mobile URL bar.
            style={{ maxWidth: maxWidthPx, maxHeight: `min(${maxHeightVh}vh, calc(100dvh - 8rem))` }}
          >
            {/* Optional corner X (off by default — «Пропустить» is the exit). */}
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

            {/* === waitlist form slot ===
                TODO: контент формы вейтлиста (поля + согласие).
                Empty for now → the placeholder shows; pass children later to fill
                (auto-hides the placeholder). */}
            {children ?? (
              <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border-strong px-4 py-10 text-center">
                <span className="text-sm font-medium text-fg-muted">Слот контента вейтлиста</span>
                <span className="mt-1 text-xs text-fg-faint">поля + согласие добавляются отдельно</span>
              </div>
            )}
          </div>

          {/* Primary exit: white button on the blurred overlay, under the card. */}
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              aria-label="Пропустить и закрыть окно"
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-full px-6 py-2.5",
                "text-sm font-semibold text-white",
                "border border-white/30 bg-white/10 backdrop-blur-sm",
                "transition-colors duration-200 outline-none",
                "hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70",
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

export default WaitlistPopup
