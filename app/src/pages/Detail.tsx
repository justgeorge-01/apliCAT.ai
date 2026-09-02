import { Suspense, lazy, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronLeft,
  ExternalLink,
  MessageCircle,
  ShieldAlert,
} from "lucide-react"

import { CscaBlock } from "@/components/CscaBlock"
import { FactRow } from "@/components/FactRow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Kicker } from "@/components/ui/kicker"
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
  return <ChinaDetail id={item.id} initial={isChinaUniversity(item) ? item : null} onBack={onBack} />
}

/* ---------- «Китай» ---------- */

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
}: {
  id: string
  initial: ChinaUniversity | null
  onBack: () => void
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
          <h1 className="text-lg font-semibold">Вуз не найден в каталоге</h1>
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

  const inPlan = isInPlan(plan, u.id)
  const onTogglePlan = () => {
    const next = togglePlan(plan, u.id)
    setPlan(next)
    savePlan(next)
    toast(inPlan ? "Убрали из плана" : "Добавили в мой план")
  }

  const checkedAt = lastChecked(u)
  const estimate = yearInChinaEstimate(u)
  const title = u.name_ru ?? u.name
  const subtitle = [u.name_ru ? u.name : null, u.city].filter(Boolean).join(" · ")

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* back */}
      <motion.div variants={fadeUp} className="mb-5">
        <BackButton onBack={onBack} />
      </motion.div>

      {/* head */}
      <motion.header variants={fadeUp} className="flex flex-col gap-4">
        <div className="min-w-0">
          <Kicker>{u.city} · Китай</Kicker>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-fg-muted sm:text-base">{subtitle}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
          <Badge variant="secondary">
            {u.coverage.published} из {u.coverage.expected} фактов проверено
          </Badge>
          <span>{checkedAt ? `последняя проверка ${formatCheckedAt(checkedAt)}` : "проверка не проводилась"}</span>
          {u.website && (
            <a
              href={u.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              официальный сайт
            </a>
          )}
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

      {/* the card: six rows in the spec's order */}
      <motion.div variants={fadeUp} className="mt-8">
        <Card className="gap-0 p-5 sm:p-6">
          <Kicker as="h2">Факты с официальных страниц</Kicker>
          <p className="mt-1.5 text-xs text-fg-faint">
            Значения напечатаны так, как опубликовал вуз. Нажмите на бейдж, чтобы увидеть цитату и ссылку.
          </p>

          <dl className="mt-5 divide-y divide-border">
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

          {/* the ONLY number the storefront computes – always with «оценка» */}
          <div className="mt-5 border-t border-border pt-4">
            {estimate ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[13px] font-medium text-fg-muted">Год в Китае ≈</span>
                <span className="text-[15px] font-semibold text-fg">{estimate.display}</span>
                <Badge variant="outline">оценка</Badge>
                <span className="w-full text-xs text-fg-faint">
                  Обучение + 12 × общежитие по опубликованным суммам (для диапазона стоимости берётся минимум).
                  Без питания, страховки и билетов.
                </span>
              </div>
            ) : (
              <p className="text-xs text-fg-faint">
                Год в Китае не оценить: для оценки нужны опубликованные стоимость обучения и общежития.
              </p>
            )}
          </div>
        </Card>

        {/* critical fields – the same line as in the Пульт */}
        <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-fg-muted">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Дедлайны, HSK/IELTS и CSCA – критичные поля: сверьтесь с сайтом вуза перед подачей. Мы показываем
            только опубликованные условия и не оцениваем шансы.
          </span>
        </p>
      </motion.div>
    </motion.div>
  )
}
