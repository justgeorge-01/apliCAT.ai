import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Banknote, Briefcase, GraduationCap, Search, SlidersHorizontal, X } from "lucide-react"

import { ProgramCard } from "@/components/ProgramCard"
import { UniversityCard } from "@/components/UniversityCard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { HanziKicker } from "@/components/ui/hanzi-kicker"
import { Input } from "@/components/ui/input"
import { Kicker } from "@/components/ui/kicker"
import { Segmented } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { loadCatalog } from "@/data/china"
import type { Catalog, University } from "@/data/china.types"
import {
  applyFilters,
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP,
  cityList,
  DEFAULT_FILTERS,
  formatCny,
  HSK_LEVELS,
  matchesQuery,
  pluralRu,
  profileIsFilled,
  profileSummary,
  sortUniversities,
  type CatalogFilters,
  type CscaFilter,
  type LanguageFilter,
  type SortKey,
} from "@/lib/catalogView"
import { FEATURES } from "@/lib/features"
import { matchUniversity, PROFILE_KEY, type ChinaProfile } from "@/lib/match"
import { getPartner } from "@/lib/partner"
import { readPersist } from "@/lib/persist"
import { isInPlan, loadPlan, savePlan, togglePlan, type Plan } from "@/lib/plan"
import type { AnyProgram, Grant, Internship, University as LegacyUniversity } from "@/legacy"
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
const cardStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

/* ---------- props (the shell calls both markets the same way) ---------- */

export interface FindProps {
  /** Opens the university page (Detail rewritten for the China market). */
  openUniversity?: (u: University) => void
  /**
   * Shell-owned profile (`admitica.cn.profile`). Pass it when the shell keeps
   * the profile in state: right after onboarding the storage write lands in an
   * effect, so a fresh mount would read the old value. Absent → read storage.
   */
  profile?: ChinaProfile | null
  /** Shell-owned plan; when absent the page keeps its own copy in `admitica.cn.plan`. */
  plan?: Plan
  onTogglePlan?: (id: string) => void
  /** Leads to the onboarding to fill / edit the profile; without it only the hint is shown. */
  onEditProfile?: () => void

  /* Legacy (Europe) shell props – accepted for compatibility, used only with VITE_MARKET=europe. */
  saved?: string[]
  priorities?: string[]
  toggleSave?: (id: string) => void
  togglePrio?: (id: string) => void
  openDetail?: (item: AnyProgram) => void
}

export default function Find(props: FindProps) {
  if (FEATURES.market === "europe") return <FindEurope {...props} />
  return <FindChina {...props} />
}

/* ---------- small shared bits ---------- */

function FilterGroup({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Kicker className="mb-2 text-[11px]">{title}</Kicker>
      {children}
    </div>
  )
}

/* =====================================================================
   CHINA (spec §3.2)
   ===================================================================== */

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)

function ProfileNotice({
  profile,
  filled,
  onEdit,
}: {
  profile: ChinaProfile | null
  filled: boolean
  onEdit?: () => void
}) {
  return (
    <div className="rounded-lg border border-border border-l-2 border-l-accent bg-surface px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Kicker accent>Соответствие профилю</Kicker>
        {onEdit && (
          <Button variant="link" size="xs" className="px-0" onClick={onEdit}>
            {filled ? "Изменить профиль" : "Заполнить профиль"}
          </Button>
        )}
      </div>
      {filled && profile ? (
        <>
          <p className="mt-1.5 text-[13px] font-semibold text-fg">{profileSummary(profile).join(" · ")}</p>
          <p className="mt-1 text-xs text-fg-muted">
            Сравниваем только формальные условия по опубликованным фактам: подходит, не хватает или не проверено.
            Нет факта – «не проверено», а не «нет». Шансы и ярусы не оцениваем.
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-fg-muted">
          Профиль не заполнен – соответствие не считается. Пройдите онбординг, и у каждого вуза появится, что
          подходит, чего не хватает и что не проверено.
        </p>
      )}
    </div>
  )
}

/* ---------- active filters as red pills (cream text); a click removes the one filter ---------- */

type ChipKey = Exclude<keyof CatalogFilters, "keepUnpublished">

const LANGUAGE_CHIP: Record<Exclude<LanguageFilter, "any">, string> = {
  zh: "Китайский",
  en: "Английский",
}

const CSCA_CHIP: Record<Exclude<CscaFilter, "any">, string> = {
  required: "CSCA требуется",
  not_required: "CSCA не требуется",
  unknown: "CSCA не опубликовано",
}

