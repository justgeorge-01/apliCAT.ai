/**
 * Partner (consultant) configuration – everything brand-dependent lives here,
 * never in components: header name/logo, lead buttons, the expert page and the
 * lead popup copy all read from the resolved `Partner`.
 *
 * Resolution order: `?partner=<slug>` in the URL → `VITE_PARTNER` at build time
 * → `abitura` (the public build). An unknown slug falls back to the default, so
 * a partner's brand is never shown by accident.
 */
import { DEFAULT_PARTNER_SLUG, PARTNERS } from "./partners"

export interface PartnerLead {
  /** Button text, e.g. «Обсудить с наставником». */
  label: string
  /** External link (Telegram etc.). The only outbound link besides university pages. */
  url: string
}

export interface PartnerExpertPage {
  title: string
  /** Short paragraphs; plain text, rendered as-is. */
  paragraphs: string[]
}

export interface Partner {
  slug: string
  name: string
  tagline?: string
  /** Path or data URL of a logo; when absent the header shows `name` as text. */
  logo?: string
  /** Absent for the default brand – then no lead buttons and no popup are mounted. */
  lead?: PartnerLead
  expertPage?: PartnerExpertPage
  /** University ids this partner works with (optional highlight in the catalog). */
  universities?: string[]
}

export const PARTNER_QUERY_PARAM = "partner"

/** Slug-safe: lowercase latin, digits, dash, underscore. */
const SLUG_RE = /^[a-z0-9_-]{1,40}$/

function cleanSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim().toLowerCase()
  return SLUG_RE.test(s) && s in PARTNERS ? s : null
}

/**
 * Pure resolver – `search` is `location.search` (or any query string),
 * `envSlug` is `import.meta.env.VITE_PARTNER`. Unknown slugs → default.
 */
export function resolvePartnerSlug(
  search: string | null | undefined,
  envSlug: string | null | undefined,
): string {
  if (search) {
    try {
      const fromQuery = cleanSlug(new URLSearchParams(search).get(PARTNER_QUERY_PARAM))
      if (fromQuery) return fromQuery
    } catch {
      /* malformed query – ignore */
    }
  }
  return cleanSlug(envSlug) ?? DEFAULT_PARTNER_SLUG
}

export function partnerBySlug(slug: string): Partner {
  return PARTNERS[slug] ?? PARTNERS[DEFAULT_PARTNER_SLUG]
}

let resolved: Partner | null = null

/** The partner for this page load (memoized). Safe without `window` (tests). */
export function getPartner(): Partner {
  if (resolved) return resolved
  const search = typeof location !== "undefined" ? location.search : ""
  const env = import.meta.env.VITE_PARTNER as string | undefined
  resolved = partnerBySlug(resolvePartnerSlug(search, env))
  return resolved
}

/** Drop the memoized partner – tests only. */
export function resetPartnerCache(): void {
  resolved = null
}

/** Type guard: partner has a lead link, so lead buttons / popup may render. */
export function hasLead(p: Partner): p is Partner & { lead: PartnerLead } {
  return Boolean(p.lead && p.lead.url && p.lead.label)
}
