import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, ChevronLeft } from "lucide-react"

import { CriticalMark, FactRow } from "@/components/FactRow"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Segmented } from "@/components/ui/segmented"
import { cscaStatus, factsOf, findUniversity, lastChecked } from "@/data/china"
import type { Catalog, FactKey, University } from "@/data/china.types"
import {
  LANG_RU,
  PLATFORM_RU,
  formatMonth,
  groupLinks,
  guideOf,
  linkStats,
  sourceHost,
  type GuideData,
  type GuideLink,
  type GuideUniversity,
  type LangFilter,
} from "@/data/guide"
import { CSCA_BADGE, CSCA_LABEL } from "@/lib/catalogView"

/** The few official rows the guide keeps: what decides «can I go there at all». */
const FACT_ROWS: readonly { label: string; keys: readonly FactKey[]; critical?: boolean }[] = [
  {
    label: "Язык обучения",
    keys: ["requirements.language_of_instruction", "requirements.hsk_min", "requirements.ielts_min"],
    critical: true,
  },
  { label: "Обучение в год", keys: ["fees.tuition_year_non_eu"] },
  { label: "Общежитие в месяц", keys: ["fees.dormitory_month"] },
  { label: "Дедлайн подачи", keys: ["deadline.fall.application_non_eu"], critical: true },
]

const external = { target: "_blank", rel: "noopener noreferrer" } as const

function LinkItem({ link }: { link: GuideLink }) {
  return (
    <li className="grid gap-1 border-b border-border py-3.5 last:border-b-0">
      <a
        href={link.url}
        {...external}
        className="group inline-flex items-start gap-1 text-[15px] leading-snug font-semibold text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className="underline decoration-border-strong underline-offset-4 group-hover:decoration-current">
          {link.title_ru}
        </span>
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
      </a>
      {link.summary_ru && <p className="text-sm leading-relaxed text-fg-muted">{link.summary_ru}</p>}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg-faint">
        <span>{PLATFORM_RU[link.platform]}</span>
        <span aria-hidden="true">·</span>
        <span>{LANG_RU[link.lang]}</span>
        {link.published && (
          <>
            <span aria-hidden="true">·</span>
            <span>{formatMonth(link.published)}</span>
          </>
        )}
      </div>
      {link.lang !== "ru" && link.title_orig && (
        <div lang={link.lang === "zh" ? "zh-Hans" : "en"} className="text-xs text-fg-faint break-words">
          {link.title_orig}
        </div>
      )}
    </li>
  )
}