/** Words for every filter that differs from the defaults (`keepUnpublished` is a display switch, not a filter). */
function activeChips(f: CatalogFilters): { key: ChipKey; label: string }[] {
  const chips: { key: ChipKey; label: string }[] = []
  if (f.city) chips.push({ key: "city", label: f.city })
  if (f.language !== "any") chips.push({ key: "language", label: LANGUAGE_CHIP[f.language] })
  if (f.csca !== "any") chips.push({ key: "csca", label: CSCA_CHIP[f.csca] })
  if (f.hskMax !== null) chips.push({ key: "hskMax", label: `HSK не выше ${f.hskMax}` })
  if (f.budgetCny !== null) chips.push({ key: "budgetCny", label: `до ${formatCny(f.budgetCny)} в год` })
  if (f.coversTuition) chips.push({ key: "coversTuition", label: "Стипендия покрывает обучение" })
  if (f.deadlineOpen) chips.push({ key: "deadlineOpen", label: "Дедлайн ещё не прошёл" })
  return chips
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Убрать фильтр: ${label}`}
      title="Убрать фильтр"
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-accent pr-1.5 pl-2.5 font-body text-xs font-semibold text-accent-fg transition-[filter] duration-200 outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span>{label}</span>
      <X className="size-3" aria-hidden="true" />
    </button>
  )
}

function ChinaFilterPanel({
  filters,
  setFilters,
  cities,
  profile,
}: {
  filters: CatalogFilters
  setFilters: (f: CatalogFilters) => void
  cities: string[]
  profile: ChinaProfile | null
}) {
  const update = <K extends keyof CatalogFilters>(key: K, val: CatalogFilters[K]) =>
    setFilters({ ...filters, [key]: val })

  const myHsk = isNum(profile?.hsk) ? profile.hsk : null
  const levels = myHsk !== null && !HSK_LEVELS.includes(myHsk) ? [...HSK_LEVELS, myHsk].sort((a, b) => a - b) : HSK_LEVELS
  const myBudget = isNum(profile?.budget_year_cny) ? profile.budget_year_cny : null
  const sliderValue = filters.budgetCny ?? BUDGET_MAX

  const chips = activeChips(filters)

  const switchRow = (label: string, key: "coversTuition" | "deadlineOpen" | "keepUnpublished") => (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <Switch checked={filters[key]} onCheckedChange={(v) => update(key, v)} />
    </label>
  )

  return (
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Kicker accent>Фильтры</Kicker>
        {(chips.length > 0 || filters.keepUnpublished) && (
          <Button variant="link" size="xs" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Сбросить
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Активные фильтры">
          {chips.map((c) => (
            <FilterChip key={c.key} label={c.label} onRemove={() => update(c.key, DEFAULT_FILTERS[c.key])} />
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <FilterGroup title="Город">
          <Select value={filters.city ?? ""} onChange={(e) => update("city", e.target.value || null)}>
            <option value="">Все города</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterGroup>

        <FilterGroup title="Язык обучения">
          <Select value={filters.language} onChange={(e) => update("language", e.target.value as LanguageFilter)}>
            <option value="any">Любой</option>
            <option value="zh">Китайский</option>
            <option value="en">Английский</option>
          </Select>
        </FilterGroup>

        <FilterGroup title="CSCA">
          <Select value={filters.csca} onChange={(e) => update("csca", e.target.value as CscaFilter)}>
            <option value="any">Не важно</option>
            <option value="required">Требуется</option>
            <option value="not_required">Не требуется</option>
            <option value="unknown">Не опубликовано</option>
          </Select>
        </FilterGroup>

        <FilterGroup title="HSK вуза не выше">
          <Select
            value={filters.hskMax === null ? "" : String(filters.hskMax)}
            onChange={(e) => update("hskMax", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Любой</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                HSK {l}
                {l === myHsk ? " (мой уровень)" : ""}
              </option>
            ))}
          </Select>
        </FilterGroup>

        <FilterGroup title="Стоимость в год не выше">
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={sliderValue}
            aria-label="Стоимость обучения в год не выше"
            onChange={(e) => {
              const v = Number(e.target.value)
              update("budgetCny", v >= BUDGET_MAX ? null : v)
            }}
            className="w-full cursor-pointer accent-accent"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-fg-muted">
            <span>{filters.budgetCny === null ? "любая" : `до ${formatCny(filters.budgetCny)}`}</span>
            {myBudget !== null && (
              <Button
                variant="link"
                size="xs"
                onClick={() => update("budgetCny", myBudget >= BUDGET_MAX ? null : Math.max(BUDGET_MIN, myBudget))}
              >
                мой бюджет: {formatCny(myBudget)}
              </Button>
            )}
          </div>
        </FilterGroup>

        <FilterGroup title="Дополнительно">
          {switchRow("Стипендия покрывает обучение", "coversTuition")}
          {switchRow("Дедлайн ещё не прошёл", "deadlineOpen")}
          {switchRow("Показывать вузы без данных по фильтру", "keepUnpublished")}
        </FilterGroup>
      </div>
    </div>
  )
}

function FindChina({ openUniversity, profile: profileProp, plan: planProp, onTogglePlan, onEditProfile }: FindProps) {
  const toast = useToast()
  const [now] = useState(() => new Date())
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortKey>("deadline")
  const [storedProfile] = useState<ChinaProfile | null>(() => readPersist<ChinaProfile | null>(PROFILE_KEY, null))
  const profile = profileProp !== undefined ? profileProp : storedProfile
  const [localPlan, setLocalPlan] = useState<Plan>(() => loadPlan())
  const plan = planProp ?? localPlan
  const partner = useMemo(() => getPartner(), [])

  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (alive) setCatalog(c)
    })
    return () => {
      alive = false
    }
  }, [])

  const filled = profileIsFilled(profile)
  const all = useMemo(() => catalog?.universities ?? [], [catalog])
  const cities = useMemo(() => cityList(all), [all])

  const searched = all.filter((u) => matchesQuery(u, q))
  const { shown, hiddenUnpublished } = applyFilters(searched, filters, now)
  const items = sortUniversities(shown, sort, now)

  const toggle = (id: string) => {
    const added = !isInPlan(plan, id)
    if (onTogglePlan) {
      onTogglePlan(id)
    } else {
      const next = togglePlan(localPlan, id)
      setLocalPlan(next)
      savePlan(next)
    }
    toast(added ? "Добавлено в мой план" : "Убрано из плана")
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* page head: the section kicker, a red Playfair heading in tracked capitals */}
      <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
        <HanziKicker hanzi="大学" className="mb-2">
          Каталог
        </HanziKicker>
        <h1 className="font-display text-3xl font-bold text-balance text-accent-text sm:text-4xl">
          <span className="caps">Вузы Китая</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          {catalog
            ? `${all.length} ${pluralRu(all.length, "вуз", "вуза", "вузов")} · факты с официальных страниц, у каждого источник и дата проверки`
            : "Загружаем каталог"}
        </p>
      </motion.div>

      {/* profile */}
      <motion.div variants={fadeUp} className="mb-5">
        <ProfileNotice profile={profile} filled={filled} onEdit={onEditProfile} />
      </motion.div>

      {/* search + sort */}
      <motion.div variants={fadeUp} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-faint" />
          <Input
            className="pl-9"
            placeholder="Поиск по названию или городу"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Поиск вуза"
          />
        </div>
        <Select className="sm:w-52" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Сортировка">
          <option value="deadline">Ближайший дедлайн</option>
          <option value="tuition">По стоимости</option>
          <option value="name">По названию</option>
        </Select>
      </motion.div>

      {/* filters */}
      <motion.div variants={fadeUp} className="mb-6">
        <ChinaFilterPanel filters={filters} setFilters={setFilters} cities={cities} profile={profile} />
      </motion.div>

      {/* results */}
      <motion.div variants={fadeUp}>
        <div className="mb-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
          <span>
            Найдено: <b className="font-semibold text-fg">{items.length}</b>
            {q && <> по запросу «{q}»</>}
          </span>
          {hiddenUnpublished > 0 && (
            <span className="inline-flex flex-wrap items-center gap-x-1">
              · ещё {hiddenUnpublished} {pluralRu(hiddenUnpublished, "вуз", "вуза", "вузов")} без опубликованных данных
              по выбранным фильтрам {hiddenUnpublished === 1 ? "скрыт" : "скрыто"}
              <Button variant="link" size="xs" onClick={() => setFilters({ ...filters, keepUnpublished: true })}>
                показать
              </Button>
            </span>
          )}
        </div>

        {!catalog ? (
          <div className="rounded-lg border border-border bg-surface px-6 py-14 text-center text-sm text-fg-muted">
            Загружаем каталог
          </div>
        ) : (
          <motion.div
            variants={cardStagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {items.map((u) => (
              <UniversityCard
                key={u.id}
                u={u}
                inPlan={isInPlan(plan, u.id)}
                onTogglePlan={toggle}
                onOpen={openUniversity}
                match={filled && profile ? matchUniversity(profile, u, now) : null}
                partnerNote={partner.universities?.includes(u.id) ? `в списке ${partner.name}` : null}
              />
            ))}
          </motion.div>
        )}

        {catalog && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-strong px-6 py-14 text-center text-sm text-fg-muted">
            Ничего не найдено. Измените фильтры
            {hiddenUnpublished > 0 && <> или включите «Показывать вузы без данных по фильтру»</>}.
          </div>
        )}

        {/* a thin red rule closes the section */}
        <p className="rule-accent mt-8 pt-3 text-xs text-fg-muted">
          Дедлайны, HSK/IELTS и CSCA – критичные условия: сверьтесь с сайтом вуза перед подачей. Ссылки «источник»
          ведут на официальные страницы вузов.
        </p>
      </motion.div>
    </motion.div>
  )
}

/* =====================================================================
   EUROPE (legacy catalog, spec §4) – rendered only with VITE_MARKET=europe.
   Reads the legacy `window.AdmiticaData` globals; untouched apart from the
   optional props.
   ===================================================================== */

type Kind = "uni" | "grant" | "intern"

/** Loose view over the catalog union – mirrors the duck-typed legacy access. */
type CatalogItem = AnyProgram & Partial<LegacyUniversity> & Partial<Grant> & Partial<Internship>

interface EuropeFilters {
  country?: string | null
  field?: string | null
  degree?: string[]
  funding?: string[]
  format?: string[]
  maxTuition?: number
  onlyScholarship?: boolean
  hideExpired?: boolean
}

type ListFilterKey = "degree" | "funding" | "format"

function EuropeFilterPanel({
  kind,
  filters,
  setFilters,
  countries,
  fields,
}: {
  kind: Kind
  filters: EuropeFilters
  setFilters: (f: EuropeFilters) => void
  countries: string[]
  fields: string[]
}) {
  const update = <K extends keyof EuropeFilters>(key: K, val: EuropeFilters[K]) => setFilters({ ...filters, [key]: val })
  const toggle = (key: ListFilterKey, val: string) => {
    const cur = filters[key] ?? []
    update(key, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val])
  }

  const checkRow = (key: ListFilterKey, val: string) => (
    <label key={val} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
      <Checkbox checked={(filters[key] ?? []).includes(val)} onCheckedChange={() => toggle(key, val)} />
      {val}
    </label>
  )

  return (
    <Card className="gap-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <strong className="flex items-center gap-1.5 text-[13px] font-semibold">
          <SlidersHorizontal className="size-3.5 text-accent-text" /> Фильтры
        </strong>
        <Button variant="link" size="xs" onClick={() => setFilters({})}>
          Сбросить
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <FilterGroup title="Страна" className="lg:w-48">
          <Select value={filters.country || ""} onChange={(e) => update("country", e.target.value || null)}>
            <option value="">Все страны</option>
            {countries.slice(0, 20).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterGroup>

        <FilterGroup title="Направление" className="lg:w-56">
          <Select value={filters.field || ""} onChange={(e) => update("field", e.target.value || null)}>
            <option value="">Все направления</option>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </FilterGroup>

        {kind === "uni" && (
          <>
            <FilterGroup title="Уровень">
              {["Бакалавриат", "Магистратура", "PhD"].map((d) => checkRow("degree", d))}
            </FilterGroup>

            <FilterGroup title="Стоимость до (€/год)" className="lg:w-52">
              <input
                type="range"
                min="0"
                max="50000"
                step="1000"
                value={filters.maxTuition || 50000}
                onChange={(e) => update("maxTuition", +e.target.value)}
                className="w-full cursor-pointer accent-accent"
              />
              <div className="text-right text-xs text-fg-muted">до €{(filters.maxTuition || 50000).toLocaleString()}</div>
            </FilterGroup>
          </>
        )}

        {kind === "grant" && (
          <FilterGroup title="Уровень покрытия">{["Полное", "Частичное"].map((f) => checkRow("funding", f))}</FilterGroup>
        )}

        {kind === "intern" && (
          <FilterGroup title="Формат">
            {["Очно", "Гибрид", "Очно / Гибрид"].map((f) => checkRow("format", f))}
          </FilterGroup>
        )}

        <FilterGroup title="Дополнительно" className="lg:w-64">
          <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
            <span>Только со стипендиями</span>
            <Switch
              checked={Boolean(filters.onlyScholarship)}
              onCheckedChange={(v) => update("onlyScholarship", v)}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
            <span>Скрыть с истёкшим дедлайном</span>
            <Switch checked={Boolean(filters.hideExpired)} onCheckedChange={(v) => update("hideExpired", v)} />
          </label>
        </FilterGroup>
      </div>
    </Card>
  )
}

const KIND_TABS: { id: Kind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "uni", label: "Университеты", icon: GraduationCap },
  { id: "grant", label: "Гранты", icon: Banknote },
  { id: "intern", label: "Стажировки", icon: Briefcase },
]

const noop = () => {}

function FindEurope({ saved = [], priorities = [], toggleSave = noop, togglePrio = noop, openDetail = noop }: FindProps) {
  const [kind, setKind] = useState<Kind>("uni")
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<EuropeFilters>({})
  const [sort, setSort] = useState("deadline")

  const data = window.AdmiticaData
  const dataMap: Record<Kind, CatalogItem[]> = {
    uni: data.universities as unknown as CatalogItem[],
    grant: data.grants as unknown as CatalogItem[],
    intern: data.internships as unknown as CatalogItem[],
  }
  // The legacy data module also exposes a curated country list (not in the typed surface)
  const countries = (data as typeof data & { countries?: string[] }).countries ?? []
  const fields = useMemo(() => [...new Set(window.AdmiticaData.universities.map((u) => u.field))].sort(), [])

  let items = dataMap[kind].filter((it) => {
    if (
      q &&
      !(it.name + " " + (it.program || "") + " " + (it.field || it.industry || "") + " " + it.country)
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false
    if (filters.country && it.country !== filters.country) return false
    if (filters.field && (it.field || it.industry) !== filters.field) return false
    if (filters.degree && filters.degree.length && !filters.degree.includes(it.degree ?? "")) return false
    if (filters.funding && filters.funding.length && !filters.funding.includes(it.funding ?? "")) return false
    if (filters.format && filters.format.length && !filters.format.includes(it.format ?? "")) return false
    if (filters.maxTuition && (it.tuitionMax || 0) > filters.maxTuition) return false
    if (filters.onlyScholarship && !it.scholarship) return false
    if (filters.hideExpired && it.deadlineDays <= 0) return false
    return true
  })

  if (sort === "deadline") items = [...items].sort((a, b) => a.deadlineDays - b.deadlineDays)
  if (sort === "name") items = [...items].sort((a, b) => a.name.localeCompare(b.name))
  if (sort === "tuition") items = [...items].sort((a, b) => (a.tuitionMax || 0) - (b.tuitionMax || 0))

  // Università Bocconi (u1) is the most fully-documented entry – keep it on top.
  if (kind === "uni") {
    const bi = items.findIndex((it) => it.id === "u1")
    if (bi > 0) items = [items[bi], ...items.slice(0, bi), ...items.slice(bi + 1)]
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="mb-6 sm:mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Подобрать программу</h1>
        <p className="mt-2 text-sm text-fg-muted">35 университетов · 35 грантов · 35 стажировок в Европе</p>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-5">
        <Segmented
          className="w-full sm:w-fit"
          value={kind}
          onChange={(id) => {
            setKind(id)
            setFilters({})
          }}
          options={KIND_TABS.map((t) => ({
            id: t.id,
            label: t.label,
            icon: <t.icon className="size-3.5" />,
          }))}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-faint" />
          <Input
            className="pl-9"
            placeholder={`Поиск ${kind === "uni" ? "университета" : kind === "grant" ? "гранта" : "стажировки"}...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select className="sm:w-44" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="deadline">По дедлайну</option>
          <option value="name">По названию</option>
          {kind === "uni" && <option value="tuition">По стоимости</option>}
        </Select>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-6">
        <EuropeFilterPanel kind={kind} filters={filters} setFilters={setFilters} countries={countries} fields={fields} />
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="mb-3.5 text-[13px] text-fg-muted">
          Найдено: <b className="font-medium text-fg">{items.length}</b>
          {q && <> по запросу «{q}»</>}
        </div>

        <motion.div
          key={kind}
          variants={cardStagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {items.map((u) => (
            <ProgramCard
              key={u.id}
              u={u}
              saved={saved.includes(u.id)}
              prio={priorities.includes(u.id)}
              toggleSave={toggleSave}
              togglePrio={togglePrio}
              onOpen={openDetail}
            />
          ))}
        </motion.div>

        {items.length === 0 && (
          <Card className="p-14 text-center text-sm text-fg-muted">Ничего не найдено. Попробуйте изменить фильтры.</Card>
        )}
      </motion.div>
    </motion.div>
  )
}
