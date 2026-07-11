import { Switch as SwitchPrimitive } from "radix-ui"
import { Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Minimal light/dark theme switch – a clean shadcn-style pill with a Sun on the
 * left and a Moon on the right; the knob slides under the active icon.
 *
 * Adapted from a Next.js / next-themes component to this Vite app: the theme is
 * owned by App.tsx (persisted to localStorage "admitica.theme" + <html data-theme>),
 * so this stays a controlled, prop-driven toggle instead of pulling in next-themes.
 * Colours use the app's teal design tokens, not shadcn's background/input/ring.
 *
 * Geometry: track 64×32, knob 24. The outline is an *inset ring* (not a border)
 * so it doesn't shrink the content box – that keeps the knob travel symmetric
 * (4px gap on both rest positions) and the icon centres aligned to the knob.
 */

export interface ThemeSwitchProps {
  /** Current theme – the single source of truth lives in App.tsx. */
  theme: "dark" | "light"
  /** Flip the theme. */
  onToggle: () => void
  className?: string
}

export function ThemeSwitch({ theme, onToggle, className }: ThemeSwitchProps) {
  const isDark = theme === "dark"

  return (
    <SwitchPrimitive.Root
      checked={isDark}
      onCheckedChange={onToggle}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      className={cn(
        "relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full bg-card-2",
        "ring-1 ring-inset ring-border transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        className,
      )}
    >
      {/* Sun – left, lit when in light mode (it sits on the knob) */}
      <span className="pointer-events-none absolute inset-y-0 left-2 z-20 flex items-center">
        <Sun className={cn("size-4 transition-colors duration-200", isDark ? "text-fg-muted" : "text-bg")} />
      </span>

      {/* Moon – right, lit when in dark mode (it sits on the knob) */}
      <span className="pointer-events-none absolute inset-y-0 right-2 z-20 flex items-center">
        <Moon className={cn("size-4 transition-colors duration-200", isDark ? "text-bg" : "text-fg-muted")} />
      </span>

      {/* Sliding knob (under the icons), high-contrast in both themes */}
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none z-10 block size-6 translate-x-1 rounded-full bg-fg shadow-sm",
          "transition-transform duration-200 data-[state=checked]:translate-x-9",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export default ThemeSwitch
