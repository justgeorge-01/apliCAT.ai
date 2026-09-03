/**
 * Lead popup («<партнёр> разбирает такие кейсы») – shared configuration.
 *
 * Successor of the waitlist popup (spec §3.7): same trigger logic (unique
 * screens after onboarding, strictly one-time), NEW storage keys under
 * `admitica.cn.lead.*`. The old `admitica.waitlist.*` keys are left untouched.
 *
 * Presentation values here are the DEFAULTS; <LeadPopup> also accepts matching
 * props so a given mount can override them.
 */

/* ---------------------------------------------------------------- trigger */

/**
 * How many UNIQUE screens (tabs / the detail overlay) the user must visit AFTER
 * onboarding before the popup appears for the first time.
 */
export const SCREENS_AFTER_ONBOARDING_THRESHOLD = 4

/** One-time gate status, persisted across sessions. */
export type LeadStatus = "unseen" | "dismissed" | "accepted"

/**
 * localStorage sub-keys. `usePersist` / `readPersist` (`@/lib/persist`) prepend
 * the `admitica.` prefix, so the on-disk keys are `admitica.cn.lead.*`.
 */
export const LEAD_STATUS_KEY = "cn.lead.status" //           -> admitica.cn.lead.status
export const LEAD_SCREENS_KEY = "cn.lead.screens" //         -> admitica.cn.lead.screens
export const LEAD_DISMISSED_AT_KEY = "cn.lead.dismissedAt" // -> admitica.cn.lead.dismissedAt

/**
 * Re-show after a dismissal? `0` = never re-show (default: strictly one-time).
 * Set e.g. `30` to re-prompt 30 days after the user dismissed it.
 * An `accepted` status is always final and ignores the cooldown.
 */
export const DISMISS_COOLDOWN_DAYS = 0

/* ----------------------------------------------------------- presentation */
/* All overridable per-mount via <LeadPopup> props. */

/** Backdrop blur strength, in px. */
export const BLUR_PX = 8

/**
 * Translucent ink tint over the blur so the card + button stay legible – the
 * same `--color-ink` scrim as the app dialog (`bg-ink/60`), a shade lighter.
 */
export const OVERLAY_TINT = "color-mix(in srgb, var(--color-ink) 50%, transparent)"

/** Card width cap (desktop). Below `md` the card is `calc(100% - 32px)` up to this. */
export const CARD_MAX_WIDTH_PX = 440

/** Card height cap; content scrolls inside the card past this. */
export const CARD_MAX_HEIGHT_VH = 85

/**
 * Show a small X in the card corner. Default OFF so the single, obvious exit is
 * the «Не сейчас» button under the card.
 */
export const SHOW_CLOSE_ICON = false

/** Clicking the blurred backdrop closes the modal. Off → only the buttons dismiss it. */
export const CLOSE_ON_OUTSIDE_CLICK = false
