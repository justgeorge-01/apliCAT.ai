import { useEffect, useState } from "react"
import { MotionConfig } from "framer-motion"

import { ThemeSwitch } from "@/components/ui/theme-switch"
import { loadCatalog } from "@/data/china"
import type { Catalog } from "@/data/china.types"
import { loadGuide, type GuideData } from "@/data/guide"
import { usePersist } from "@/lib/persist"
import { cn } from "@/lib/utils"

import { GuideAbout } from "./GuideAbout"
import { GuideHome } from "./GuideHome"
import { GuideUniversityPage } from "./GuideUniversity"
import { parseRoute, routeHref, type GuideRoute } from "./route"

function useHashRoute(): GuideRoute {
  const [route, setRoute] = useState<GuideRoute>(() => parseRoute(location.hash))
  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return route
}

/**
 * The public guide: a plain site, not an application. A header with two
 * links, the catalog of universities, one page per university, and «О
 * проекте». No accounts, no plan, no questionnaire, no partner – nothing is
 * stored about a visitor except the theme in their own browser.
 */
export default function GuideApp() {
  const route = useHashRoute()
  const [theme, setTheme] = usePersist<"dark" | "light">("theme", "light")
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [guide, setGuide] = useState<GuideData | null>(null)
  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (alive) setCatalog(c)
    })
    loadGuide().then((g) => {
      if (alive) setGuide(g)
    })
    return () => {
      alive = false
    }
  }, [])

  const navLink = (to: GuideRoute, label: string) => {
    const active = to.page === route.page || (to.page === "home" && route.page === "university")
    return (
      <a
        href={routeHref(to)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          active ? "font-semibold text-fg" : "text-fg-muted hover:text-fg",
        )}
      >
        {label}
      </a>
    )
  }

  return (
    <MotionConfig reducedMotion="always">
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <a
              href="#/"
              className="rounded-sm font-display text-lg leading-none font-bold tracking-tight text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Abitura<span className="text-accent-text">.</span>
            </a>
            <nav aria-label="Разделы" className="flex items-center gap-1">
              {navLink({ page: "home" }, "Вузы")}
              {navLink({ page: "about" }, "О проекте")}
              <ThemeSwitch
                className="ml-2 max-sm:hidden"
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
          {route.page === "home" && <GuideHome catalog={catalog} guide={guide} />}
          {route.page === "university" && <GuideUniversityPage id={route.id} catalog={catalog} guide={guide} />}
          {route.page === "about" && <GuideAbout guide={guide} />}
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-6 text-xs text-fg-muted sm:px-6">
            <span className="flex items-center gap-2">
              <span className="font-display text-sm leading-none font-bold text-fg">
                Abitura<span className="text-accent-text">.</span>
              </span>
              <span>© 2026</span>
            </span>
            <span className="max-w-xl">
              Ссылки ведут на сайты авторов. Официальные условия сверяйте на сайте вуза перед подачей.
            </span>
            <span className="flex items-center gap-3">
              <a href="#/about" className="underline-offset-2 hover:text-fg hover:underline">
                О проекте
              </a>
              <ThemeSwitch
                className="sm:hidden"
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
            </span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
