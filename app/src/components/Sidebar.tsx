import { useState } from "react"
import { motion } from "framer-motion"
import {
  Bookmark,
  Briefcase,
  ChevronDown,
  Home,
  PenLine,
  Search,
  Settings,
} from "lucide-react"

import type { Tab } from "@/lib/nav"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

/* Socials – same links as the legacy sidebar.jsx */
const SOCIALS = [
  {
    label: "Telegram",
    href: "https://t.me/admitica",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.9 4.3c.3-1.2-.4-1.7-1.2-1.4L2.7 9.9c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 10.7-6.7c.5-.3 1-.2.6.2l-8.7 7.8-.3 4.8c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3-14.6z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/admitica",
    icon: (
      // fill-глиф (как у остальных соцсетей) – simple-icons path
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com/admitica",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.6c0-.9.3-1.6 1.7-1.6H17V4.2c-.3 0-1.3-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H8v3h2.5V21h3z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@admitica",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.6 3c.4 2 1.8 3.5 3.9 3.8v3c-1.5 0-2.9-.5-3.9-1.3v6.2c0 3.7-2.7 6.3-6.2 6.3-3.4 0-6-2.5-6-5.8 0-3.4 2.8-6 6.5-5.8v3.1c-.3-.1-.6-.1-.9-.1-1.6 0-2.8 1.2-2.8 2.8 0 1.6 1.2 2.8 2.7 2.8 1.7 0 3-1.3 3-3.2V3h3.7z" />
      </svg>
    ),
  },
]

const NAV_ITEMS = [
  { id: "home" as Tab, label: "Главная", icon: Home },
  { id: "find" as Tab, label: "Подобрать программу", icon: Search },
  {
    id: "programs",
    label: "Мои программы",
    icon: Bookmark,
    sub: [
      { id: "p_saved" as Tab, label: "Сохранённые" },
      { id: "p_priority" as Tab, label: "Приоритеты и роадмап" },
    ],
  },
  { id: "essay" as Tab, label: "Редактор эссе", icon: PenLine },
  { id: "resume" as Tab, label: "Сборка резюме", icon: Briefcase },
]

/* Bottom tab bar (narrow screens) – mirrors the legacy mobile Tabbar,
   extended with Эссе/Резюме for parity with the desktop sidebar. */
const MOBILE_TABS: { id: Tab; label: string; icon: typeof Home; activeFor: (t: Tab) => boolean }[] = [
  { id: "home", label: "Главная", icon: Home, activeFor: (t) => t === "home" },
  { id: "find", label: "Найти", icon: Search, activeFor: (t) => t === "find" },
  { id: "p_saved", label: "Мои", icon: Bookmark, activeFor: (t) => t.startsWith("p_") },
  { id: "essay", label: "Эссе", icon: PenLine, activeFor: (t) => t === "essay" },
  { id: "resume", label: "Резюме", icon: Briefcase, activeFor: (t) => t === "resume" },
]

export interface SidebarProps {
  tab: Tab
  setTab: (t: Tab) => void
  name: string
  plan: string
  onSettings: () => void
  /** Slide-in entrance right after onboarding (mirrors the legacy animation). */
  animateIn?: boolean
}

function NavContent({ tab, setTab, name, plan, onSettings }: SidebarProps) {
  const [progExpanded, setProgExpanded] = useState(tab.startsWith("p_"))
  const initial = (name || "У").charAt(0).toUpperCase()

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* logo */}
      <div className="flex items-center px-5 pt-6 pb-5">
        <span className="text-lg font-bold tracking-tight">
          Admitica<span className="text-accent-text">.</span>
        </span>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((it) => {
          const Icon = it.icon
          const isActive = tab === it.id || (it.sub?.some((s) => s.id === tab) ?? false)
          return (
            <div key={it.id}>
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  isActive ? "bg-accent-soft text-accent-text" : "text-fg-muted hover:bg-fg/5 hover:text-fg",
                )}
                onClick={() => {
                  if (it.sub) {
                    setProgExpanded(!progExpanded)
                    if (!isActive) setTab(it.sub[0].id)
                  } else {
                    setTab(it.id as Tab)
                  }
                }}
              >
                <Icon className="size-4.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{it.label}</span>
                {it.sub && (
                  <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", progExpanded && "rotate-180")} />
                )}
              </button>
              {it.sub && progExpanded && (
                <div className="mt-0.5 mb-1 ml-7 flex flex-col gap-0.5 border-l border-border pl-3">
                  {it.sub.map((s) => (
                    <button
                      key={s.id}
                      className={cn(
                        "rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                        tab === s.id ? "text-accent-text" : "text-fg-muted hover:text-fg",
                      )}
                      onClick={() => setTab(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* socials */}
      <div className="px-5 pb-3">
        <div className="mb-2 text-xs font-semibold tracking-widest text-fg-muted uppercase">Соцсети</div>
        <div className="flex items-center gap-1">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="grid size-8 place-items-center rounded-lg text-fg-faint transition-colors duration-200 hover:bg-fg/5 hover:text-fg-muted"
            >
              {s.icon}
            </a>
          ))}
        </div>
      </div>

      {/* user → settings */}
      <button
        className="mx-3 mb-4 flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors duration-200 outline-none hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-accent/60"
        onClick={onSettings}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name || "Пользователь"}</div>
          <div className="text-xs text-fg-muted">{plan}</div>
        </div>
        <Settings className="size-4 shrink-0 text-fg-faint" />
      </button>
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  const { tab, setTab, name, onSettings, animateIn } = props
  const initial = (name || "У").charAt(0).toUpperCase()

  return (
    <>
      {/* Desktop rail */}
      <motion.aside
        initial={animateIn ? { x: -32, opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-surface lg:block"
      >
        <NavContent {...props} />
      </motion.aside>

      {/* Mobile top bar: logo · profile (настройки) */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <span className="text-base font-bold tracking-tight">
          Admitica<span className="text-accent-text">.</span>
        </span>
        <button
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-accent-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          aria-label="Настройки профиля"
          onClick={onSettings}
        >
          {initial}
        </button>
      </header>

      {/* Mobile bottom tab bar – replaces the sidebar below lg */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Основная навигация"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {MOBILE_TABS.map((t) => {
            const Icon = t.icon
            const active = t.activeFor(tab)
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pt-2.5 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  active ? "text-accent-text" : "text-fg-faint",
                )}
              >
                <Icon className={cn("size-5 transition-transform duration-200", active && "scale-110")} />
                <span className={cn("truncate text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
