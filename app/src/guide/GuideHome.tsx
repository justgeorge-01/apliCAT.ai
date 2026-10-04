import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Input } from "@/components/ui/input"
import { factOf } from "@/data/china"
import type { Catalog, University } from "@/data/china.types"
import { guideOf, linkStats, type GuideData, type GuideUniversity } from "@/data/guide"
import { pluralRu } from "@/lib/catalogView"
import { cn } from "@/lib/utils"

import { universityHref } from "./route"

interface Entry {
  u: University
  g: GuideUniversity | null
}

/** «15 ссылок · 4 на русском · 5 видео», or the honest «ссылок пока нет». */
function statsLine(g: GuideUniversity | null): string {
  const s = linkStats(g?.links ?? [])
  if (!s.total) return "ссылок пока нет"
  const parts = [`${s.total} ${pluralRu(s.total, "ссылка", "ссылки", "ссылок")}`]
  if (s.ru) parts.push(`${s.ru} на русском`)
  if (s.video) parts.push(`${s.video} ${pluralRu(s.video, "видео", "видео", "видео")}`)
  return parts.join(" · ")
}

function GuideCard({ u, g }: Entry) {
  const language = factOf(u, "requirements.language_of_instruction")
  return (
    <a
      href={universityHref(u.id)}
      data-university={u.id}
      className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div className="min-w-0">
        <h2 className="text-[17px] leading-snug font-semibold text-fg group-hover:underline group-hover:underline-offset-4">
          {u.name_ru ?? u.name}
        </h2>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[13px] text-fg-muted">
          {g?.name_zh && (
            <span lang="zh-Hans" translate="no" className="font-cjk">
              {g.name_zh}
            </span>
          )}
          {u.city && <span>{u.city}</span>}
        </div>
      </div>
      <p className="line-clamp-3 text-sm leading-relaxed text-fg-muted">
        {g?.description?.text_ru ?? "Описание готовится."}
      </p>
      <div className="mt-auto grid gap-1 border-t border-border pt-3 text-xs text-fg-muted">
        <span className={cn((g?.links.length ?? 0) > 0 && "font-semibold text-fg")}>{statsLine(g)}</span>
        {language && <span>Язык обучения: {language.display}</span>}
      </div>
    </a>
  )
}

/**
 * The catalog of the guide: what the site is in one paragraph, a search, the
 * cities, and a card per university – description, how many links there are and
 * how many of them are in Russian. The card is one link to the university page.
 */
export function GuideHome({ catalog, guide }: { catalog: Catalog | null; guide: GuideData | null }) {
  const [query, setQuery] = useState("")
  const [city, setCity] = useState<string | null>(null)

  const entries: Entry[] = useMemo(() => {
    if (!catalog) return []
    const list = catalog.universities.map((u) => ({ u, g: guide ? guideOf(guide, u.id) : null }))
    // most material first: a reader starts where there is something to read
    return list.sort(
      (a, b) =>
        (b.g?.links.length ?? 0) - (a.g?.links.length ?? 0) ||
        (a.u.name_ru ?? a.u.name).localeCompare(b.u.name_ru ?? b.u.name, "ru"),
    )
  }, [catalog, guide])

  const cities = useMemo(
    () => [...new Set(entries.map((e) => e.u.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [entries],
  )

  const q = query.trim().toLowerCase()
  const shown = entries.filter(
    (e) =>
      (!city || e.u.city === city) &&
      (!q ||
        [e.u.name, e.u.name_ru ?? "", e.u.city, e.g?.name_zh ?? ""].some((s) => s.toLowerCase().includes(q))),
  )

  const totalLinks = entries.reduce((n, e) => n + (e.g?.links.length ?? 0), 0)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex max-w-3xl flex-col gap-4">
        <HanziKicker hanzi="大学">Вузы Китая</HanziKicker>
        <h1 className="text-4xl font-semibold tracking-[-0.035em] text-balance text-fg sm:text-5xl">
          Как учатся в вузах Китая
        </h1>
        <p className="text-base leading-relaxed text-fg-muted sm:text-lg">
          {entries.length || 20} университетов. У каждого короткое описание, официальные условия со ссылкой на источник
          и подборка рассказов, видео и постов студентов. Заголовки переведены на русский, пересказ в одно предложение
          написан нами.
        </p>
        {totalLinks > 0 && (
          <p className="text-sm text-fg-muted">
            Сейчас в подборке <span className="font-semibold text-fg">{totalLinks}</span>{" "}
            {pluralRu(totalLinks, "ссылка", "ссылки", "ссылок")}.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
          <Input
            id="guide-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название или город: Цинхуа, 复旦, Шанхай"
            aria-label="Поиск вуза"
            className="h-10 pl-9"
          />
        </div>
        {cities.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Город">
            {[null, ...cities].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                aria-pressed={city === c}
                onClick={() => setCity(c)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  city === c
                    ? "border-accent bg-accent font-semibold text-accent-fg"
                    : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {c ?? "Все города"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!catalog ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Загрузка каталога">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-lg border border-border bg-card-2" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-fg-muted">Ничего не нашлось. Попробуйте другое название или город.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <GuideCard key={e.u.id} {...e} />
          ))}
        </div>
      )}
    </div>
  )
}
