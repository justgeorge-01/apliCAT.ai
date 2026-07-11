import { useEffect, useState } from "react"

import { Sidebar } from "@/components/Sidebar"
import SettingsDialog from "@/components/SettingsDialog"
import { WaitlistPopup } from "@/components/waitlist/WaitlistPopup"
import { WaitlistInvite } from "@/components/waitlist/WaitlistInvite"
import { useWaitlistTrigger } from "@/components/waitlist/useWaitlistTrigger"
import { ToastProvider } from "@/components/ui/toast"
import { usePersist } from "@/lib/persist"
import type { Tab } from "@/lib/nav"
import type { AnyProgram, RoadmapEntry } from "@/legacy"
import Onboarding from "@/pages/Onboarding"
import Home from "@/pages/Home"
import Find from "@/pages/Find"
import Detail from "@/pages/Detail"
import Programs from "@/pages/Programs"
import Essay from "@/pages/Essay"
import Resume from "@/pages/Resume"

/**
 * App shell – same state machine and storage keys as the legacy app.jsx:
 * tab routing, detail overlay, settings dialog, onboarding gate.
 */
export default function App() {
  // Theme lives in a NEW key (admitica.theme) – existing keys untouched.
  const [theme, setTheme] = usePersist<"dark" | "light">("theme", "dark")
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Same storage keys and defaults as the legacy desktop app – DO NOT change.
  const [name, setName] = usePersist<string>("name", "")
  const [plan, setPlan] = usePersist<string>("plan", "Free")
  const [savedIds, setSavedIds] = usePersist<string[]>("savedIds", ["u1", "u2", "g1", "g2", "i1"])
  const [priorities, setPriorities] = usePersist<string[]>("priorities", ["u1", "u2", "g1"])
  const [roadmaps, setRoadmaps] = usePersist<RoadmapEntry[]>("roadmaps", [{ id: "rm1", itemId: "u1", step: 2 }])

  const [tab, setTabState] = useState<Tab>("home")
  const [detail, setDetail] = useState<AnyProgram | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [justOnboarded, setJustOnboarded] = useState(false)

  // Waitlist popup: count unique screens AFTER onboarding (enabled = past the
  // name gate). Called before the early return below so Rules of Hooks hold.
  const waitlist = useWaitlistTrigger({
    screen: detail ? "detail" : tab,
    enabled: Boolean(name),
  })

  const setTab = (t: Tab) => {
    setTabState(t)
    setDetail(null)
    window.scrollTo(0, 0)
  }

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

  const openDetail = (item: AnyProgram) => {
    setDetail(item)
    window.scrollTo(0, 0)
  }

  const addRoadmap = (it: AnyProgram) => {
    // Roadmaps live inside Priorities – make sure the item is there
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

  // Onboarding gate – same condition as legacy (no name yet)
  if (!name) {
    return (
      <ToastProvider>
        <Onboarding
          onDone={(n) => {
            setJustOnboarded(true)
            setName(n)
          }}
        />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Sidebar
          tab={tab}
          setTab={setTab}
          name={name}
          plan={plan}
          onSettings={() => setSettingsOpen(true)}
          animateIn={justOnboarded}
        />
        {/* isolate: page-level z-indexes (dragged cards) stay under the fixed chrome bars */}
        <main className="isolate lg:pl-64">
          {/* bottom padding below lg clears the fixed tab bar */}
          <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:py-10">
            {detail ? (
              <Detail
                item={detail}
                onBack={() => setDetail(null)}
                saved={savedIds.includes(detail.id)}
                prio={priorities.includes(detail.id)}
                toggleSave={toggleSave}
                togglePrio={togglePrio}
                addRoadmap={addRoadmap}
                hasRoadmap={roadmaps.some((r) => r.itemId === detail.id)}
                openDetail={openDetail}
              />
            ) : (
              <>
                {tab === "home" && (
                  <Home
                    name={name}
                    priorities={priorities}
                    savedIds={savedIds}
                    roadmaps={roadmaps}
                    setTab={setTab}
                    openDetail={openDetail}
                  />
                )}
                {tab === "find" && (
                  <Find
                    saved={savedIds}
                    priorities={priorities}
                    toggleSave={toggleSave}
                    togglePrio={togglePrio}
                    openDetail={openDetail}
                  />
                )}
                {tab.startsWith("p_") && (
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
                {tab === "essay" && <Essay priorities={priorities} />}
                {tab === "resume" && <Resume />}
              </>
            )}

            {/* Footer – visible on every screen (desktop + mobile). The privacy
                link is built from the Vite base so it resolves on GitHub Pages
                under any sub-path; opens the standalone static page in a new tab. */}
            <footer className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-6 text-xs text-fg-muted">
              <span>© 2026 Admitica</span>
              <a
                href={`${import.meta.env.BASE_URL}privacy.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 transition-colors hover:text-fg hover:underline"
              >
                Политика конфиденциальности
              </a>
            </footer>
          </div>
        </main>

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          name={name}
          setName={setName}
          plan={plan}
          setPlan={setPlan}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          savedIds={savedIds}
          priorities={priorities}
          roadmaps={roadmaps}
          onReset={reset}
        />

        {/* Waitlist popup – centered, NON-blocking ask ("did you like it?").
            The invite's CTA opens the waitlist form (waitlist.html) in a new tab
            and marks submitted; «Не сейчас» dismisses. */}
        <WaitlistPopup open={waitlist.isOpen} onClose={waitlist.close} skipLabel="Не сейчас">
          <WaitlistInvite onAccept={waitlist.markSubmitted} />
        </WaitlistPopup>
      </div>
    </ToastProvider>
  )
}
