/**
 * «Опыт студентов» – what students and graduates say about a university,
 * retold in Russian without names. The second layer of the storefront next to
 * the facts: opinions, never conditions.
 *
 * The only data source is `app/public/data/experience.json`, keyed by
 * `University.id`. Every item there was approved by a person before it was
 * written to the file. A missing or broken file means «no experience yet» –
 * the storefront never shows made-up or demo opinions.
 *
 * Rules enforced on load, so no screen can break them by accident:
 *  - an item without a topic, text, date, approval date or a known layer is dropped;
 *  - a retold post (`manual`) or an automatic one (`auto`) must link to it over https –
 *    only a graduate's answer (`alumni`) may come without a public link.
 */

export type ExperienceTopic =
  | "admission"
  | "scholarship"
  | "dormitory"
  | "study"
  | "office"
  | "money"
  | "city"
  | "advice"

/**
 * Where the item came from. `alumni` – a graduate of the partner agency
 * answered the questionnaire; `manual` – a person read a post and pasted it in;
 * `auto` – collected by the pipeline from an official API (YouTube).
 */
export type ExperienceLayer = "alumni" | "manual" | "auto"

export type ExperiencePlatform =
  | "alumni"
  | "youtube"
  | "bilibili"
  | "xiaohongshu"
  | "zhihu"
  | "tieba"
  | "telegram"
  | "other"

export interface ExperienceItem {
  topic: ExperienceTopic
  /** Russian retelling: no names, no nicknames, no verbatim quotes. */
  text: string
  layer: ExperienceLayer
  platform: ExperiencePlatform
  /** The post or video; null only for a graduate's answer. */
  source_url: string | null
  /** When the author wrote it: `YYYY-MM` or `YYYY-MM-DD`. */
  written_at: string
  /** Who it is, without a name: «бакалавриат, набор 2024». */
  author: string | null
  /** When a person approved the item for publication. */
  reviewed_at: string
}

export interface ExperienceData {
  generated_at: string
  universities: Record<string, ExperienceItem[]>
}

/** Topics in reading order, with their Russian headings. */
export const EXPERIENCE_TOPICS: readonly { id: ExperienceTopic; label_ru: string }[] = [
  { id: "admission", label_ru: "Поступление" },
  { id: "scholarship", label_ru: "Стипендия" },
  { id: "dormitory", label_ru: "Общежитие" },
  { id: "study", label_ru: "Учёба и язык преподавания" },
  { id: "office", label_ru: "Офис для иностранцев" },
  { id: "money", label_ru: "Расходы" },
  { id: "city", label_ru: "Город и кампус" },
  { id: "advice", label_ru: "Советы поступающим" },
]

export const PLATFORM_RU: Record<ExperiencePlatform, string> = {
  alumni: "анкета выпускника",
  youtube: "YouTube",
  bilibili: "Bilibili",
  xiaohongshu: "Xiaohongshu",
  zhihu: "Zhihu",
  tieba: "Tieba",
  telegram: "Telegram",
  other: "источник",
}

/** How the layer is named next to an item. */
export function layerLabel(item: ExperienceItem): string {
  if (item.layer === "alumni") return "выпускник партнёрского агентства"
  if (item.layer === "auto") return `${PLATFORM_RU[item.platform]}, собрано автоматически`
  return `пересказ поста, ${PLATFORM_RU[item.platform]}`
}

/* ---------- loading ---------- */

export const EXPERIENCE_FILE = "data/experience.json"

export function experienceUrl(): string {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? "./"
  return base.endsWith("/") ? base + EXPERIENCE_FILE : base + "/" + EXPERIENCE_FILE
}

const EMPTY: ExperienceData = { generated_at: "", universities: {} }
let cache: Promise<ExperienceData> | null = null

/** Fetch once per page load. Any failure means «no experience yet». Never throws. */
export function loadExperience(): Promise<ExperienceData> {
  if (!cache) {
    cache = fetchExperience().catch((err: unknown) => {
      if (import.meta.env.DEV) console.warn("[experience] not available:", err)
      return EMPTY
    })
  }
  return cache
}

export function resetExperienceCache(): void {
  cache = null
}

async function fetchExperience(): Promise<ExperienceData> {
  const res = await fetch(experienceUrl(), { cache: "no-cache" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  if (type && !/json/i.test(type)) throw new Error(`not JSON: ${type}`)
  return normalizeExperience(await res.json())
}

/* ---------- validation ---------- */

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x)
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null)

const TOPICS: ReadonlySet<string> = new Set(EXPERIENCE_TOPICS.map((t) => t.id))
const LAYERS: ReadonlySet<string> = new Set(["alumni", "manual", "auto"])
const PLATFORMS: ReadonlySet<string> = new Set(Object.keys(PLATFORM_RU))
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}/

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

export function normalizeItem(raw: unknown): ExperienceItem | null {
  if (!isRec(raw)) return null
  const topic = str(raw.topic)
  const text = str(raw.text)
  const layer = str(raw.layer)
  const written = str(raw.written_at)
  const reviewed = str(raw.reviewed_at)
  if (!topic || !TOPICS.has(topic) || !text || !layer || !LAYERS.has(layer)) return null
  if (!written || !MONTH_RE.test(written) || !reviewed || !DAY_RE.test(reviewed)) return null
  const platform = str(raw.platform)
  const url = str(raw.source_url)
  const source_url = url && isHttps(url) ? url : null
  // a retold or collected post must say where it was read; only a graduate's answer has no public page
  if (layer !== "alumni" && !source_url) return null
  return {
    topic: topic as ExperienceTopic,
    text,
    layer: layer as ExperienceLayer,
    platform: layer === "alumni" ? "alumni" : platform && PLATFORMS.has(platform) ? (platform as ExperiencePlatform) : "other",
    source_url,
    written_at: written,
    author: str(raw.author),
    reviewed_at: reviewed,
  }
}

export function normalizeExperience(raw: unknown): ExperienceData {
  if (!isRec(raw) || !isRec(raw.universities)) throw new Error("not an experience file")
  const universities: Record<string, ExperienceItem[]> = {}
  for (const [id, list] of Object.entries(raw.universities)) {
    if (!Array.isArray(list)) continue
    const items = list.map(normalizeItem).filter((x): x is ExperienceItem => x !== null)
    if (items.length) universities[id] = items
  }
  return { generated_at: str(raw.generated_at) ?? "", universities }
}

/* ---------- reading ---------- */

export function experienceOf(data: ExperienceData, id: string): ExperienceItem[] {
  return Object.hasOwn(data.universities, id) ? data.universities[id] : []
}

/** Items grouped by topic in reading order; within a topic the newest first. Empty topics are left out. */
export function groupByTopic(items: ExperienceItem[]): { id: ExperienceTopic; label_ru: string; items: ExperienceItem[] }[] {
  return EXPERIENCE_TOPICS.map((t) => ({
    ...t,
    items: items.filter((i) => i.topic === t.id).sort((a, b) => b.written_at.localeCompare(a.written_at)),
  })).filter((g) => g.items.length > 0)
}

const RU_MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]

/** «написано в марте 2025» style date of the author's text: «март 2025». */
export function formatWrittenAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return iso
  const month = RU_MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${m[1]}` : iso
}
