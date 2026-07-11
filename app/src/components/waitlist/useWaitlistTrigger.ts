import { useCallback, useEffect, useState } from "react"

import { usePersist } from "@/lib/persist"
import {
  DISMISS_COOLDOWN_DAYS,
  SCREENS_AFTER_ONBOARDING_THRESHOLD,
  WAITLIST_DISMISSED_AT_KEY,
  WAITLIST_SCREENS_KEY,
  WAITLIST_STATUS_KEY,
  type WaitlistStatus,
} from "./waitlist.constants"

export interface UseWaitlistTriggerOptions {
  /**
   * Current screen id (the active tab, e.g. "home" | "find" | "p_saved" …, or
   * "detail" for the overlay). Visiting a NEW id bumps the unique-screen count;
   * revisiting an already-seen id is a no-op.
   */
  screen: string | null | undefined
  /**
   * True once the user is past onboarding. While false, nothing is counted and
   * the popup never opens. Drive this from App's onboarding gate, i.e.
   * `Boolean(name)` (see ONBOARDED_KEY in waitlist.constants).
   */
  enabled: boolean
  /** Override the unique-screen threshold (defaults to the shared constant). */
  threshold?: number
}

export interface WaitlistTrigger {
  /** Whether the popup should be open right now. Bind to the Dialog `open`. */
  isOpen: boolean
  /** Force the popup open (e.g. from a manual "join waitlist" entry point). */
  open: () => void
  /** Close and mark as dismissed. Bind to «Пропустить» / Esc / outside-click. */
  close: () => void
  /** Mark the waitlist as submitted — final, never shows again. */
  markSubmitted: () => void
}

const MS_PER_DAY = 86_400_000

/**
 * Decides when the one-time waitlist popup should appear and persists its
 * lifecycle. Counts UNIQUE screens visited after onboarding (accumulated across
 * sessions via localStorage); once the threshold is hit it opens once, then a
 * dismissal/submission keeps it closed forever (unless DISMISS_COOLDOWN_DAYS
 * re-arms a dismissal).
 */
export function useWaitlistTrigger({
  screen,
  enabled,
  threshold = SCREENS_AFTER_ONBOARDING_THRESHOLD,
}: UseWaitlistTriggerOptions): WaitlistTrigger {
  // All three persist under `admitica.*` (see persist.ts), so the count and the
  // one-time status survive reloads and new sessions.
  const [status, setStatus] = usePersist<WaitlistStatus>(WAITLIST_STATUS_KEY, "unseen")
  const [screens, setScreens] = usePersist<string[]>(WAITLIST_SCREENS_KEY, [])
  const [dismissedAt, setDismissedAt] = usePersist<number | null>(WAITLIST_DISMISSED_AT_KEY, null)

  // Manual override so `open()` can re-surface the popup after a dismissal.
  const [forcedOpen, setForcedOpen] = useState(false)

  // Record each newly-visited screen — but only after onboarding. Repeated
  // visits return the same array reference, so usePersist doesn't re-write.
  useEffect(() => {
    if (!enabled || !screen) return
    setScreens((prev) => (prev.includes(screen) ? prev : [...prev, screen]))
  }, [enabled, screen, setScreens])

  // Optional re-arm: if a dismissal cooldown is configured (> 0) and it has
  // elapsed, flip the persisted status back to "unseen" so the popup can show
  // again. `submitted` is final and never re-arms. Reading the wall clock is a
  // one-shot external read, so it lives in an effect and writes via the updater
  // form (deriving render state inside an effect is what the lint rules forbid).
  useEffect(() => {
    if (DISMISS_COOLDOWN_DAYS <= 0 || dismissedAt == null) return
    if (Date.now() - dismissedAt < DISMISS_COOLDOWN_DAYS * MS_PER_DAY) return
    setStatus((prev) => (prev === "dismissed" ? "unseen" : prev))
    setDismissedAt(() => null)
  }, [dismissedAt, setStatus, setDismissedAt])

  const reachedThreshold = screens.length >= threshold
  const autoEligible = enabled && reachedThreshold && status === "unseen"

  const isOpen = autoEligible || forcedOpen

  const open = useCallback(() => setForcedOpen(true), [])

  // Any user exit (Esc / outside-click / «Пропустить») dismisses — EXCEPT we
  // never downgrade a completed 'submitted' back to 'dismissed'. Radix fires
  // onOpenChange only on user-initiated closes, not when the controlled `open`
  // prop flips (markSubmitted closes the modal that way), so close() normally
  // isn't even called on the accept path. The functional updater is then pure
  // belt-and-suspenders: if a close() ever races in (e.g. a stray Esc in the
  // same tick), it still can't clobber the submission. (Stamping dismissedAt is
  // harmless when status stays 'submitted' — the cooldown only re-arms 'dismissed'.)
  const close = useCallback(() => {
    setForcedOpen(false)
    setStatus((prev) => (prev === "submitted" ? prev : "dismissed"))
    setDismissedAt(Date.now())
  }, [setStatus, setDismissedAt])

  const markSubmitted = useCallback(() => {
    setForcedOpen(false)
    setStatus("submitted")
  }, [setStatus])

  return { isOpen, open, close, markSubmitted }
}

export default useWaitlistTrigger
