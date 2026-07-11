/**
 * Waitlist popup – shared configuration.
 *
 * This is the single place to tune the trigger logic and the modal's look.
 * Presentation values here are the DEFAULTS; <WaitlistPopup> also accepts
 * matching props so a given mount can override them.
 */

/* ---------------------------------------------------------------- trigger */

/**
 * How many UNIQUE screens (tabs) the user must visit AFTER onboarding before
 * the waitlist popup appears for the first time. Reasonable range: 4–5.
 */
export const SCREENS_AFTER_ONBOARDING_THRESHOLD = 4

/** One-time gate status, persisted across sessions. */
export type WaitlistStatus = "unseen" | "dismissed" | "submitted"

/**
 * localStorage sub-keys. The project's persist helpers (`usePersist` /
 * `readPersist` in `@/lib/persist`) prepend the `admitica.` prefix, so the
 * actual on-disk keys are e.g. `admitica.waitlist.status`.
 */
export const WAITLIST_STATUS_KEY = "waitlist.status" //          -> admitica.waitlist.status
export const WAITLIST_SCREENS_KEY = "waitlist.screens" //        -> admitica.waitlist.screens
export const WAITLIST_DISMISSED_AT_KEY = "waitlist.dismissedAt" // -> admitica.waitlist.dismissedAt

/**
 * Onboarding-complete flag — REUSED, not invented. `Onboarding.tsx` writes
 * `admitica.onboarded = "true"` (raw string "true", which is also valid JSON)
 * on finish, and `App.tsx` gates the whole UI on the equivalent non-empty
 * `admitica.name` (`if (!name) return <Onboarding/>`). App passes the live
 * `enabled = Boolean(name)` into the hook, so the popup can never run or count
 * screens during onboarding. This key is exported for reference / standalone
 * use of the hook (read via `readPersist<boolean>("onboarded", false)`).
 */
export const ONBOARDED_KEY = "onboarded" // -> admitica.onboarded === "true" once finished

/**
 * Re-show after a dismissal? `0` = never re-show (default: strictly one-time).
 * Set e.g. `30` to re-prompt 30 days after the user dismissed it.
 * A `submitted` status is always final and ignores the cooldown.
 */
export const DISMISS_COOLDOWN_DAYS = 0

/* ----------------------------------------------------------- presentation */
/* All overridable per-mount via <WaitlistPopup> props. */

/** Backdrop blur strength, in px. */
export const BLUR_PX = 8

/** Translucent dark tint over the blur so the white card + button stay legible. */
export const OVERLAY_TINT = "rgba(0, 0, 0, 0.35)"

/** Card width cap (desktop). Below `md` the card is `calc(100% - 32px)` up to this. */
export const CARD_MAX_WIDTH_PX = 440

/** Card height cap; content scrolls inside the card past this. */
export const CARD_MAX_HEIGHT_VH = 85

/**
 * Show a small X in the card corner. Default OFF so the single, obvious exit is
 * the white «Пропустить» button under the card.
 */
export const SHOW_CLOSE_ICON = false

/** Clicking the blurred backdrop closes the modal. Off → only the buttons
 *  («Не сейчас» / CTA) dismiss it; Esc is also disabled in WaitlistPopup. */
export const CLOSE_ON_OUTSIDE_CLICK = false
