import { useCallback, useEffect, useState } from "react"

import { usePersist } from "@/lib/persist"
import {
  DISMISS_COOLDOWN_DAYS,
  LEAD_DISMISSED_AT_KEY,
  LEAD_SCREENS_KEY,
  LEAD_STATUS_KEY,
  SCREENS_AFTER_ONBOARDING_THRESHOLD,
  type LeadStatus,
} from "./lead.constants"

export interface UseLeadTriggerOptions {
  /**
   * Current screen id (the active tab, e.g. "home" | "find" | "plan", or
   * "detail" for the overlay). Visiting a NEW id bumps the unique-screen count;
   * revisiting an already-seen id is a no-op.
   */
  screen: string | null | undefined
  /**
   * True once the user is past onboarding AND the partner has a lead link.
   * While false, nothing is counted and the popup never opens.
   */
  enabled: boolean
  /** Override the unique-screen threshold (defaults to the shared constant). */
  threshold?: number
}

export interface LeadTrigger {
  /** Whether the popup should be open right now. Bind to the Dialog `open`. */
  isOpen: boolean
  /** Force the popup open (e.g. from a manual entry point). */
  open: () => void
  /** Close and mark as dismissed. Bind to «Не сейчас» / Esc / outside-click. */
  close: () => void
  /** The user followed the lead link – final, never shows again. */
  markAccepted: () => void
}

const MS_PER_DAY = 86_400_000

/**
 * Decides when the one-time lead popup should appear and persists its
 * lifecycle under `admitica.cn.lead.*`. Counts UNIQUE screens visited after
 * onboarding (accumulated across sessions); once the threshold is hit it opens
 * once, then a dismissal / acceptance keeps it closed forever (unless
 * DISMISS_COOLDOWN_DAYS re-arms a dismissal).
 */
export function useLeadTrigger({
  screen,
  enabled,
  threshold = SCREENS_AFTER_ONBOARDING_THRESHOLD,
}: UseLeadTriggerOptions): LeadTrigger {
  const [status, setStatus] = usePersist<LeadStatus>(LEAD_STATUS_KEY, "unseen")
  const [screens, setScreens] = usePersist<string[]>(LEAD_SCREENS_KEY, [])
  const [dismissedAt, setDismissedAt] = usePersist<number | null>(LEAD_DISMISSED_AT_KEY, null)

  // Manual override so `open()` can re-surface the popup after a dismissal.
  const [forcedOpen, setForcedOpen] = useState(false)

  // Record each newly-visited screen – only while enabled. Repeated visits
  // return the same array reference, so usePersist doesn't re-write.
  useEffect(() => {
    if (!enabled || !screen) return
    setScreens((prev) => (prev.includes(screen) ? prev : [...prev, screen]))
  }, [enabled, screen, setScreens])

  // Optional re-arm after a dismissal cooldown. `accepted` is final.
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

  // Any user exit dismisses – but never downgrades a final `accepted`.
  const close = useCallback(() => {
    setForcedOpen(false)
    setStatus((prev) => (prev === "accepted" ? prev : "dismissed"))
    setDismissedAt(Date.now())
  }, [setStatus, setDismissedAt])

  const markAccepted = useCallback(() => {
    setForcedOpen(false)
    setStatus("accepted")
  }, [setStatus])

  return { isOpen, open, close, markAccepted }
}

export default useLeadTrigger
