/**
 * The public guide (`app/public/data/guide.json`): for every university a short
 * description with its sources and as many links as possible about what life
 * and study there are like for foreign – ideally Russian-speaking – students.
 * Every link carries its title translated into Russian and a one-sentence
 * retelling in our own words; the page links out and never republishes the post.
 *
 * Rules enforced on load, so no screen can break them by accident:
 *  - a link must be https, have a Russian title and a known topic and language;
 *  - the same address is kept once per university;
 *  - a description without at least one https source is dropped – an
 *    unsourced paragraph about a university does not go on the page.
 * A missing or broken file means «no links yet»: the guide never shows made-up
 * or demo links.
 */

export type LinkTopic = "russians" | "life" | "dorm" | "campus" | "study" | "city" | "admission"
export type LinkLang = "zh" | "ru" | "en"
export type LinkPlatform =
  | "official"
  | "bilibili"
  | "youtube"
  | "xiaohongshu"
  | "zhihu"
  | "wechat"
  | "tieba"
  | "telegram"
  | "media"
  | "blog"
  | "other"

export interface GuideLink {
  url: string
  /** The title as published, in its own language. */
  title_orig: string | null
  /** The title in Russian (a translation unless the link is Russian already). */
  title_ru: string
  /** One sentence in Russian, in our own words. */
  summary_ru: string | null
  lang: LinkLang
  platform: LinkPlatform
  topic: LinkTopic
  /** `YYYY-MM` when the date is known. */
  published: string | null
}

export interface GuideDescription {
  text_ru: string
  sources: string[]
}

export interface GuideUniversity {
  name_zh: string | null
  description: GuideDescription | null
  links: GuideLink[]
  /** Telegram post whose comments are this university's discussion, «channel/123». */
  discussion: string | null
}

export interface GuideData {
  generated_at: string
  /** Public Telegram channel of the guide, without «@»; null until it exists. */
  telegram_channel: string | null
  universities: Record<string, GuideUniversity>
}

/** Topics in reading order: first what is specifically about Russian-speaking students. */
export const LINK_TOPICS: readonly { id: LinkTopic; label_ru: string }[] = [
  { id: "russians", label_ru: "Русскоязычные студенты" },
  { id: "life", label_ru: "Жизнь иностранных студентов" },
  { id: "dorm", label_ru: "Общежития" },
  { id: "campus", label_ru: "Кампус" },
  { id: "study", label_ru: "Учёба" },
  { id: "city", label_ru: "Город" },
  { id: "admission", label_ru: "Как поступали" },
]

export const PLATFORM_RU: Record<LinkPlatform, string> = {
  official: "сайт вуза",
  bilibili: "Bilibili",
  youtube: "YouTube",
  xiaohongshu: "Xiaohongshu",
  zhihu: "Zhihu",
  wechat: "WeChat",
  tieba: "Tieba",
  telegram: "Telegram",
  media: "СМИ",
  blog: "блог",
  other: "сайт",
}

/** How the language of the original reads next to a link. */
export const LANG_RU: Record<LinkLang, string> = {
  ru: "на русском",
  zh: "перевод с китайского",
  en: "перевод с английского",
}

const VIDEO_PLATFORMS: ReadonlySet<LinkPlatform> = new Set(["bilibili", "youtube"])

/* ---------- loading ---------- */

export const GUIDE_FILE = "data/guide.json"

export function guideUrl(): string {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? "./"
  return base.endsWith("/") ? base + GUIDE_FILE : base + "/" + GUIDE_FILE
}

const EMPTY: GuideData = { generated_at: "", telegram_channel: null, universities: {} }
let cache: Promise<GuideData> | null = null

/** Fetch once per page load. Any failure means «no links yet». Never throws. */
export function loadGuide(): Promise<GuideData> {
  if (!cache) {
    cache = fetchGuide().catch((err: unknown) => {
      if (import.meta.env.DEV) console.warn("[guide] not available:", err)
      return EMPTY
    })
  }
  return cache
}

export function resetGuideCache(): void {
  cache = null
}

async function fetchGuide(): Promise<GuideData> {
  const res = await fetch(guideUrl(), { cache: "no-cache" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  if (type && !/json/i.test(type)) throw new Error(`not JSON: ${type}`)
  return normalizeGuide(await res.json())
}

/* ---------- validation ---------- */

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x)
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null)

