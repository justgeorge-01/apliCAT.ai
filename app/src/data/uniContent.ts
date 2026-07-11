/**
 * Rich, per-university editorial content for the Detail page.
 * Keyed by university id (data/programs.js). Only universities present here
 * render the extended profile; others fall back to the generic Detail layout.
 *
 * Bocconi uses the full analyst report (`loadBlocks`, code-split into
 * bocconi.ts so its ~70kB only loads when that detail page opens).
 * The lighter `sections` shape stays available so other unis can be filled
 * quickly later. Tone: neutral / encyclopedic; RU = note for applicants from Russia.
 */

/* ---- rich report model (full content, faithfully transcribed) ---- */
export type ContentNode =
  | { type: "sub"; text: string }
  | { type: "p"; text: string; ru?: boolean }
  | { type: "ul"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }

export interface RichBlock {
  /** Block heading (accordion). */
  title: string
  /** Verified source URLs, rendered as «Источник» links in the block footer. */
  sources: string[]
  nodes: ContentNode[]
}

/* ---- lighter editorial section (optional alternative to blocks) ---- */
export interface UniSection {
  title: string
  body?: string
  facts?: string[]
  ru?: string
  pros?: string[]
  cons?: string[]
  note?: string
  accent?: boolean
}

export interface UniContent {
  /** Quick-fact chips under the header. */
  chips: string[]
  /** Lazily-loaded full report blocks (code-split). */
  loadBlocks?: () => Promise<RichBlock[]>
  /** Lighter editorial sections (fallback for unis without a full report). */
  sections?: UniSection[]
  faq?: { q: string; a: string }[]
}

export const UNI_CONTENT: Record<string, UniContent> = {
  // ── Università Bocconi – full analyst profile ──────────────────────
  u1: {
    chips: [
      "Основан в 1902",
      "Частный · Милан",
      "QS #12 в мире (соц. науки)",
      "BSc €16 700/год",
      "Трудоустройство 97%",
      "~13 700 студентов из 120+ стран",
    ],
    loadBlocks: () => import("./bocconi").then((m) => m.BOCCONI_BLOCKS),
  },
}
