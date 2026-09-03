import { useMemo } from "react"
import { motion } from "framer-motion"

import { ProvenanceBadge } from "@/components/ProvenanceBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Kicker } from "@/components/ui/kicker"
import { Seal, type SealProps } from "@/components/ui/seal"
import type { Catalog, Fact, University } from "@/data/china.types"
import { cscaStatus, factOf, formatCheckedAt } from "@/data/china"
import type { Tab } from "@/lib/nav"
import { getPartner, hasLead } from "@/lib/partner"
import { FIXED_DATES } from "@/lib/plan"
import { cn } from "@/lib/utils"

/* ---------- shared motion presets (ease-out, 200–300ms) ---------- */
const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/* ---------- helpers (metadata only – fact values are printed as `display`) ---------- */

/** Latest `last_checked_at` across the catalog (ISO strings compare lexicographically). */
function latestCheck(catalog: Catalog): string | null {
  let max: string | null = null
  for (const u of catalog.universities) {
    if (u.last_checked_at && (!max || u.last_checked_at > max)) max = u.last_checked_at
  }
  return max
}

/** First university with a published tuition fact – the live example of «цифра с источником». */
function exampleFact(catalog: Catalog): { u: University; f: Fact } | null {
  for (const u of catalog.universities) {
    const f = factOf(u, "fees.tuition_year_non_eu")
    if (f) return { u, f }
  }
  return null
}

const pluralRu = (n: number, one: string, few: string, many: string) => {
  const a = n % 100
  const b = n % 10
  if (a > 10 && a < 20) return many
  if (b === 1) return one
  if (b >= 2 && b <= 4) return few
  return many
}

/* ---------- content ---------- */

/** The three promises – set in gold on the red band. */
const PROMISES = [
  {
    title: "Каждая цифра – с источником и датой",
    text: "Факт без ссылки на официальную страницу и без даты проверки на витрину не попадает. Значения печатаются как есть, без пересчётов.",
  },
  {
    title: "CSCA – что требует именно этот вуз",
    text: "Мы не пишем «нужен всем». В карточке – что заявил конкретный вуз: требуется, не требуется или не опубликовано, с датой проверки.",
  },
  {
    title: "Бесплатно и без аккаунта",
    text: "План, дедлайны и чеклист документов хранятся только в вашем браузере. Мы не собираем контакты, не консультируем и не сотрудничаем с вузами.",
  },
]

/**
 * The four seals of a fact – the same glyph / variant / tone as
 * ProvenanceBadge, so the legend shows exactly what the card shows.
 * `meaning` spells the glyph out: a character is never left unexplained.
 */
const SEALS: {
  seal: Pick<SealProps, "glyph" | "variant" | "tone">
  meaning: string
  label: (date: string) => string
  text: string
}[] = [
  {
    seal: { glyph: "印", variant: "solid", tone: "accent" },
    meaning: "«печать»",
    label: (d) => `проверено автоматически · ${d}`,
    text: "Факт извлечён конвейером со страницы вуза. Клик по печати в карточке раскрывает дословную цитату и ссылку на источник.",
  },
  {
    seal: { glyph: "手", variant: "solid", tone: "accent" },
    meaning: "«рукой»",
    label: (d) => `проверено вручную · ${d}`,
    text: "Внесён оператором с официальной страницы – с той же цитатой и ссылкой.",
  },
  {
    seal: { glyph: "档", variant: "outline", tone: "warning" },
    meaning: "«архив»",
    label: (d) => `по архивной копии от ${d}`,
    text: "Сайт вуза был недоступен, значение взято из копии archive.org. Сверьте на живой странице.",
  },
  {
    seal: { glyph: "试", variant: "outline", tone: "muted" },
    meaning: "«проба»",
    label: (d) => `демо · ${d}`,
    text: "Встроенный пример, который не прошёл конвейер: значение с официальной страницы, но без автоматической проверки.",
  },
]

const STEPS = [
  {
    title: "Ответьте на пять вопросов",
    text: "Степень, направление, язык обучения, HSK или IELTS и бюджет. Профиль хранится только в вашем браузере.",
  },
  {
    title: "Отфильтруйте каталог",
    text: "Город, язык, CSCA, HSK, бюджет и дедлайн. Под каждым вузом – что подходит по опубликованным условиям, чего не хватает и что не проверено.",
  },
  {
    title: "Соберите план",
    text: "Статусы по вузам, чеклист документов и лента дедлайнов вместе с общими датами сессий CSCA и окна стипендии CSC.",
  },
  {
    title: "Сверьте и подавайтесь",
    text: "Перед подачей откройте официальную страницу по ссылке из карточки: дедлайны и требования вузы меняют чаще всего.",
  },
]

