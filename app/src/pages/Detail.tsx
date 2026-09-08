import { Fragment, Suspense, lazy, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { BookmarkCheck, BookmarkPlus, ChevronLeft, ExternalLink, MessageCircle } from "lucide-react"

import { CscaBlock } from "@/components/CscaBlock"
import { CriticalMark, FactRow } from "@/components/FactRow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { useToast } from "@/components/ui/use-toast"
import {
  CARD_ROWS,
  factsOf,
  findUniversity,
  formatCheckedAt,
  isCriticalKey,
  lastChecked,
  loadCatalog,
  yearInChinaEstimate,
} from "@/data/china"
import type { Catalog, University as ChinaUniversity } from "@/data/china.types"
import { FEATURES } from "@/lib/features"
import { getPartner, hasLead } from "@/lib/partner"
import { PLAN_STORAGE_KEY, isInPlan, loadPlan, savePlan, togglePlan, type Plan } from "@/lib/plan"
import type { AnyProgram } from "@/legacy"

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

/**
 * The European detail page (Bocconi report, Uni-fit, «С чего начать») stays in
 * the repo but is loaded only for `VITE_MARKET=europe` – its chunk never ships
 * in the «Китай» build.
 */
const DetailLegacy = lazy(() => import("./DetailLegacy"))

/* ---------- props ---------- */

/**
 * Compatible with the current call in App.tsx (legacy `AnyProgram` + roadmap
 * props). In the «Китай» build only `item.id` and `onBack` are used: the
 * university is resolved from the catalog by id, so the shell may pass either
 * a catalog `University` or any object with the same `id`.
 */
export interface DetailProps {
  item: AnyProgram | ChinaUniversity
  onBack: () => void
  saved?: boolean
  prio?: boolean
  toggleSave?: (id: string) => void
  togglePrio?: (id: string) => void
  addRoadmap?: (item: AnyProgram) => void
  hasRoadmap?: boolean
  openDetail?: (item: AnyProgram) => void
}

function isChinaUniversity(x: AnyProgram | ChinaUniversity): x is ChinaUniversity {
  return "facts" in x && Array.isArray(x.facts)
}

const noop = () => {}

export default function Detail(props: DetailProps) {
  const { item, onBack } = props
  if (FEATURES.market === "europe" && !isChinaUniversity(item)) {
    return (
      <Suspense fallback={<DetailSkeleton />}>
        <DetailLegacy
          item={item}
          onBack={onBack}
          saved={props.saved ?? false}
          prio={props.prio ?? false}
          toggleSave={props.toggleSave ?? noop}
          togglePrio={props.togglePrio ?? noop}
          addRoadmap={props.addRoadmap ?? noop}
          hasRoadmap={props.hasRoadmap ?? false}
          openDetail={props.openDetail ?? noop}
        />
      </Suspense>
    )
  }
  return (
    <ChinaDetail
      id={item.id}
      initial={isChinaUniversity(item) ? item : null}
      onBack={onBack}
      inPlanProp={props.toggleSave ? props.saved : undefined}
      onTogglePlanProp={props.toggleSave}
    />
  )
}

/* ---------- «Китай» ---------- */

/** CJK Unified Ideographs (+ Extension A). */
const HANZI_RE = /[\u3400-\u4dbf\u4e00-\u9fff]+/
/** The same run, capturing – `split` keeps the Han parts. */
const HANZI_SPLIT_RE = /([\u3400-\u4dbf\u4e00-\u9fff]+)/

/**
 * The name with its Han runs marked up («北京大学 «Бейда»» – the characters in
 * the CJK face, the rest in the display face). Plain text otherwise.
 */
function TitleText({ text }: { text: string }) {
  return (
    <>
      {text.split(HANZI_SPLIT_RE).map((part, i) =>
        HANZI_RE.test(part) ? (
          <span key={i} lang="zh-Hans" translate="no" className="font-cjk">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
      <ChevronLeft /> Назад к каталогу
    </Button>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Загрузка карточки вуза">
      <Card className="h-24 animate-pulse gap-0 p-0" />
      <Card className="h-80 animate-pulse gap-0 p-0" />
    </div>
  )
}

function ChinaDetail({
  id,
  initial,
  onBack,
  inPlanProp,
  onTogglePlanProp,
}: {
  id: string
  initial: ChinaUniversity | null
  onBack: () => void
  /**
   * The shell owns the plan (local or the account, via lib/planStore) and
   * passes the state and the toggle; without them the card reads and writes
   * `admitica.cn.plan` itself (standalone use).
   */
  inPlanProp?: boolean
  onTogglePlanProp?: (id: string) => void
}) {
  const toast = useToast()
  const partner = getPartner()

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (alive) setCatalog(c)
    })
    return () => {
      alive = false
    }
  }, [])

  // «Мой план» – admitica.cn.plan. Re-read when another tab changes it.
  const [plan, setPlan] = useState<Plan>(() => loadPlan())
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === PLAN_STORAGE_KEY) setPlan(loadPlan())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const u = (catalog && findUniversity(catalog, id)) ?? initial

  if (!u) {
    if (!catalog) return <DetailSkeleton />
    return (
      <div>
        <div className="mb-5">
          <BackButton onBack={onBack} />
        </div>
        <Card className="gap-3 p-6">
          <h1 className="text-xl text-accent-text">Вуз не найден в каталоге</h1>
          <p className="text-sm text-fg-muted">
            Карточки с идентификатором «{id}» нет в текущем экспорте. Вернитесь в каталог и выберите вуз заново.
          </p>
          <div>
            <Button variant="outline" onClick={onBack}>
              К каталогу
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const inPlan = onTogglePlanProp ? Boolean(inPlanProp) : isInPlan(plan, u.id)
  const onTogglePlan = () => {
    if (onTogglePlanProp) {
      onTogglePlanProp(u.id)
    } else {
      const next = togglePlan(plan, u.id)
      setPlan(next)
      savePlan(next)
    }
    toast(inPlan ? "Убрали из плана" : "Добавили в мой план")
  }

  const checkedAt = lastChecked(u)
  const estimate = yearInChinaEstimate(u)
  const title = u.name_ru ?? u.name
  // the export may leave `city` empty – the country line still places the university
  const country = u.country === "CN" ? "Китай" : u.country
  const subtitle = [u.name_ru ? u.name : null, u.city, country].filter(Boolean).join(" · ")

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* back */}
      <motion.div variants={fadeUp} className="mb-5">
        <BackButton onBack={onBack} />
      </motion.div>

      {/* head: kicker · name in the display face · city · the thin check line */}
      <motion.header variants={fadeUp} className="flex flex-col gap-6">
        <div className="min-w-0">
          {/* always the section's own characters: the university's Chinese name is
              not the meaning of «Университет», and it already stands in the H1 */}
          <HanziKicker hanzi="大学">Университет</HanziKicker>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-accent-text sm:text-4xl">
            <TitleText text={title} />
          </h1>
          {subtitle && <div className="mt-2 text-sm text-fg-muted sm:text-base">{subtitle}</div>}
          <div className="rule-accent mt-5 w-12" aria-hidden="true" />
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-muted">
            <span>
              {u.coverage.published} из {u.coverage.expected} фактов проверено
            </span>
            <span aria-hidden="true">·</span>
            <span>{checkedAt ? `последняя проверка ${formatCheckedAt(checkedAt)}` : "проверка не проводилась"}</span>
            {u.website && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={u.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline"
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                  официальный сайт
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant={inPlan ? "outline" : "default"} onClick={onTogglePlan} aria-pressed={inPlan}>
            {inPlan ? <BookmarkCheck /> : <BookmarkPlus />}
            {inPlan ? "В плане" : "В мой план"}
          </Button>
          {hasLead(partner) && (
            <Button asChild variant="outline">
              <a href={partner.lead.url} target="_blank" rel="noopener noreferrer" title={partner.name}>
                <MessageCircle />
                {partner.lead.label}
              </a>
            </Button>
          )}
        </div>
      </motion.header>

      {/* the card: six rows in the spec's order, a ledger on paper */}
      <motion.div variants={fadeUp} className="mt-10">
        <Card className="gap-0 p-5 sm:p-6">
          <HanziKicker as="h2" hanzi="事实">
            Факты
          </HanziKicker>
          <p className="mt-2 max-w-prose text-sm text-fg-muted">
            С официальных страниц вуза: значения напечатаны так, как их опубликовал вуз. Бейдж рядом со значением
            раскрывает цитату и ссылку на источник.
          </p>

          <dl className="mt-5 border-t border-border">
            {CARD_ROWS.map((row) =>
              row.id === "csca" ? (
                <CscaBlock key={row.id} u={u} />
              ) : (
                <FactRow
                  key={row.id}
                  label={row.label_ru}
                  facts={row.keys.flatMap((k) => factsOf(u, k))}
                  lastCheckedAt={checkedAt}
                  critical={row.keys.some(isCriticalKey)}
                  sublabels={row.keys.length > 1}
                />
              ),
            )}
          </dl>

          {/* the ONLY number the storefront computes – always with «оценка», set apart in italics */}
          <div className="mt-4 text-fg-muted italic">
            {estimate ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span>Год в Китае ≈</span>
                <span className="text-base font-semibold">{estimate.display}</span>
                <Badge variant="outline" className="not-italic">
                  оценка
                </Badge>
                <span className="w-full text-xs leading-relaxed">
                  Обучение + 12 × общежитие по опубликованным суммам (для диапазона стоимости берётся минимум).
                  Без питания, страховки и билетов.
                </span>
              </div>
            ) : (
              <p className="text-xs leading-relaxed">
                Год в Китае не оценить: для оценки нужны опубликованные стоимость обучения и общежития.
              </p>
            )}
          </div>
        </Card>

        {/* critical fields – the warning mark from the rows, the same line as in the Пульт */}
        <p className="mt-4 flex items-start gap-2.5 px-1 text-xs leading-relaxed text-fg-muted">
          <CriticalMark decorative className="mt-px" />
          <span>
            Дедлайны, HSK/IELTS и CSCA – критичные поля, отмечены этим знаком: сверьтесь с сайтом вуза перед
            подачей. Мы показываем только опубликованные условия и не оцениваем шансы.
          </span>
        </p>
      </motion.div>
    </motion.div>
  )
}
