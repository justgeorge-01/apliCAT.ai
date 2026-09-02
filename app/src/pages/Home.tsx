import { useMemo } from "react"
import { motion } from "framer-motion"
import { ArrowUpRight, FileSearch, ShieldCheck, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Kicker } from "@/components/ui/kicker"
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

/** Provenance line of a fact – the same three states as the card's ProvenanceBadge (spec §3.3). */
function provenanceLabel(f: Fact): string {
  if (f.origin === "demo") return `демо · ${formatCheckedAt(f.verified_at)}`
  if (f.snapshot?.render_method === "wayback")
    return `по архивной копии от ${formatCheckedAt(f.snapshot.archived_at) || "даты снимка"}`
  if (f.origin === "manual") return `проверено вручную · ${formatCheckedAt(f.verified_at)}`
  return `проверено автоматически · ${formatCheckedAt(f.verified_at)}`
}

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

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* hero */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 lg:p-10">
        <div className="hero-glow pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative">
          <Kicker accent>Поступление в Китай</Kicker>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Вузы Китая без домыслов: факты с официальных страниц, с источником и датой
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">
            Каталог вузов с дедлайнами, стоимостью, требованиями к HSK и IELTS, статусом CSCA и
            стипендиями. Фильтр по формальным условиям, план подачи с документами и дедлайнами –
            всё в браузере, бесплатно и без регистрации. Никаких «шансов» и рейтингов: только то,
            что вуз опубликовал сам.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="xl" onClick={onStart}>
              {hasProfile ? "Открыть каталог" : "Подобрать вуз"}
            </Button>
            {hasProfile ? (
              <Button variant="secondary" size="xl" onClick={onEditProfile}>
                Изменить ответы
              </Button>
            ) : (
              <Button variant="secondary" size="xl" onClick={() => setTab("find")}>
                Смотреть каталог без вопросов
              </Button>
            )}
          </div>
          <p className="mt-5 text-xs text-fg-muted">
            {catalog
              ? `${total} ${pluralRu(total, "вуз", "вуза", "вузов")} в каталоге · ${
                  checkedAt ? `последняя проверка ${formatCheckedAt(checkedAt)}` : "автоматическая проверка ещё не проводилась"
                }`
              : "Загружаем каталог"}
          </p>
        </div>
      </motion.div>

      {/* three promises */}
      <motion.div variants={fadeUp} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 1 – every number with a source and a date */}
        <Card className="gap-0 p-5 sm:p-6">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <ShieldCheck className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold">Каждая цифра – с источником и датой</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Факт без ссылки на официальную страницу и без даты проверки на витрину не попадает.
            Значения печатаются как есть, без пересчётов.
          </p>
          {example ? (
            <div className="mt-4 rounded-xl border border-border bg-card-2 p-3.5">
              <div className="text-xs text-fg-muted">
                {example.u.name_ru ?? example.u.name} · {example.f.label_ru}
              </div>
              <div className="mt-1 text-sm font-semibold">{example.f.display}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={example.f.origin === "demo" ? "secondary" : "default"}>{provenanceLabel(example.f)}</Badge>
                <a
                  href={example.f.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-text underline-offset-2 hover:underline"
                >
                  источник <ArrowUpRight className="size-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border-strong p-3.5 text-xs text-fg-faint">
              {catalog ? "В каталоге пока нет опубликованных фактов" : "Пример появится, когда загрузится каталог"}
            </div>
          )}
        </Card>

        {/* 2 – CSCA per university */}
        <Card className="gap-0 p-5 sm:p-6">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <FileSearch className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold">CSCA – что требует именно этот вуз</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Мы не пишем «нужен всем». В карточке – что заявил конкретный вуз: требуется, не
            требуется или не опубликовано, с датой проверки.
          </p>
          {catalog && (
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["Требуется", csca.required],
                  ["Не требуется", csca.not_required],
                  ["Не опубликовано", csca.unknown],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-xl border border-border bg-card-2 px-2 py-2.5">
                  <dt className="text-[11px] leading-tight text-fg-muted">{label}</dt>
                  <dd className="mt-1 text-lg font-bold">{n}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        {/* 3 – free, no account */}
        <Card className="gap-0 p-5 sm:p-6">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <Wallet className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold">Бесплатно и без аккаунта</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            План, дедлайны и чеклист документов хранятся только в вашем браузере. Мы не собираем
            контакты, не консультируем и не сотрудничаем с вузами.
          </p>
          <Button variant="link" size="sm" className="mt-3 h-auto justify-start px-0" onClick={() => setTab("policy")}>
            Политика и дисклеймер
          </Button>
        </Card>
      </motion.div>

      {/* catalog preview – mounts after the catalog loads, so it animates on its own */}
      {preview.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-4">
          <Card className="gap-0 p-4 sm:p-5">
            <div className="mb-1 flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold">В каталоге</h2>
              <Button variant="link" size="xs" onClick={() => setTab("find")}>
                Все {total} {pluralRu(total, "вуз", "вуза", "вузов")}
              </Button>
            </div>
            <div className="flex flex-col">
              {preview.map((u) => {
                const status = cscaStatus(u)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openDetail(u)}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-200 outline-none hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{u.name_ru ?? u.name}</span>
                        <ArrowUpRight className="size-4 shrink-0 text-fg-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                        <span>{u.city}</span>
                        <span aria-hidden>·</span>
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
        </motion.div>
      )}

      {/* how to read the badges */}
      <motion.div variants={fadeUp} className="mt-8 sm:mt-10">
        <Kicker as="h2" className="mb-4">
          Как читать бейджи
        </Kicker>
        <Card className="gap-0 p-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            {(
              [
                {
                  badge: <Badge>проверено автоматически · {legendDate}</Badge>,
                  text: "Факт извлечён конвейером со страницы вуза. Клик по бейджу в карточке раскрывает дословную цитату и ссылку на источник.",
                },
                {
                  badge: <Badge>проверено вручную · {legendDate}</Badge>,
                  text: "Внесён оператором с официальной страницы – с той же цитатой и ссылкой.",
                },
                {
                  badge: <Badge variant="warning">по архивной копии от {legendDate}</Badge>,
                  text: "Сайт вуза был недоступен, значение взято из копии archive.org. Сверьте на живой странице.",
                },
                {
                  badge: <Badge variant="secondary">демо</Badge>,
                  text: "Встроенный пример, который не прошёл конвейер: значение с официальной страницы, но без автоматической проверки.",
                },
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
      </motion.div>

      {/* honest CSCA paragraph */}
      <motion.div variants={fadeUp} className="mt-4">
        <Card className="gap-0 p-5 sm:p-6">
          <h2 className="text-base font-semibold">Честно про CSCA</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            CSCA – единый экзамен для иностранных абитуриентов китайских вузов. С учебного года
            2026/27 он обязателен для вузов сети правительственных стипендий и для стипендии
            правительства КНР (CSC). Распространение на все вузы и минимальные проходные баллы –
            в планах с 2028 года. Вузы применяют требование по-разному: одни уже просят отчёт о
            результатах, другие пока нет, третьи ничего не заявили. Поэтому мы показываем только
            то, что заявил конкретный вуз, и не делаем выводов за него.
          </p>
          <p className="mt-3 text-xs text-fg-faint">
            Источники:{" "}
            {cscaSource && (
              <a href={cscaSource.source_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                csca.cn
              </a>
            )}
            {cscaSource && cscSource && " и "}
            {cscSource && (
              <a href={cscSource.source_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                campuschina.org
              </a>
            )}
            {cscaSource && `; текст сверен ${formatCheckedAt(cscaSource.verified_at)}.`}
          </p>
        </Card>
      </motion.div>

      {/* how it works */}
      <motion.div variants={fadeUp} className="mt-8 sm:mt-10">
        <Kicker as="h2" className="mb-4">
          Как это работает
        </Kicker>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="gap-0 p-5">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-fg">
                {i + 1}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{s.text}</p>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* partner – only when a lead link is configured */}
      {hasLead(partner) && (
        <motion.div variants={fadeUp} className="mt-4">
          <Card className={cn("gap-0 p-5 sm:p-6", "border-accent/40")}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">{partner.expertPage?.title ?? `${partner.name} разбирает такие кейсы`}</h2>
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
        </motion.div>
      )}
    </motion.div>
  )
}
