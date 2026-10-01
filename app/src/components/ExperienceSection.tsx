import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import {
  experienceOf,
  formatWrittenAt,
  groupByTopic,
  layerLabel,
  loadExperience,
  type ExperienceData,
  type ExperienceItem,
  type ExperienceLayer,
} from "@/data/experience"

/* The layer is told by the badge's SHAPE as well as by its words: a tinted
   label for a graduate's own answer, a plain contour for a retold post, a grey
   one for what the pipeline collected on its own. */
const LAYER_BADGE: Record<ExperienceLayer, "default" | "outline" | "secondary"> = {
  alumni: "default",
  manual: "outline",
  auto: "secondary",
}

function ExperienceLine({ item }: { item: ExperienceItem }) {
  return (
    <li className="grid gap-1.5 border-b border-border py-3 last:border-b-0">
      <p className="text-[15px] leading-relaxed text-fg">{item.text}</p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg-muted">
        <Badge variant={LAYER_BADGE[item.layer]}>{layerLabel(item)}</Badge>
        {item.author && <span>{item.author}</span>}
        <span className="text-fg-faint" aria-hidden="true">
          ·
        </span>
        <span>{formatWrittenAt(item.written_at)}</span>
        {item.source_url && (
          <>
            <span className="text-fg-faint" aria-hidden="true">
              ·
            </span>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border-strong underline-offset-2 transition-colors hover:text-accent-text hover:decoration-current"
            >
              источник
            </a>
          </>
        )}
      </div>
    </li>
  )
}

/**
 * «Опыт студентов» on the university page: what students and graduates say,
 * grouped by topic, each line with its layer, date and source. Opinions, never
 * conditions – the block says so and points back to the facts above it. Without
 * items it stays on the page and says plainly that there is nothing yet.
 */
export function ExperienceSection({ universityId, className }: { universityId: string; className?: string }) {
  const [data, setData] = useState<ExperienceData | null>(null)
  useEffect(() => {
    let alive = true
    loadExperience().then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [])

  const groups = data ? groupByTopic(experienceOf(data, universityId)) : []

  return (
    <Card className={className ? `gap-0 p-5 sm:p-6 ${className}` : "gap-0 p-5 sm:p-6"} data-slot="experience">
      <HanziKicker as="h2" hanzi="经验">
        Опыт студентов
      </HanziKicker>
      <p className="mt-2 max-w-prose text-sm text-fg-muted">
        Что пишут студенты и выпускники, пересказом и без имён. Это мнения, а не условия поступления: условия – в
        блоке «Факты» выше. Каждый пункт перед публикацией прочитал человек.
      </p>

      {data === null ? (
        <div className="mt-5 h-16 animate-pulse rounded-md bg-card-2" aria-busy="true" aria-label="Загрузка опыта студентов" />
      ) : groups.length === 0 ? (
        <p className="mt-5 border-t border-border pt-4 text-sm text-fg-muted">
          Об этом вузе опыта пока нет. Мы собираем его из анкет выпускников и пересказов постов студентов.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 border-t border-border pt-4">
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`exp-${g.id}`}>
              <h3 id={`exp-${g.id}`} className="text-[13px] font-semibold text-fg-muted">
                {g.label_ru}
              </h3>
              <ul className="mt-1">
                {g.items.map((item, i) => (
                  <ExperienceLine key={`${g.id}:${i}`} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}

export default ExperienceSection