/* ---------- page ---------- */
export interface HomeProps {
  /** null while the catalog is loading. */
  catalog: Catalog | null
  hasProfile: boolean
  /** «Подобрать вуз»: the shell opens the onboarding (no profile) or the catalog. */
  onStart: () => void
  /** Re-open the five questions over an existing profile. */
  onEditProfile: () => void
  setTab: (t: Tab) => void
  openDetail: (u: University) => void
}

export default function Home({ catalog, hasProfile, onStart, onEditProfile, setTab, openDetail }: HomeProps) {
  const partner = getPartner()
  const total = catalog?.universities.length ?? 0
  const checkedAt = catalog ? latestCheck(catalog) : null
  const example = useMemo(() => (catalog ? exampleFact(catalog) : null), [catalog])
  const csca = useMemo(() => {
    const c = { required: 0, not_required: 0, unknown: 0 }
    for (const u of catalog?.universities ?? []) c[cscaStatus(u)] += 1
    return c
  }, [catalog])
  const preview = useMemo(
    () => (catalog ? catalog.universities.filter((u) => u.coverage.published > 0).slice(0, 4) : []),
    [catalog],
  )
  const cscaSource = FIXED_DATES.find((d) => d.id.startsWith("csca-"))
  const cscSource = FIXED_DATES.find((d) => d.id.startsWith("csc-"))
  const legendDate = checkedAt ? formatCheckedAt(checkedAt) : "дата"
  const totalLabel = `${total} ${pluralRu(total, "вуз", "вуза", "вузов")}`

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* hero – straight on the paper, no card */}
      <motion.section variants={fadeUp} className="pt-2 sm:pt-4">
        <HanziKicker hanzi="留学中国">Поступление в Китай</HanziKicker>
        {/* `caps` / weight sit on the inner span: index.css styles h1–h3 outside
            a cascade layer, so utilities on the heading itself are overridden. */}
        <h1 className="mt-4 max-w-4xl text-3xl leading-[1.12] text-balance text-accent-text sm:text-4xl lg:text-5xl">
          <span className="caps font-extrabold">Вузы Китая без домыслов</span>
        </h1>
        <p className="mt-4 max-w-2xl font-display text-xl leading-snug font-bold text-fg sm:text-2xl">
          Факты с официальных страниц вузов – с источником и датой проверки.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">
          Каталог с дедлайнами, стоимостью, требованиями к HSK и IELTS, статусом CSCA и стипендиями.
          Фильтр по формальным условиям, план подачи с документами и дедлайнами – всё в браузере,
          бесплатно и без регистрации. Никаких «шансов» и рейтингов: только то, что вуз опубликовал сам.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button size="xl" onClick={onStart}>
            {hasProfile ? "Открыть каталог" : "Подобрать вуз"}
          </Button>
          {hasProfile ? (
            <Button variant="outline" size="xl" onClick={onEditProfile}>
              Изменить ответы
            </Button>
          ) : (
            <Button variant="outline" size="xl" onClick={() => setTab("find")}>
              Смотреть каталог без вопросов
            </Button>
          )}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-fg-muted">
          <Seal />
          <span className="min-w-0 flex-1">
            {catalog
              ? `${totalLabel} в каталоге · ${
                  checkedAt ? `последняя проверка ${formatCheckedAt(checkedAt)}` : "автоматическая проверка ещё не проводилась"
                }`
              : "Загружаем каталог"}
          </span>
        </p>
      </motion.section>

      {/* red band – the three promises in gold */}
      <motion.section variants={fadeUp} className="mt-8 rounded-lg bg-accent px-6 py-7 text-accent-fg sm:mt-10 sm:px-8 sm:py-9">
        <HanziKicker tone="inverse" hanzi="事实">
          Факты
        </HanziKicker>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {PROMISES.map((p, i) => (
            <div
              key={p.title}
              className={cn(
                "border-gold/30",
                i > 0 && "border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8",
              )}
            >
              <h2 className="text-lg leading-snug font-bold text-balance text-gold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper/85">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-gold/30 pt-4 text-xs text-paper/90">
          Значения печатаются как есть, без пересчётов и без «шансов»: витрина показывает только то, что
          вуз опубликовал сам.
        </p>
      </motion.section>

      {/* catalog preview – mounts after the catalog loads, so it animates on its own */}
      {preview.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="show" className="mt-8 sm:mt-10">
          <Card className="gap-0 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-2">
              <div>
                <HanziKicker hanzi="大学">Каталог</HanziKicker>
                <h2 className="mt-1.5 text-xl font-bold">Что уже проверено</h2>
              </div>
              <Button variant="link" size="xs" onClick={() => setTab("find")}>
                Все {totalLabel}
              </Button>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {preview.map((u) => {
                const status = cscaStatus(u)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openDetail(u)}
                    className="flex items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-200 outline-none hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-snug font-semibold">{u.name_ru ?? u.name}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                        {u.city && (
                          <>
                            <span>{u.city}</span>
                            <span aria-hidden>·</span>
                          </>
                        )}
                        <span>
                          {u.coverage.published} из {u.coverage.expected} фактов
                        </span>
                        {u.last_checked_at && (
                          <>
                            <span aria-hidden>·</span>
                            <span>проверено {formatCheckedAt(u.last_checked_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={status === "required" ? "warning" : status === "not_required" ? "positive" : "outline"}
                      className="shrink-0"
                    >
                      {status === "required" ? "CSCA требуется" : status === "not_required" ? "CSCA не требуется" : "CSCA не опубликовано"}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </Card>
        </motion.section>
      )}

      {/* how to read the seals – the real Seal component in all four states */}
      <motion.section variants={fadeUp} className="mt-8 sm:mt-10">
        <Card className="gap-0 p-5 sm:p-6">
          <HanziKicker hanzi="印章">Печати</HanziKicker>
          <h2 className="mt-1.5 text-xl font-bold">Как читать печати</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            У каждого факта в карточке стоит печать. Сплошная красная – факт проверен по официальной
            странице; контурная – значение есть, но взято из архива или из встроенного примера.
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            {SEALS.map((row) => (
              <div key={row.seal.glyph} className="flex gap-3.5">
                <Seal {...row.seal} size="md" className="mt-0.5" />
                <div className="min-w-0">
                  <dt className="text-sm font-semibold">{row.label(legendDate)}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-fg-muted">
                    <span lang="zh-Hans" translate="no" className="font-cjk text-fg">
                      {row.seal.glyph}
                    </span>{" "}
                    – {row.meaning}. {row.text}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          {/* the live example – a real fact from the catalog with its real badge */}
          {example ? (
            <div className="mt-6 rounded-lg border border-border bg-card-2 p-4">
              <div className="text-xs text-fg-muted">
                Так это выглядит в карточке · {example.u.name_ru ?? example.u.name} · {example.f.label_ru}
              </div>
              <div className="mt-1 font-display text-lg font-bold">{example.f.display}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ProvenanceBadge fact={example.f} />
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-border-strong p-4 text-xs text-fg-muted">
              {catalog ? "В каталоге пока нет опубликованных фактов" : "Пример появится, когда загрузится каталог"}
            </div>
          )}

          {/* the other labels of the card */}
          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-border pt-6 md:grid-cols-2">
            {(
              [
                {
                  badge: (
                    <span className="flex flex-wrap gap-1.5">
                      <Badge variant="warning">CSCA требуется</Badge>
                      <Badge variant="positive">CSCA не требуется</Badge>
                      <Badge variant="outline">CSCA не опубликовано</Badge>
                    </span>
                  ),
                  text: "Статус CSCA по заявлению самого вуза. «Не опубликовано» значит именно это – не «нет».",
                },
                {
                  badge: <Badge variant="outline">вуз не публикует · проверено {legendDate}</Badge>,
                  text: "Строка карточки не пропадает: если факта нет на официальной странице, мы говорим это прямо, с датой проверки.",
                },
                {
                  badge: <Badge variant="secondary">7 из 8 фактов проверено</Badge>,
                  text: "Покрытие карточки: сколько из восьми ключевых фактов вуз опубликовал.",
                },
                {
                  badge: <Badge variant="warning">сверьтесь с сайтом вуза перед подачей</Badge>,
                  text: "Стоит под дедлайнами, HSK/IELTS и CSCA – критичными полями, которые меняются чаще всего.",
                },
              ] as { badge: React.ReactNode; text: string }[]
            ).map((row, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <dt>{row.badge}</dt>
                <dd className="text-sm leading-relaxed text-fg-muted">{row.text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </motion.section>

      {/* the one quotation – ink band, gold characters, the translation beside */}
      <motion.section
        variants={fadeUp}
        className="mt-8 rounded-lg border border-border bg-ink px-6 py-8 text-paper sm:mt-10 sm:px-8 sm:py-10"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10">
          <p
            lang="zh-Hans"
            translate="no"
            className="font-cjk text-4xl leading-none font-semibold tracking-[0.12em] text-gold sm:text-5xl"
          >
            实事求是
          </p>
          <div>
            <p className="font-display text-xl leading-snug font-bold sm:text-2xl">«Искать истину в фактах»</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-paper/80">
              <span lang="zh-Latn">shí shì qiú shì</span> – опираться на факты, а не на домыслы; изречение
              из «Ханьшу», I век. Мы читаем его буквально: каждая цифра на витрине – с официальной
              страницы, с цитатой и датой проверки.
            </p>
          </div>
        </div>
      </motion.section>

      {/* honest CSCA paragraph */}
      <motion.section variants={fadeUp} className="mt-8 sm:mt-10">
        <Card className="gap-0 p-5 sm:p-6">
          <HanziKicker hanzi="考试">CSCA</HanziKicker>
          <h2 className="mt-1.5 text-xl font-bold">Честно про CSCA</h2>
          <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:gap-8">
            <p className="text-sm leading-relaxed text-fg-muted">
              CSCA – единый экзамен для иностранных абитуриентов китайских вузов. С учебного года
              2026/27 он обязателен для вузов сети правительственных стипендий и для стипендии
              правительства КНР (CSC). Распространение на все вузы и минимальные проходные баллы –
              в планах с 2028 года. Вузы применяют требование по-разному: одни уже просят отчёт о
              результатах, другие пока нет, третьи ничего не заявили. Поэтому мы показываем только
              то, что заявил конкретный вуз, и не делаем выводов за него.
            </p>
            {catalog && (
              <dl className="grid grid-cols-3 gap-2 self-start text-center lg:w-72">
                {(
                  [
                    ["Требуется", csca.required],
                    ["Не требуется", csca.not_required],
                    ["Не опубликовано", csca.unknown],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="rounded-lg border border-border bg-card-2 px-2 py-2.5">
                    <dt className="text-[11px] leading-tight text-fg-muted">{label}</dt>
                    <dd className="mt-1 font-display text-2xl leading-none font-bold text-accent-text">{n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <p className="mt-4 text-xs text-fg-muted">
            Источники:{" "}
            {cscaSource && (
              <a href={cscaSource.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-text underline-offset-2 hover:underline">
                csca.cn
              </a>
            )}
            {cscaSource && cscSource && " и "}
            {cscSource && (
              <a href={cscSource.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-text underline-offset-2 hover:underline">
                campuschina.org
              </a>
            )}
            {cscaSource && `; текст сверен ${formatCheckedAt(cscaSource.verified_at)}.`}
          </p>
        </Card>
      </motion.section>

      {/* how it works */}
      <motion.section variants={fadeUp} className="mt-8 sm:mt-10">
        <Kicker>Шаг за шагом</Kicker>
        <h2 className="mt-1.5 mb-4 text-xl font-bold">Как это работает</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="gap-0 p-5">
              <span className="font-display text-2xl leading-none font-extrabold text-accent-text">0{i + 1}</span>
              <h3 className="mt-3 text-base leading-snug font-bold">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{s.text}</p>
            </Card>
          ))}
        </div>
      </motion.section>

      {/* partner – only when a lead link is configured */}
      {hasLead(partner) && (
        <motion.section variants={fadeUp} className="mt-8 sm:mt-10">
          <Card className="gap-0 border-l-2 border-l-accent p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <HanziKicker hanzi="导师">Наставник</HanziKicker>
                <h2 className="mt-1.5 text-xl font-bold">{partner.expertPage?.title ?? `${partner.name} разбирает такие кейсы`}</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-muted">
                  {partner.expertPage?.paragraphs[0] ??
                    "Витрина показывает только формальные условия. Выбор вуза, документы и раунд подачи – к наставнику."}
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <a href={partner.lead.url} target="_blank" rel="noopener noreferrer">
                  {partner.lead.label}
                </a>
              </Button>
            </div>
          </Card>
        </motion.section>
      )}
    </motion.div>
  )
}