const TOPICS: ReadonlySet<string> = new Set(LINK_TOPICS.map((t) => t.id))
const LANGS: ReadonlySet<string> = new Set(Object.keys(LANG_RU))
const PLATFORMS: ReadonlySet<string> = new Set(Object.keys(PLATFORM_RU))
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])/
const HANDLE_RE = /^[A-Za-z0-9_]{5,32}$/
const POST_RE = /^[A-Za-z0-9_]{5,32}\/\d{1,9}$/

export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

export function normalizeLink(raw: unknown): GuideLink | null {
  if (!isRec(raw)) return null
  const url = str(raw.url)
  const title_ru = str(raw.title_ru)
  const topic = str(raw.topic)
  const lang = str(raw.lang)
  if (!url || !isHttps(url) || !title_ru || !topic || !TOPICS.has(topic) || !lang || !LANGS.has(lang)) return null
  const platform = str(raw.platform)
  const published = str(raw.published)
  const m = published ? MONTH_RE.exec(published) : null
  return {
    url,
    title_orig: str(raw.title_orig),
    title_ru,
    summary_ru: str(raw.summary_ru),
    lang: lang as LinkLang,
    platform: platform && PLATFORMS.has(platform) ? (platform as LinkPlatform) : "other",
    topic: topic as LinkTopic,
    published: m ? `${m[1]}-${m[2]}` : null,
  }
}

function normalizeDescription(raw: unknown): GuideDescription | null {
  if (!isRec(raw)) return null
  const text_ru = str(raw.text_ru)
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map(str).filter((s): s is string => s !== null && isHttps(s))
    : []
  return text_ru && sources.length ? { text_ru, sources } : null
}

function normalizeUniversity(raw: unknown): GuideUniversity | null {
  if (!isRec(raw)) return null
  const seen = new Set<string>()
  const links: GuideLink[] = []
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    const link = normalizeLink(l)
    if (!link || seen.has(link.url)) continue
    seen.add(link.url)
    links.push(link)
  }
  const discussion = str(raw.discussion)
  return {
    name_zh: str(raw.name_zh),
    description: normalizeDescription(raw.description),
    links,
    discussion: discussion && POST_RE.test(discussion) ? discussion : null,
  }
}

export function normalizeGuide(raw: unknown): GuideData {
  if (!isRec(raw) || !isRec(raw.universities)) throw new Error("not a guide file")
  const universities: Record<string, GuideUniversity> = {}
  for (const [id, u] of Object.entries(raw.universities)) {
    const norm = normalizeUniversity(u)
    if (norm) universities[id] = norm
  }
  const channel = str(raw.telegram_channel)?.replace(/^@/, "") ?? null
  return {
    generated_at: str(raw.generated_at) ?? "",
    telegram_channel: channel && HANDLE_RE.test(channel) ? channel : null,
    universities,
  }
}

/* ---------- reading ---------- */

export function guideOf(data: GuideData, id: string): GuideUniversity | null {
  return Object.hasOwn(data.universities, id) ? data.universities[id] : null
}

export type LangFilter = "all" | LinkLang

/** Links grouped by topic in reading order; Russian first inside a topic, then the newest. Empty topics are left out. */
export function groupLinks(
  links: GuideLink[],
  filter: LangFilter = "all",
): { id: LinkTopic; label_ru: string; links: GuideLink[] }[] {
  const shown = filter === "all" ? links : links.filter((l) => l.lang === filter)
  const rank = (l: GuideLink) => (l.lang === "ru" ? 0 : 1)
  return LINK_TOPICS.map((t) => ({
    ...t,
    links: shown
      .filter((l) => l.topic === t.id)
      .sort((a, b) => rank(a) - rank(b) || (b.published ?? "").localeCompare(a.published ?? "")),
  })).filter((g) => g.links.length > 0)
}

export interface LinkStats {
  total: number
  ru: number
  zh: number
  en: number
  video: number
}

export function linkStats(links: GuideLink[]): LinkStats {
  return {
    total: links.length,
    ru: links.filter((l) => l.lang === "ru").length,
    zh: links.filter((l) => l.lang === "zh").length,
    en: links.filter((l) => l.lang === "en").length,
    video: links.filter((l) => VIDEO_PLATFORMS.has(l.platform)).length,
  }
}

const RU_MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]

/** `2025-03` → «март 2025». */
export function formatMonth(ym: string): string {
  const m = MONTH_RE.exec(ym)
  if (!m) return ym
  return `${RU_MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

/** Host of a source for a short «по материалам: tsinghua.edu.cn» line. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
