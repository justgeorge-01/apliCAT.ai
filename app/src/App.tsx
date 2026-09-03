import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Sidebar } from "@/components/Sidebar"
import SettingsDialog from "@/components/SettingsDialog"
import { LeadPopup } from "@/components/partner/LeadPopup"
import { LeadInvite } from "@/components/partner/LeadInvite"
import { useLeadTrigger } from "@/components/partner/useLeadTrigger"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Seal } from "@/components/ui/seal"
import { ToastProvider } from "@/components/ui/toast"
import { findUniversity, loadCatalog } from "@/data/china"
import type { Catalog, University } from "@/data/china.types"
import { FEATURES } from "@/lib/features"
import { PROFILE_KEY, type ChinaProfile } from "@/lib/match"
import { tabEnabled, type Tab } from "@/lib/nav"
import { getPartner, hasLead } from "@/lib/partner"
import { usePersist } from "@/lib/persist"
import { isInPlan, loadPlan, savePlan, togglePlan, type Plan } from "@/lib/plan"
import type { AnyProgram, RoadmapEntry } from "@/legacy"
import Onboarding from "@/pages/Onboarding"
import Home from "@/pages/Home"
import Find from "@/pages/Find"
import Detail from "@/pages/Detail"
import PlanPage from "@/pages/Plan"
import Policy from "@/pages/Policy"
import Programs from "@/pages/Programs"
import Essay from "@/pages/Essay"
import Resume from "@/pages/Resume"

/**
 * App shell (spec §3.6): tab routing, detail overlay, settings dialog, the
 * onboarding gate and the one-time lead popup.
 *
 * Storage: the legacy `admitica.*` keys are read/written exactly as before
 * (they still feed the European screens behind their flags and the settings
 * dialog); everything new lives under `admitica.cn.*` – the profile
 * (`cn.profile`), the plan (`cn.plan`) and the popup lifecycle (`cn.lead.*`).
 */