function LinksBlock({ g }: { g: GuideUniversity | null }) {
  const [filter, setFilter] = useState<LangFilter>("all")
  const links = g?.links ?? []
  const s = linkStats(links)
  const options = [
    { id: "all" as const, label: `Все · ${s.total}` },
    ...(s.ru ? [{ id: "ru" as const, label: `На русском · ${s.ru}` }] : []),
    ...(s.zh ? [{ id: "zh" as const, label: `С китайского · ${s.zh}` }] : []),
    ...(s.en ? [{ id: "en" as const, label: `С английского · ${s.en}` }] : []),
  ]
  const groups = groupLinks(links, filter)

  return (
    <section aria-labelledby="links-h" className="flex flex-col gap-4">
      <HanziKicker as="h2" id="links-h" hanzi="链接">
        Что почитать и посмотреть
      </HanziKicker>
      <p className="max-w-prose text-sm text-fg-muted">
        Рассказы, видео и посты студентов. Заголовки переведены на русский, пересказ в одно предложение написан нами. Ссылки
        ведут на сайты авторов, Xiaohongshu и Zhihu могут попросить войти.
      </p>
      {links.length === 0 ? (
        <p className="border-t border-border pt-4 text-sm text-fg-muted">Подборка по этому вузу ещё собирается.</p>
      ) : (
        <>
          {options.length > 2 && <Segmented value={filter} onChange={setFilter} options={options} />}
          <div className="grid gap-6">
            {groups.map((grp) => (
              <section key={grp.id} aria-labelledby={`t-${grp.id}`}>
                <h3 id={`t-${grp.id}`} className="border-b border-border-strong pb-2 text-[13px] font-semibold text-fg-muted">
                  {grp.label_ru}
                </h3>
                <ul>
                  {grp.links.map((l) => (
                    <LinkItem key={l.url} link={l} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Telegram's own comments widget under a post of the guide's channel: people
 * write with their Telegram account and Telegram keeps the messages, so the
 * site stores nothing. The script comes from telegram.org; if it does not load
 * (t.me is slow in some networks), the plain link below still works.
 */
function TelegramDiscussion({ post, dark }: { post: string; dark: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.replaceChildren()
    const s = document.createElement("script")
    s.async = true
    s.src = "https://telegram.org/js/telegram-widget.js?22"
    s.dataset.telegramDiscussion = post
    s.dataset.commentsLimit = "10"
    s.dataset.colorful = "0"
    if (dark) s.dataset.dark = "1"
    el.appendChild(s)
    return () => el.replaceChildren()
  }, [post, dark])
  return <div ref={box} className="min-h-24" />
}

function DiscussionBlock({ g, channel }: { g: GuideUniversity | null; channel: string | null }) {
  const [dark] = useState(() => document.documentElement.dataset.theme === "dark")
  if (!g?.discussion && !channel) return null
  const url = g?.discussion ? `https://t.me/${g.discussion}` : `https://t.me/${channel}`
  return (
    <section aria-labelledby="talk-h" className="flex flex-col gap-4">
      <HanziKicker as="h2" id="talk-h" hanzi="讨论">
        Обсуждение
      </HanziKicker>
      <p className="max-w-prose text-sm text-fg-muted">
        Вопросы тем, кто там учится или поступал. Пишут через Telegram, сообщения хранит Telegram, сайт их не сохраняет.
      </p>
      {g?.discussion && <TelegramDiscussion post={g.discussion} dark={dark} />}
      <a href={url} {...external} className="w-fit text-sm font-semibold text-fg underline underline-offset-4">
        Открыть обсуждение в Telegram
      </a>
    </section>
  )
}

function FactsBlock({ u }: { u: University }) {
  const csca = cscaStatus(u)
  const checked = lastChecked(u)
  return (
    <section aria-labelledby="facts-h">
      <Card className="gap-0 p-5 sm:p-6">
        <HanziKicker as="h2" id="facts-h" hanzi="事实">
          Официальные условия
        </HanziKicker>
        <p className="mt-2 max-w-prose text-sm text-fg-muted">
          Только то, что вуз опубликовал сам. Значок рядом со значением раскрывает цитату и ссылку на страницу вуза.
        </p>
        <div className="mt-4">
          <Badge variant={CSCA_BADGE[csca].variant} className={CSCA_BADGE[csca].className}>
            {CSCA_LABEL[csca]}
          </Badge>
        </div>
        <dl className="mt-4 border-t border-border">
          {FACT_ROWS.map((row) => (
            <FactRow
              key={row.label}
              label={row.label}
              facts={row.keys.flatMap((k) => factsOf(u, k))}
              lastCheckedAt={checked}
              critical={row.critical}
              sublabels={row.keys.length > 1}
            />
          ))}
        </dl>
        <p className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-fg-muted">
          <CriticalMark decorative className="mt-px" />
          <span>Дедлайны и требования к языку сверяйте на сайте вуза перед подачей.</span>
        </p>
      </Card>
    </section>
  )
}

/**
 * One university: who it is in two sentences (with sources), what students
 * write and film about it, where to ask, and the handful of official
 * conditions that decide whether it is an option at all.
 */
export function GuideUniversityPage({ id, catalog, guide }: { id: string; catalog: Catalog | null; guide: GuideData | null }) {
  const u = catalog ? findUniversity(catalog, id) : undefined
  if (!catalog) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-card-2" aria-busy="true" aria-label="Загрузка" />
  }
  if (!u) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold">Такого вуза в каталоге нет</h1>
        <a href="#/" className="text-sm font-semibold underline underline-offset-4">
          Ко всем вузам
        </a>
      </div>
    )
  }
  const g = guide ? guideOf(guide, u.id) : null
  const description = g?.description

  return (
    <article className="flex flex-col gap-12">
      <div className="flex flex-col gap-5">
        <a href="#/" className="-ml-1 inline-flex w-fit items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ChevronLeft className="size-4" aria-hidden="true" /> Все вузы
        </a>
        <HanziKicker hanzi="大学">Университет</HanziKicker>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-balance text-fg sm:text-4xl">{u.name_ru ?? u.name}</h1>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-fg-muted sm:text-base">
            <span>{u.name}</span>
            {g?.name_zh && (
              <>
                <span aria-hidden="true">·</span>
                <span lang="zh-Hans" translate="no" className="font-cjk">
                  {g.name_zh}
                </span>
              </>
            )}
            {u.city && (
              <>
                <span aria-hidden="true">·</span>
                <span>{u.city}</span>
              </>
            )}
          </div>
        </div>
        {description ? (
          <div className="flex max-w-prose flex-col gap-2">
            <p className="text-base leading-relaxed text-fg">{description.text_ru}</p>
            <p className="text-xs text-fg-faint">
              По материалам:{" "}
              {description.sources.map((src, i) => (
                <span key={src}>
                  {i > 0 && ", "}
                  <a href={src} {...external} className="underline underline-offset-2 hover:text-fg">
                    {sourceHost(src)}
                  </a>
                </span>
              ))}
            </p>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Описание готовится.</p>
        )}
        {u.website && (
          <a
            href={u.website}
            {...external}
            className="inline-flex w-fit items-center gap-1 rounded-lg border border-fg/25 px-3 py-1.5 text-sm font-medium text-fg hover:border-fg/60"
          >
            Сайт вуза <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <LinksBlock g={g} />
      <DiscussionBlock g={g} channel={guide?.telegram_channel ?? null} />
      <FactsBlock u={u} />
    </article>
  )
}
