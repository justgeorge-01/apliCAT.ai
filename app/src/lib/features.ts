/**
 * Build-time feature flags for the «Китай» storefront.
 *
 *  - `ai`     – essay / resume / Uni-fit / assistant screens. Off in this
 *               branch: the menu items are hidden and the pages are not mounted.
 *  - `market` – which catalog the shell uses. `VITE_MARKET=europe` brings back
 *               the legacy European data (`data/programs.js`); default is China.
 */
export type Market = "china" | "europe"

function resolveMarket(raw: unknown): Market {
  return raw === "europe" ? "europe" : "china"
}

export const FEATURES = {
  ai: false,
  market: resolveMarket(import.meta.env.VITE_MARKET ?? "china"),
} as const

export type Features = typeof FEATURES