export default function App() {
  const partner = getPartner()
  const isEurope = FEATURES.market === "europe"

  // Theme lives in admitica.theme – unchanged key. Paper (light) is the default;
  // the ink (dark) theme is opt-in via [data-theme="dark"].
  const [theme, setTheme] = usePersist<"dark" | "light">("theme", "light")
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Legacy keys and defaults – DO NOT change (existing users' data). Used by
  // the European market and by SettingsDialog.
  const [name, setName] = usePersist<string>("name", "")
  const [subscription, setSubscription] = usePersist<string>("plan", "Free")
  const [savedIds, setSavedIds] = usePersist<string[]>("savedIds", ["u1", "u2", "g1", "g2", "i1"])
  const [priorities, setPriorities] = usePersist<string[]>("priorities", ["u1", "u2", "g1"])
  const [roadmaps, setRoadmaps] = usePersist<RoadmapEntry[]>("roadmaps", [{ id: "rm1", itemId: "u1", step: 2 }])

  // «Китай»: profile from the five questions (admitica.cn.profile).
  const [profile, setProfile] = usePersist<ChinaProfile | null>(PROFILE_KEY, null)
  const hasProfile = profile !== null

  // Catalog – loaded once per page load; null while loading. `loadCatalog`
  // never throws: without `public/data/china.json` it serves the fixture with
  // `demo: true`, and the banner below says so.
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

  // The plan (admitica.cn.plan). Detail and the plan page persist their own
  // changes with `savePlan`; the shell re-reads storage on every navigation so
  // «В мой план» states stay in sync across screens.
  const [cnPlan, setCnPlan] = useState<Plan>(() => loadPlan())
  const refreshPlan = () => setCnPlan(loadPlan())

  const [tab, setTabState] = useState<Tab>("home")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [justOnboarded, setJustOnboarded] = useState(false)

  // Onboarding gate: Europe keeps the legacy «no name yet» gate; «Китай» shows
  // the landing first and opens the five questions from its CTA.
  const showOnboarding = isEurope ? !name : wizardOpen

  // Lead popup (spec §3.7): counts unique screens AFTER onboarding, mounted
  // only when the partner has a lead link. Called before any early return so
  // the Rules of Hooks hold.
  const lead = useLeadTrigger({
    screen: detailId ? "detail" : tab,
    enabled: hasLead(partner) && hasProfile && !showOnboarding,
  })

  const setTab = (t: Tab) => {
    setTabState(tabEnabled(t) ? t : "home")
    setDetailId(null)
    refreshPlan()
    window.scrollTo(0, 0)
  }

  /** Open a university card by id – Find/Home/Plan pass any object with an `id`. */
  const openDetail = (item: { id: string }) => {
    refreshPlan()
    setDetailId(item.id)
    window.scrollTo(0, 0)
  }

  const closeDetail = () => {
    setDetailId(null)
    refreshPlan()
  }

  const toggleInPlan = (id: string) => {
    // Always start from storage: another screen may have changed the plan.
    const next = togglePlan(loadPlan(), id)
    savePlan(next)
    setCnPlan(next)
  }

  const onPlanChange = (next: Plan) => setCnPlan(next)

  const startOnboarding = () => {
    setWizardOpen(true)
    window.scrollTo(0, 0)
  }

  /* ---------- legacy (European market) handlers – unchanged ---------- */
  const toggleSave = (id: string) => {
    setSavedIds(savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id])
  }

  const togglePrio = (id: string) => {
    if (priorities.includes(id)) {
      setPriorities(priorities.filter((x) => x !== id))
    } else {
      setPriorities([...priorities, id])
      if (!savedIds.includes(id)) setSavedIds([...savedIds, id])
    }
  }

  const addRoadmap = (it: AnyProgram) => {
    if (!priorities.includes(it.id)) setPriorities([...priorities, it.id])
    if (!savedIds.includes(it.id)) setSavedIds([...savedIds, it.id])
    if (roadmaps.find((r) => r.itemId === it.id)) return
    setRoadmaps([...roadmaps, { id: "rm" + Date.now(), itemId: it.id, step: 0, checks: {} }])
  }

  const reset = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("admitica."))
      .forEach((k) => localStorage.removeItem(k))
    location.reload()
  }

  if (showOnboarding) {
    return (
      <ToastProvider>
        <Onboarding
          initial={profile}
          onCancel={hasProfile ? () => setWizardOpen(false) : undefined}
          onDone={(r) => {
            setJustOnboarded(true)
            if (r.market === "europe") {
              setName(r.name)
              return
            }
            setProfile(r.profile)
            setWizardOpen(false)
            setTabState("find")
            setDetailId(null)
            window.scrollTo(0, 0)
          }}
        />
      </ToastProvider>
    )
  }

  const detail: University | null = detailId && catalog ? (findUniversity(catalog, detailId) ?? null) : null

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Sidebar tab={tab} setTab={setTab} onSettings={() => setSettingsOpen(true)} partner={partner} animateIn={justOnboarded} />
        {/* isolate: page-level z-indexes stay under the fixed chrome bars */}
        <main className="isolate lg:pl-64">
          {/* bottom padding below lg clears the fixed tab bar */}
          <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:py-10">
            {/* Demo banner – the fixture is served instead of the pipeline export. */}
            {catalog?.demo && (
              <div
                role="status"
                className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card-2 px-4 py-3 text-xs text-fg-muted"
              >
                <Badge variant="secondary" className="gap-1.5 pl-1">
                  <Seal glyph="试" variant="outline" tone="muted" />
                  демо
                </Badge>
                <span>
                  Демо-данные: каталог не прошёл конвейер проверки. Значения перенесены с официальных страниц
                  вузов вручную и помечены серым бейджем «демо».
                </span>
              </div>
            )}

            {detailId ? (
              detail ? (
                <Detail
                  item={detail}
                  onBack={closeDetail}
                  saved={isEurope ? savedIds.includes(detail.id) : isInPlan(cnPlan, detail.id)}
                  toggleSave={isEurope ? toggleSave : toggleInPlan}
                  prio={isEurope && priorities.includes(detail.id)}
                  togglePrio={isEurope ? togglePrio : undefined}
                  addRoadmap={isEurope ? addRoadmap : undefined}
                  hasRoadmap={isEurope && roadmaps.some((r) => r.itemId === detail.id)}
                  openDetail={openDetail}
                />
              ) : catalog ? (
                <NotFound onBack={closeDetail} />
              ) : (
                <CatalogLoading />
              )
            ) : (
              <>
                {tab === "home" && (
                  <Home
                    catalog={catalog}
                    hasProfile={hasProfile}
                    onStart={() => (hasProfile ? setTab("find") : startOnboarding())}
                    onEditProfile={startOnboarding}
                    setTab={setTab}
                    openDetail={openDetail}
                  />
                )}
                {tab === "find" &&
                  (isEurope ? (
                    <Find
                      saved={savedIds}
                      priorities={priorities}
                      toggleSave={toggleSave}
                      togglePrio={togglePrio}
                      openDetail={openDetail}
                    />
                  ) : (
                    /* «Китай»: the shell owns the plan, so «В мой план» stays in
                       sync between the catalog, the card and the plan page. */
                    <Find
                      openUniversity={openDetail}
                      profile={profile}
                      plan={cnPlan}
                      onTogglePlan={toggleInPlan}
                      onEditProfile={startOnboarding}
                    />
                  ))}
                {tab === "plan" &&
                  (catalog ? (
                    <PlanPage
                      catalog={catalog}
                      plan={cnPlan}
                      onPlanChange={onPlanChange}
                      onOpenUniversity={(id) => openDetail({ id })}
                      onOpenCatalog={() => setTab("find")}
                    />
                  ) : (
                    <CatalogLoading />
                  ))}
                {tab === "policy" && <Policy onBack={() => setTab("home")} />}
                {isEurope && (tab === "p_saved" || tab === "p_priority") && (
                  <Programs
                    subTab={tab}
                    setTab={setTab}
                    savedIds={savedIds}
                    priorities={priorities}
                    setPriorities={setPriorities}
                    toggleSave={toggleSave}
                    togglePrio={togglePrio}
                    roadmaps={roadmaps}
                    setRoadmaps={setRoadmaps}
                    openDetail={openDetail}
                  />
                )}
                {FEATURES.ai && tab === "essay" && <Essay priorities={priorities} />}
                {FEATURES.ai && tab === "resume" && <Resume />}
              </>
            )}

            {/* Footer – on every screen. The policy is an in-app page (spec §3.8). */}
            <footer className="rule-accent mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-6 text-xs text-fg-muted">
              <span className="flex items-center gap-2">
                <span className="font-display text-sm leading-none font-bold text-fg">
                  Abitura<span className="text-accent-text">.</span>
                </span>
                <span>© 2026</span>
              </span>
              <span className="max-sm:hidden">Факты – с официальных страниц вузов. Дедлайны сверяйте на сайте вуза.</span>
              <button
                type="button"
                onClick={() => setTab("policy")}
                className="underline-offset-2 transition-colors hover:text-fg hover:underline"
              >
                Политика и дисклеймер
              </button>
            </footer>
          </div>
        </main>

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          name={name}
          setName={setName}
          plan={subscription}
          setPlan={setSubscription}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          savedIds={savedIds}
          priorities={priorities}
          roadmaps={roadmaps}
          onReset={reset}
        />

        {/* Lead popup – mounted only when the partner has a lead link. No form,
            no data: the single CTA is the partner's Telegram link. */}
        {hasLead(partner) && (
          <LeadPopup open={lead.isOpen} onClose={lead.close}>
            <LeadInvite partner={partner} onAccept={lead.markAccepted} />
          </LeadPopup>
        )}
      </div>
    </ToastProvider>
  )
}

/* ---------- small shell states ---------- */

function CatalogLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-center"
    >
      <Loader2 className="size-6 animate-spin text-accent-text" />
      <span className="text-sm text-fg-muted">Загружаем каталог</span>
    </div>
  )
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
      <span className="font-display text-base font-bold">Вуза нет в каталоге</span>
      <span className="max-w-sm text-sm text-fg-muted">
        Возможно, он был в плане, а из каталога выбыл. Откройте каталог и выберите вуз заново.
      </span>
      <Button variant="outline" size="sm" onClick={onBack}>
        Назад
      </Button>
    </div>
  )
}
