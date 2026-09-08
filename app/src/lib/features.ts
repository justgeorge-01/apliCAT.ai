/**
 * Build-time feature flags for the «Китай» storefront.
 *
 *  - `ai`       – essay / resume / Uni-fit / assistant screens. Off in this
 *                 branch: the menu items are hidden and the pages are not mounted.
 *  - `market`   – which catalog the shell uses. `VITE_MARKET=europe` brings back
 *                 the legacy European data (`data/programs.js`); default is China.
 *  - `accounts` – the cabinet (SPEC-cabinet.md). On only when the build has
 *                 `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; without them the
 *                 storefront works exactly as before and makes no request at all.
 *  - `cabinetFake` – dev only: `VITE_CABINET_FAKE=1` swaps Supabase for an
 *                 in-memory backend (sign-in without an email, a demo organization)
 *                 so the cabinet can be exercised and screenshotted without keys.
 *                 Never true in a production build (`import.meta.env.DEV`).
 */
export type Market = "china" | "europe"

function resolveMarket(raw: unknown): Market {
  return raw === "europe" ? "europe" : "china"
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
const cabinetFake = Boolean(import.meta.env.DEV) && import.meta.env.VITE_CABINET_FAKE === "1"

export const FEATURES = {
  ai: false,
  market: resolveMarket(import.meta.env.VITE_MARKET ?? "china"),
  accounts: Boolean((SUPABASE_URL && SUPABASE_ANON_KEY) || cabinetFake),
  cabinetFake,
} as const

export type Features = typeof FEATURES

/** Supabase connection of this build (undefined when the cabinet is off). */
export const SUPABASE_ENV =
  SUPABASE_URL && SUPABASE_ANON_KEY ? ({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } as const) : undefined
